import { CommitmentLevel, SubscribeUpdate } from "@triton-one/yellowstone-grpc";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { decodeUpdate } from "./decoder";

export interface GeyserClient {
  subscribe(): Promise<{
    write(req: unknown): void;
    on(event: "data", listener: (update: unknown) => void): unknown;
    on(event: "error", listener: (err: Error) => void): unknown;
    on(event: "end", listener: () => void): unknown;
  }>;
}

export class NftHoldIndexer {
  constructor(
    readonly client: GeyserClient,
    readonly mints: Set<string>,
    readonly excluded: Set<string> = new Set()
  ) {}

  async run(): Promise<void> {
    const stream = await this.client.subscribe();

    await new Promise<void>((resolve, reject) => {
      stream.on("data", (u) => {
        // todo
      });

      stream.on("error", reject);
      stream.on("end", () => resolve());

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

  holdSlots(wallet: string): number {
    return 0;
  }
}
