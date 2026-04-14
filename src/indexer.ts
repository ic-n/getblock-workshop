import { CommitmentLevel } from "@triton-one/yellowstone-grpc";
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

/**
 * TODO: Implement NftHoldIndexer.
 *
 * It subscribes to a Yellowstone gRPC stream and computes how long each
 * wallet held a specific NFT mint. Three hold period types:
 *
 *   1. Mint event → first outgoing transfer
 *   2. Inbound transfer → next outgoing transfer
 *   3. Inbound transfer → stream EOF (current holder at subscription end)
 *
 * Wallets in excludedAddresses accrue zero hold time (marketplace escrows).
 * Duration unit: slots.
 *
 * Hints:
 *   - call this.client.subscribe() to get the stream
 *   - set up stream.on("data" / "error" / "end") BEFORE calling stream.write()
 *   - use decodeUpdate() on each data event — it returns null for irrelevant updates
 *   - track openHolds: Map<wallet, openSlot> and accumulated: Map<wallet, totalSlots>
 *   - on "end": close any open holds at lastSlot
 */
export class NftHoldIndexer {
  // TODO: add state — openHolds, accumulated, lastSlot

  constructor(
    readonly client: GeyserClient,
    readonly mint: string,
    readonly excluded: Set<string> = new Set(),
  ) {}

  async run(): Promise<void> {
    // TODO
  }

  holdSlots(wallet: string): number {
    return 0;
  }
}
