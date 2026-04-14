import { CommitmentLevel, SubscribeUpdate } from "@triton-one/yellowstone-grpc";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { decodeUpdate } from "./decoder";

export interface GeyserClient {
  subscribe(): Promise<{
    write(req: unknown): void;
    on(event: "data",  listener: (update: unknown) => void): unknown;
    on(event: "error", listener: (err: Error) => void): unknown;
    on(event: "end",   listener: () => void): unknown;
  }>;
}

export class NftHoldIndexer {
  // composite key "mint|wallet" → open slot
  // composite key is required: the same wallet can simultaneously hold
  // multiple mints from the collection, each with its own open period.
  private holders = new Map<string, bigint>();
  private times    = new Map<string, bigint>();
  private lastSlot = 0n;

  constructor(
    readonly client:   GeyserClient,
    readonly mints:    Set<string>,
    readonly excluded: Set<string> = new Set(),
  ) {}

  async run(): Promise<void> {
    const stream = await this.client.subscribe();

    await new Promise<void>((resolve, reject) => {
      stream.on("data", (u) => {
        const data = decodeUpdate(u as SubscribeUpdate);
        if (!data) return;

        if (data.type === "slot") {
          if (data.slot > this.lastSlot) this.lastSlot = data.slot;
          return;
        }

        if (!this.mints.has(data.mint)) return;

        const { mint, holder, amount, slot } = data;
        const k = this.key(mint, holder);

        switch (amount) {
          case 1n:
            if (!this.excluded.has(holder)) {
              this.holders.set(k, slot);
            }
            break;

          case 0n: {
            const startSlot = this.holders.get(k);
            if (startSlot === undefined) return;
            this.add(holder, slot - startSlot);
            this.holders.delete(k);
            break;
          }
        }
      });

      stream.on("error", reject);
      stream.on("end", () => {
        for (const [k, startSlot] of this.holders) {
          const wallet = k.split("|")[1];
          this.add(wallet, this.lastSlot - startSlot);
        }
        this.holders.clear();
        resolve();
      });

      // One named filter entry per mint — Geyser applies the memcmp on the
      // node side so only token accounts for our mints cross the wire.
      // Mint pubkey sits at byte offset 0 in the SPL token account layout.
      stream.write({
        accounts: Object.fromEntries(
          [...this.mints].map((mint) => [
            mint,
            {
              account: [],
              owner:   [TOKEN_PROGRAM_ID.toBase58()],
              filters: [{ memcmp: { offset: "0", bytes: mint } }],
            },
          ]),
        ),
        slots:      { all: {} },
        commitment: CommitmentLevel.PROCESSED,
      });
    });
  }

  holdSlots(wallet: string): number {
    if (this.excluded.has(wallet)) return 0;
    return Number(this.times.get(wallet) ?? 0n);
  }

  private key(mint: string, wallet: string): string {
    return `${mint}|${wallet}`;
  }

  private add(wallet: string, slots: bigint): void {
    this.times.set(wallet, (this.times.get(wallet) ?? 0n) + slots);
  }
}
