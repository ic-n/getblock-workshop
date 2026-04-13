import Client, {
  CommitmentLevel,
  type SubscribeRequest,
  type SubscribeRequestFilterTransactions,
} from '@triton-one/yellowstone-grpc';
import { EventEmitter } from 'node:events';
import type { Adapter, NFTEvent, EventType } from '../shared/types';

// ─────────────────────────────────────────────────────────────────────────────
// Known on-chain addresses
// ─────────────────────────────────────────────────────────────────────────────

// Magic Eden v2 escrow program — NFTs transferred to/from this address are
// marketplace events. The engine treats this exactly like MARKETPLACE_ADDRESS
// in the mock adapter.
const MAGIC_EDEN_V2 = 'M2mx93ekt1fmXSVkTrUL9xVFHkmME8HTUi5Cyc5aF7K';

// Metaplex Token Metadata program — every Solana NFT mint goes through this.
const MPL_TOKEN_METADATA = 'metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s';

// Set of addresses we treat as "marketplace escrow". Extend as needed.
const MARKETPLACE_ADDRESSES = new Set([MAGIC_EDEN_V2]);

const RECONNECT_DELAY_MS = 3_000;

// ─────────────────────────────────────────────────────────────────────────────
// "Finna do it later" stubs
// ─────────────────────────────────────────────────────────────────────────────

/**
 * TODO: Fetch NFT name from Metaplex on-chain metadata account.
 * The metadata PDA is derived from [mint, MPL_TOKEN_METADATA].
 * For now, return a short version of the mint address as the name.
 */
async function fetchNftName(mintAddress: string): Promise<string> {
  return `NFT ${mintAddress.slice(0, 6)}…`;
}

/**
 * TODO: Filter to only mints belonging to your target collection.
 * Real check: compare update_authority or verified_collection_address in
 * the on-chain metadata account against your collection's authority pubkey.
 * For now: track every NFT that flows through Magic Eden.
 */
function isTargetCollection(_mintAddress: string): boolean {
  return true;
}

/**
 * TODO: Distinguish PURCHASE from UNLIST by checking SOL flow in the tx.
 * A purchase has lamport transfers (buyer pays seller); an unlist does not.
 * Real check: diff preBalances/postBalances on the buyer/seller accounts.
 * For now: assume every ME→wallet transfer is a purchase.
 */
function isSale(
  _preBalances: readonly bigint[],
  _postBalances: readonly bigint[],
): boolean {
  return true;
}

// ─────────────────────────────────────────────────────────────────────────────
// YellowstoneAdapter
// ─────────────────────────────────────────────────────────────────────────────

export interface YellowstoneConfig {
  /** GetBlock gRPC endpoint, e.g. "https://go.getblock.io/<TOKEN>/" */
  endpoint: string;
  /** GetBlock access token */
  token: string;
}

export class YellowstoneAdapter extends EventEmitter implements Adapter {
  private readonly config: YellowstoneConfig;
  private running = false;

  /**
   * Maps on-chain mint address → local sequential integer ID.
   * The engine (and frontend) work with sequential IDs, not pubkeys.
   */
  private readonly mintRegistry = new Map<string, number>();
  private nextId = 0;

  constructor(config: YellowstoneConfig) {
    super();
    this.config = config;
  }

  // ── Adapter interface ───────────────────────────────────────────────────────

  on(event: 'nft_event', listener: (e: NFTEvent) => void): this {
    return super.on(event, listener);
  }

  off(event: 'nft_event', listener: (e: NFTEvent) => void): this {
    return super.off(event, listener);
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    void this.connectLoop();
  }

  stop(): void {
    this.running = false;
  }

  // ── Connection & stream ─────────────────────────────────────────────────────

  private async connectLoop(): Promise<void> {
    let delay = RECONNECT_DELAY_MS;
    while (this.running) {
      try {
        await this.openStream();
        delay = RECONNECT_DELAY_MS; // reset backoff on clean close
      } catch (err) {
        if (!this.running) break;
        console.error(`[YellowstoneAdapter] stream error, reconnecting in ${delay}ms`, err);
        await sleep(delay);
        delay = Math.min(delay * 2, 30_000); // exponential backoff, cap at 30s
      }
    }
  }

  private async openStream(): Promise<void> {
    const client = new Client(this.config.endpoint, this.config.token, {});
    const stream = await client.subscribe();

    // ── Subscription filters ─────────────────────────────────────────────────
    //
    // We need two streams:
    //
    // 1. "magic-eden" — any transaction that touches the ME escrow program.
    //    This catches LIST, UNLIST, and PURCHASE events.
    //
    // 2. "token-metadata" — any transaction that calls the Metaplex metadata
    //    program. This catches MINT events (new NFTs being created).
    //
    // Both use accountInclude so only relevant transactions are streamed.
    // "vote: false, failed: false" drops noise we don't care about.

    const txFilter: SubscribeRequestFilterTransactions = {
      vote: false,
      failed: false,
    };

    const request: SubscribeRequest = {
      transactions: {
        'magic-eden': {
          ...txFilter,
          accountInclude: [MAGIC_EDEN_V2],
        },
        'token-metadata': {
          ...txFilter,
          accountInclude: [MPL_TOKEN_METADATA],
        },
      },
      commitment: CommitmentLevel.PROCESSED,
      accounts: {},
      slots: {},
      transactionsStatus: {},
      blocks: {},
      blocksMeta: {},
      entry: {},
      accountsDataSlice: [],
    };

    stream.write(request);

    return new Promise((resolve, reject) => {
      stream.on('data', (msg) => {
        if (msg.transaction) {
          void this.handleTransaction(msg.transaction);
        }
      });

      stream.on('error', reject);
      stream.on('end', resolve);
      stream.on('close', resolve);
    });
  }

  // ── Transaction parsing ─────────────────────────────────────────────────────

  private async handleTransaction(txUpdate: {
    slot?: bigint | number;
    transaction?: {
      meta?: {
        preTokenBalances?: TokenBalance[];
        postTokenBalances?: TokenBalance[];
        preBalances?: bigint[];
        postBalances?: bigint[];
      };
    };
  }): Promise<void> {
    const slot = Number(txUpdate.slot ?? 0);
    const meta = txUpdate.transaction?.meta;
    if (!meta) return;

    const pre  = meta.preTokenBalances  ?? [];
    const post = meta.postTokenBalances ?? [];

    const moves = diffTokenBalances(pre, post);

    for (const move of moves) {
      if (!isTargetCollection(move.mint)) continue;

      const nftId   = this.getOrAssignId(move.mint);
      const nftName = await fetchNftName(move.mint);

      const type = classifyTransfer(
        move.from,
        move.to,
        meta.preBalances  ?? [],
        meta.postBalances ?? [],
      );

      const event: NFTEvent = {
        type,
        nftId,
        nftName,
        from: move.from ?? '',
        to:   move.to   ?? '',
        slot,
        timestamp: Date.now(),
      };

      this.emit('nft_event', event);
    }
  }

  private getOrAssignId(mint: string): number {
    if (!this.mintRegistry.has(mint)) {
      this.mintRegistry.set(mint, this.nextId++);
    }
    return this.mintRegistry.get(mint)!;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Transaction parsing helpers
// ─────────────────────────────────────────────────────────────────────────────

interface TokenBalance {
  mint: string;
  owner: string;
  uiTokenAmount?: { decimals: number; amount: string };
}

interface NftMove {
  mint: string;
  from: string | null; // null = freshly minted (no pre-balance)
  to: string | null;
}

/**
 * Diff pre/post token balances to find NFTs that changed owner.
 *
 * An NFT is an SPL token with decimals=0 and amount=1.
 * The `owner` field in TokenBalance is the wallet (not the token account),
 * so we get human-readable wallet pubkeys directly — no bs58 decode needed.
 */
function diffTokenBalances(
  pre: TokenBalance[],
  post: TokenBalance[],
): NftMove[] {
  const preOwners  = new Map<string, string>(); // mint → owner
  const postOwners = new Map<string, string>();

  for (const b of pre)  if (isNft(b)) preOwners.set(b.mint, b.owner);
  for (const b of post) if (isNft(b)) postOwners.set(b.mint, b.owner);

  const moves: NftMove[] = [];

  // NFTs that exist in post balances — detect owner changes and fresh mints
  for (const [mint, toOwner] of postOwners) {
    const fromOwner = preOwners.get(mint) ?? null;
    if (fromOwner !== toOwner) {
      moves.push({ mint, from: fromOwner, to: toOwner });
    }
  }

  return moves;
}

function isNft(b: TokenBalance): boolean {
  return b.uiTokenAmount?.decimals === 0 && b.uiTokenAmount?.amount === '1';
}

/**
 * Classify transfer type by checking source/destination against known
 * marketplace program addresses.
 *
 * TODO: Magic Eden uses PDA-derived escrow accounts as token owners, not the
 * program address itself. A complete implementation would derive all possible
 * escrow PDAs for the ME program (or query them on first encounter).
 * For now: we rely on MARKETPLACE_ADDRESSES containing the program address
 * and note that this will miss some edge cases until the PDA check is added.
 */
function classifyTransfer(
  from: string | null,
  to: string | null,
  preBalances: readonly bigint[],
  postBalances: readonly bigint[],
): EventType {
  if (from === null)                       return 'MINT';
  if (to   && MARKETPLACE_ADDRESSES.has(to))   return 'LIST';
  if (from && MARKETPLACE_ADDRESSES.has(from)) {
    // TODO: replace isSale stub with actual SOL-flow check
    return isSale(preBalances, postBalances) ? 'PURCHASE' : 'UNLIST';
  }
  return 'TRANSFER';
}

// ─────────────────────────────────────────────────────────────────────────────
// Util
// ─────────────────────────────────────────────────────────────────────────────

function sleep(ms: number) {
  return new Promise<void>(resolve => setTimeout(resolve, ms));
}
