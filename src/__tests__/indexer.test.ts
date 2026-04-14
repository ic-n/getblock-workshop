import { describe, it, expect, afterEach } from "@jest/globals";
import { YellowStoneMock, MockClient } from "yellowstone-grpc-mock";
import { mintedNFT, transferNFT, slotUpdate } from "yellowstone-grpc-mock";
import { NftHoldIndexer } from "../indexer";

const MINT = "GkNkuozgNFN7K5AAjmFjMSFnNegpqkwEGbJyEXGq7LYR";
const MINT_B = "5ByhkuHZMH7sU36DhfNMjy78hSMTPKJ1UEdDJqoKkmrU";
const ALICE = "ALkD8o2AsHFMNGBMCFJzRr6J2xGk7UXpunGwRLiTvtGm";
const ESCROW = "9nJ7BWiAsNEHzFBtNXLFKFuJJupCdMwZ6xGZZNYPumpE";
const BOB = "3mEH6iBwWqZt94dVijMQEXTMv4GVhMT9BAnBHK7HEJKP";

const MARKETPLACE_ESCROWS = new Set([ESCROW]);

afterEach(() => {
  try {
    new YellowStoneMock().reset();
  } catch {
    /* no active mock */
  }
});

function makeIndexer(mints = new Set([MINT])): NftHoldIndexer {
  return new NftHoldIndexer(
    new MockClient("https://mock", "token"),
    mints,
    MARKETPLACE_ESCROWS
  );
}

describe("NftHoldIndexer", () => {
  it("measures hold from mint to first outbound transfer", async () => {
    // Period 1: Alice mints and holds for 1 slot before transferring to Bob.
    //   alice_token_1 @ S+1 → opens ALICE
    //   alice_token_0 @ S+2 → closes ALICE, hold = 1
    const ysm = new YellowStoneMock();
    ysm
      .push(mintedNFT(MINT, ALICE))
      .push(transferNFT(MINT, ALICE, BOB))
      .push(slotUpdate())
      .end();

    const indexer = makeIndexer();
    await indexer.run();

    expect(indexer.checkAllocation(ALICE)).toBe(1);
  });

  it("excludes escrow address from hold allocation", async () => {
    // ESCROW receives the NFT but must accrue zero hold time.
    //   alice_token_1 @ S+1 → opens ALICE
    //   alice_token_0 @ S+2 → closes ALICE (1 slot)
    //   escrow_token_1 @ S+3 → excluded, not opened
    const ysm = new YellowStoneMock();
    ysm
      .push(mintedNFT(MINT, ALICE))
      .push(transferNFT(MINT, ALICE, ESCROW))
      .push(slotUpdate())
      .end();

    const indexer = makeIndexer();
    await indexer.run();

    expect(indexer.checkAllocation(ESCROW)).toBe(0);
    expect(indexer.checkAllocation(ALICE)).toBe(1);
  });

  it("closes current holder's period at stream EOF (end of subscription)", async () => {
    // Period 3: Bob is holding when the subscription ends.
    // His hold closes at lastSlot (the slotUpdate), not a transfer event.
    //   bob_token_1 @ S+3 → opens BOB
    //   slotUpdate  @ S+4 → lastSlot = S+4
    //   EOF: BOB hold = S+4 - S+3 = 1
    const ysm = new YellowStoneMock();
    ysm
      .push(mintedNFT(MINT, ALICE))
      .push(transferNFT(MINT, ALICE, BOB))
      .push(slotUpdate())
      .end();

    const indexer = makeIndexer();
    await indexer.run();

    expect(indexer.checkAllocation(BOB)).toBe(1);
  });

  // ── Integration: full MadLads airdrop allocation scenario ──────────────────

  it("full scenario: mint → ALICE → escrow listing → BOB (end of subscription)", async () => {
    // Slot trace (S = 280_000_000):
    //   S+0  mint account             (mintedNFT 1/2)
    //   S+1  ALICE token amount=1     (mintedNFT 2/2)   → ALICE opens
    //   S+2  ALICE token amount=0     (1st transfer 1/2)→ ALICE closes, 1 slot
    //   S+3  ESCROW token amount=1    (1st transfer 2/2)→ excluded
    //   S+4  ESCROW token amount=0    (2nd transfer 1/2)→ no open hold, skip
    //   S+5  BOB token amount=1       (2nd transfer 2/2)→ BOB opens
    //   S+6  slot update              → lastSlot = S+6
    //   EOF  BOB hold closes at S+6, 1 slot
    const ysm = new YellowStoneMock();
    ysm
      .push(mintedNFT(MINT, ALICE))
      .push(transferNFT(MINT, ALICE, ESCROW))
      .push(transferNFT(MINT, ESCROW, BOB))
      .push(slotUpdate())
      .end();

    const indexer = makeIndexer();
    await indexer.run();

    expect(indexer.checkAllocation(ALICE)).toBe(1); // mint → listing
    expect(indexer.checkAllocation(ESCROW)).toBe(0); // program — no allocation
    expect(indexer.checkAllocation(BOB)).toBe(1); // purchase → stream end
  });

  it("accumulates across multiple hold periods for the same wallet (re-buy)", async () => {
    // ALICE buys, sells to BOB, buys back.
    //   S+1: ALICE opens
    //   S+2: ALICE closes (1 slot), BOB... wait, transferNFT(ALICE, BOB):
    //     alice_token_0 @ S+2 → ALICE closes
    //     bob_token_1   @ S+3 → BOB opens
    //   transferNFT(BOB, ALICE):
    //     bob_token_0   @ S+4 → BOB closes (1 slot)
    //     alice_token_1 @ S+5 → ALICE opens again
    //   slotUpdate @ S+6 → lastSlot = S+6
    //   EOF: ALICE second hold = 1 slot → total = 2 slots
    const ysm = new YellowStoneMock();
    ysm
      .push(mintedNFT(MINT, ALICE))
      .push(transferNFT(MINT, ALICE, BOB))
      .push(transferNFT(MINT, BOB, ALICE))
      .push(slotUpdate())
      .end();

    const indexer = makeIndexer();
    await indexer.run();

    expect(indexer.checkAllocation(ALICE)).toBe(2); // (S+2 - S+1) + (S+6 - S+5) = 1 + 1
    expect(indexer.checkAllocation(BOB)).toBe(1); // S+4 - S+3 = 1
  });

  it("accumulates hold across two mints held simultaneously by the same wallet", async () => {
    // ALICE holds MINT and MINT_B at the same time.
    // Without the composite key this would corrupt one of the open slots.
    //
    //   S+0  mint_a account                (mintedNFT MINT 1/2)
    //   S+1  ALICE token_a amount=1        (mintedNFT MINT 2/2)  → MINT|ALICE opens @S+1
    //   S+2  mint_b account                (mintedNFT MINT_B 1/2)
    //   S+3  ALICE token_b amount=1        (mintedNFT MINT_B 2/2)→ MINT_B|ALICE opens @S+3
    //   S+4  ALICE token_a amount=0        (transfer MINT 1/2)   → MINT|ALICE closes, 3 slots
    //   S+5  BOB   token_a amount=1        (transfer MINT 2/2)   → MINT|BOB opens @S+5
    //   S+6  ALICE token_b amount=0        (transfer MINT_B 1/2) → MINT_B|ALICE closes, 3 slots
    //   S+7  BOB   token_b amount=1        (transfer MINT_B 2/2) → MINT_B|BOB opens @S+7
    //   S+8  slot update                   → lastSlot = S+8
    //   EOF  MINT|BOB: S+8-S+5=3, MINT_B|BOB: S+8-S+7=1 → BOB total = 4
    const ysm = new YellowStoneMock();
    ysm
      .push(mintedNFT(MINT, ALICE))
      .push(mintedNFT(MINT_B, ALICE))
      .push(transferNFT(MINT, ALICE, BOB))
      .push(transferNFT(MINT_B, ALICE, BOB))
      .push(slotUpdate())
      .end();

    const indexer = makeIndexer(new Set([MINT, MINT_B]));
    await indexer.run();

    expect(indexer.checkAllocation(ALICE)).toBe(6); // (S+4-S+1) + (S+6-S+3) = 3+3
    expect(indexer.checkAllocation(BOB)).toBe(4); // (S+8-S+5) + (S+8-S+7) = 3+1
  });
});
