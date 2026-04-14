import { CommitmentLevel } from "@triton-one/yellowstone-grpc";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { decodeUpdate } from "./decoder";

// Minimal interface satisfied by both the real Client and MockClient.
// Avoids a hard dependency on the concrete Client class in this module.
export interface GeyserClient {
  subscribe(): Promise<{
    write(req: unknown): void;
    on(event: "data",  listener: (update: unknown) => void): unknown;
    on(event: "error", listener: (err: Error) => void): unknown;
    on(event: "end",   listener: () => void): unknown;
  }>;
}

/**
 * NftHoldIndexer
 *
 * Subscribes to a Yellowstone gRPC stream and computes how long each wallet
 * held a specific NFT mint.  Three hold period types are captured:
 *
 *   1. Mint event  → first outgoing transfer
 *   2. Inbound transfer → next outgoing transfer
 *   3. Inbound transfer → stream EOF (current holder at subscription end)
 *
 * Wallets in `excludedAddresses` (e.g. marketplace escrow programs) accrue
 * zero hold time — they are skipped on both open and close.
 *
 * Duration unit: slots (1 Solana slot ≈ 400 ms).
 */
export class NftHoldIndexer {
  private readonly client: GeyserClient;
  private readonly mint: string;
  private readonly excluded: Set<string>;

  // wallet → slot at which the current hold opened
  private openHolds = new Map<string, bigint>();
  // wallet → total accumulated hold slots across all closed periods
  private accumulated = new Map<string, bigint>();
  // highest slot seen on the stream — closes open holds at EOF
  private lastSlot = 0n;

  constructor(
    client: GeyserClient,
    mint: string,
    excludedAddresses: Set<string> = new Set(),
  ) {
    this.client = client;
    this.mint = mint;
    this.excluded = excludedAddresses;
  }

  async run(): Promise<void> {
    const stream = await this.client.subscribe();

    await new Promise<void>((resolve, reject) => {
      // Set up listeners BEFORE writing — the mock starts playback on write().
      stream.on("data", (update: unknown) => {
        const decoded = decodeUpdate(update as Parameters<typeof decodeUpdate>[0]);
        if (!decoded) return;

        if (decoded.type === "slot") {
          if (decoded.slot > this.lastSlot) this.lastSlot = decoded.slot;
          return;
        }

        if (decoded.mint !== this.mint) return;

        const { holder, amount, slot } = decoded;

        if (amount === 1n) {
          if (!this.excluded.has(holder)) {
            this.openHolds.set(holder, slot);
          }
        } else if (amount === 0n) {
          const openSlot = this.openHolds.get(holder);
          if (openSlot !== undefined) {
            this.accumulate(holder, slot - openSlot);
            this.openHolds.delete(holder);
          }
        }
      });

      stream.on("error", reject);

      stream.on("end", () => {
        // Subscription ended — close any still-open holds at the last observed slot.
        for (const [holder, openSlot] of this.openHolds) {
          this.accumulate(holder, this.lastSlot - openSlot);
        }
        this.openHolds.clear();
        resolve();
      });

      // Trigger stream playback (both mock and real Geyser node start on first write).
      stream.write({
        accounts: {
          nftTokenAccounts: {
            account: [],
            owner: [TOKEN_PROGRAM_ID.toBase58()],
            filters: [],
          },
        },
        slots: { all: {} },
        transactions: {},
        blocks: {},
        blocksMeta: {},
        entry: {},
        accountsDataSlice: [],
        commitment: CommitmentLevel.PROCESSED,
      });
    });
  }

  /** Total slots this wallet held the NFT (closed + open periods combined). */
  holdSlots(wallet: string): number {
    return Number(this.accumulated.get(wallet) ?? 0n);
  }

  private accumulate(wallet: string, slots: bigint): void {
    this.accumulated.set(wallet, (this.accumulated.get(wallet) ?? 0n) + slots);
  }
}
