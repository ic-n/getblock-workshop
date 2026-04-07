import { DEFAULT_CONFIG } from './types';
import type {
  Config,
  Agent,
  NFTEvent,
  HolderEntry,
  MarketplaceEntry,
  StateSnapshot,
} from './types';

// Internal record of a single NFT's current holding state
interface Holding {
  nftId: number;
  nftName: string;
  owner: string;     // current owner address
  listed: boolean;   // true = held by marketplace program, no allocation
  listedBy: string;  // seller address — set when listed, cleared when unlisted/bought
  listedAt: number;  // Unix ms when listed
}

export class AllocationEngine {
  private readonly config: Config;

  // nftId → current holding state
  private readonly holdings = new Map<number, Holding>();

  // address → cumulative tokens earned
  private readonly allocation = new Map<string, number>();

  // address → agent (for name resolution in the leaderboard)
  private readonly agents = new Map<string, Agent>();

  private slot = 0;
  private recentMints: NFTEvent[] = [];
  private recentEvents: NFTEvent[] = [];

  constructor(config: Config = DEFAULT_CONFIG) {
    this.config = config;
  }

  // ── Agent registry ─────────────────────────────────────────────────────────

  registerAgent(agent: Agent): void {
    this.agents.set(agent.address, agent);
  }

  // ── Event processing ───────────────────────────────────────────────────────

  processEvent(event: NFTEvent): void {
    this.slot = event.slot;

    switch (event.type) {
      case 'MINT': {
        this.holdings.set(event.nftId, {
          nftId: event.nftId,
          nftName: event.nftName,
          owner: event.to,
          listed: false,
          listedBy: '',
          listedAt: 0,
        });
        this.recentMints = [event, ...this.recentMints].slice(0, 20);
        break;
      }

      case 'LIST': {
        const h = this.holdings.get(event.nftId);
        if (!h) break;
        h.listed = true;
        h.listedBy = event.from;
        h.listedAt = event.timestamp;
        h.owner = event.to; // marketplace address
        this.recentEvents = [event, ...this.recentEvents].slice(0, 20);
        break;
      }

      case 'UNLIST': {
        const h = this.holdings.get(event.nftId);
        if (!h) break;
        h.listed = false;
        h.listedBy = '';
        h.listedAt = 0;
        h.owner = event.to;
        this.recentEvents = [event, ...this.recentEvents].slice(0, 20);
        break;
      }

      case 'PURCHASE': {
        const h = this.holdings.get(event.nftId);
        if (!h) break;
        h.listed = false;
        h.listedBy = '';
        h.listedAt = 0;
        h.owner = event.to;
        this.recentEvents = [event, ...this.recentEvents].slice(0, 20);
        break;
      }

      case 'TRANSFER': {
        const h = this.holdings.get(event.nftId);
        if (!h) break;
        h.owner = event.to;
        this.recentEvents = [event, ...this.recentEvents].slice(0, 20);
        break;
      }
    }
  }

  // ── Tick — distribute tokens for one interval ──────────────────────────────
  //
  // Called once per TICK_RATE_MS. Distributes:
  //   tokensThisTick = (TICK_RATE_MS / 1000) * TOKENS_PER_SECOND
  // split equally across all non-listed NFTs.

  tick(): void {
    this.slot += 1;

    const activeHoldings = [...this.holdings.values()].filter(h => !h.listed);
    if (activeHoldings.length === 0) return;

    const tokensThisTick =
      (this.config.TICK_RATE_MS / 1000) * this.config.TOKENS_PER_SECOND;
    const tokensPerNft = tokensThisTick / activeHoldings.length;

    for (const h of activeHoldings) {
      const prev = this.allocation.get(h.owner) ?? 0;
      this.allocation.set(h.owner, prev + tokensPerNft);
    }
  }

  // ── Snapshot ───────────────────────────────────────────────────────────────

  getSnapshot(): StateSnapshot {
    // Build leaderboard — only wallet addresses (non-program agents) with > 0 tokens
    const leaderboard: HolderEntry[] = [];

    for (const [address, tokens] of this.allocation) {
      const agent = this.agents.get(address);
      if (agent?.isProgram) continue;

      const nftsHeld = [...this.holdings.values()].filter(
        h => h.owner === address && !h.listed
      ).length;

      leaderboard.push({
        address,
        name: agent?.name ?? address.slice(0, 8),
        nftsHeld,
        tokensAllocated: Math.floor(tokens),
      });
    }

    leaderboard.sort((a, b) => b.tokensAllocated - a.tokensAllocated);

    // Build marketplace list
    const marketplace: MarketplaceEntry[] = [];
    for (const h of this.holdings.values()) {
      if (!h.listed) continue;
      const sellerName =
        this.agents.get(h.listedBy)?.name ?? h.listedBy.slice(0, 8);
      marketplace.push({
        nftId: h.nftId,
        nftName: h.nftName,
        listedBy: sellerName,
        listedAt: h.listedAt,
      });
    }

    const totalTokensAllocated = [...this.allocation.values()].reduce(
      (sum, t) => sum + t,
      0
    );

    return {
      slot: this.slot,
      tickRateMs: this.config.TICK_RATE_MS,
      totalTokensAllocated: Math.floor(totalTokensAllocated),
      nftsMinted: this.holdings.size,
      collectionSize: this.config.COLLECTION_SIZE,
      leaderboard,
      marketplace,
      recentMints: this.recentMints,
      recentEvents: this.recentEvents,
    };
  }
}
