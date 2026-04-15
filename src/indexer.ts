import { CommitmentLevel, SubscribeUpdate } from "@triton-one/yellowstone-grpc";
import {
  ACCOUNT_SIZE,
  AccountLayout,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import base58 from "bs58";

export interface GeyserClient {
  subscribe(): Promise<{
    write(req: unknown): void;
    on(event: "data", listener: (update: unknown) => void): unknown;
    on(event: "error", listener: (err: Error) => void): unknown;
    on(event: "end", listener: () => void): unknown;
  }>;
}

export class NftHoldIndexer {
  activeHolders = new Map<string, bigint>(); // address => start slot
  allocation = new Map<string, number>(); // address => current allocation

  lastSlot = -1n;

  constructor(
    readonly client: GeyserClient,
    readonly mints: Set<string>,
    readonly excluded: Set<string> = new Set()
  ) {}

  async run(): Promise<void> {
    const stream = await this.client.subscribe();

    await new Promise<void>((resolve, reject) => {
      stream.on("data", (u) => this.onData(u as SubscribeUpdate));
      stream.on("error", reject);
      stream.on("end", () => {
        this.onEnd();
        resolve();
      });

      // start streaming with filters
      stream.write({
        accounts: Object.fromEntries(
          [...this.mints].map((mint) => [
            mint,
            {
              account: [],
              owner: [TOKEN_PROGRAM_ID.toBase58()],
              filters: [{ memcmp: { offset: "0", bytes: mint } }],
            },
          ])
        ),
        slots: { all: {} },
        commitment: CommitmentLevel.PROCESSED,
      });
    });
  }

  onData(u: SubscribeUpdate) {
    if (u.slot) {
      this.lastSlot = BigInt(u.slot.slot);
      return;
    }

    if (!u.account) return;

    const slot = BigInt(u.account.slot);

    if (slot > this.lastSlot) this.lastSlot = slot;

    if (!u.account.account) return;
    if (base58.encode(u.account.account.owner) !== TOKEN_PROGRAM_ID.toBase58())
      return;

    if (u.account.account.data.length !== ACCOUNT_SIZE) return;

    const message = AccountLayout.decode(Buffer.from(u.account.account.data));
    const address = message.owner.toBase58();
    const mint = message.mint.toBase58();
    const key = `${address}\n${mint}`;

    if (this.excluded.has(address)) return;

    switch (message.amount) {
      case 0n: // no longer has nft
        const startSlot = this.activeHolders.get(key);
        if (!startSlot) return;

        const deltaTime = slot - startSlot;

        const currentAllocation = this.allocation.get(address) ?? 0;

        this.allocation.set(address, currentAllocation + Number(deltaTime));

        this.activeHolders.delete(key);

        break;

      case 1n: // just bought nft
        this.activeHolders.set(key, slot);
        break;

      default:
        break;
    }
  }

  onEnd() {
    for (const [k, v] of this.activeHolders) {
      const address = k.split("\n").at(0)!;
      const startSlot = v;

      const deltaTime = this.lastSlot - startSlot;

      const currentAllocation = this.allocation.get(address) ?? 0;

      this.allocation.set(address, currentAllocation + Number(deltaTime));
    }

    this.activeHolders.clear();
  }

  checkAllocation(wallet: string): number {
    return this.allocation.get(wallet) ?? 0;
  }
}
