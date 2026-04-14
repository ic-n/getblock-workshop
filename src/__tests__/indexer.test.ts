/**
 * NftHoldIndexer — TDD test suite
 *
 * Scenario: MadLads NFT allocation for a $BP airdrop.
 *
 * Slot layout (mock counter starts at 280_000_000, +1 per factory):
 *
 *   mintedNFT(MINT, ALICE)          → [mint_acct@S+0, alice_token_1@S+1]
 *   transferNFT(MINT, ALICE, ESCROW)→ [alice_token_0@S+2, escrow_token_1@S+3]
 *   transferNFT(MINT, ESCROW, BOB)  → [escrow_token_0@S+4, bob_token_1@S+5]
 *   slotUpdate()                    → [slot@S+6]
 *
 * Hold periods:
 *   ALICE  : S+1 → S+2  = 1 slot   (mint to outbound transfer)
 *   ESCROW : excluded               (marketplace program — zero allocation)
 *   BOB    : S+5 → S+6  = 1 slot   (inbound transfer to stream EOF)
 */

import { describe, it, expect, afterEach } from "@jest/globals";
import { YellowStoneMock, MockClient } from "yellowstone-grpc-mock";
import { mintedNFT, transferNFT, slotUpdate } from "yellowstone-grpc-mock";
import { NftHoldIndexer } from "../indexer";

// ── Test fixtures ─────────────────────────────────────────────────────────────
// Real 32-byte base58 keys repurposed as test labels.

const MINT = "GkNkuozgNFN7K5AAjmFjMSFnNegpqkwEGbJyEXGq7LYR"; // stands in for MadLads mint
const ALICE = "5ByhkuHZMH7sU36DhfNMjy78hSMTPKJ1UEdDJqoKkmrU"; // primary holder
const ESCROW = "9nJ7BWiAsNEHzFBtNXLFKFuJJupCdMwZ6xGZZNYPumpE"; // marketplace escrow (excluded)
const BOB = "3mEH6iBwWqZt94dVijMQEXTMv4GVhMT9BAnBHK7HEJKP"; // secondary buyer

const MARKETPLACE_ESCROWS = new Set([ESCROW]);

afterEach(() => {
  try {
    new YellowStoneMock().reset();
  } catch {
    /* no active mock */
  }
});

function makeIndexer(): NftHoldIndexer {
  return new NftHoldIndexer(
    new MockClient("https://mock", "token"),
    MINT,
    MARKETPLACE_ESCROWS
  );
}

// ── Unit cases ────────────────────────────────────────────────────────────────

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

    expect(indexer.holdSlots(ALICE)).toBe(1);
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

    expect(indexer.holdSlots(ESCROW)).toBe(0);
    expect(indexer.holdSlots(ALICE)).toBe(1);
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

    expect(indexer.holdSlots(BOB)).toBe(1);
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

    expect(indexer.holdSlots(ALICE)).toBe(1); // mint → listing
    expect(indexer.holdSlots(ESCROW)).toBe(0); // program — no allocation
    expect(indexer.holdSlots(BOB)).toBe(1); // purchase → stream end
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

    expect(indexer.holdSlots(ALICE)).toBe(2); // (S+2 - S+1) + (S+6 - S+5) = 1 + 1
    expect(indexer.holdSlots(BOB)).toBe(1); // S+4 - S+3 = 1
  });
});
