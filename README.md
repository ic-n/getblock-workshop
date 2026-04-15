# Real-time NFT Hold Indexer — GetBlock Workshop

LINKS:

- My Linked-in (https://www.linkedin.com/in/niklone/)[https://www.linkedin.com/in/niklone/]
- My Twitter (https://x.com/nikyola_demonke)[https://x.com/nikyola_demonke]
- How to Track Pump.fun Mints in Real-Time with Solana gRPC Geyser Plugin via GetBlock (https://www.youtube.com/watch?v=AZotjvQpGjg)[https://www.youtube.com/watch?v=AZotjvQpGjg]

A workshop demo for **Yellowstone gRPC** (Solana's real-time event stream). It indexes how long each wallet holds a specific NFT mint and computes token allocation based on hold duration — fully testable offline with a gRPC mock, no live RPC connection required.

The punchline: **swapping the mock for a real Yellowstone client is a one-line change.**

---

## What it does

- Streams on-chain token account updates (mint, transfer) through a `GeyserClient` interface
- Decodes raw SPL account data from the Yellowstone protobuf wire format
- Tracks three hold period types per wallet:
  1. Mint → first outgoing transfer
  2. Inbound transfer → next outgoing transfer
  3. Inbound transfer → stream EOF (current holder at subscription end)
- Excludes marketplace escrow programs from allocation
- Accumulates hold duration in slots (1 slot ≈ 400 ms)

---

## Architecture

```
[YellowStoneMock] ──► [GeyserClient interface] ──► [NftHoldIndexer]
        │                                                   │
  same interface as                                holdSlots(wallet)
        │
[real Client]  ← swap this one line to go live
```

The indexer knows nothing about where the stream comes from. It only talks to `GeyserClient`:

```typescript
interface GeyserClient {
  subscribe(): Promise<{
    write(req: unknown): void;
    on(event: "data",  listener: (update: unknown) => void): unknown;
    on(event: "error", listener: (err: Error) => void): unknown;
    on(event: "end",   listener: () => void): unknown;
  }>;
}
```

`MockClient` from `yellowstone-grpc-mock` implements this interface for tests. The real `Client` from `@triton-one/yellowstone-grpc` satisfies it in production.

---

## Project structure

```
src/
  decoder.ts              # Pure function: SubscribeUpdate → DecodedUpdate | null
  indexer.ts              # NftHoldIndexer class + GeyserClient interface
  __tests__/
    indexer.test.ts       # 5 TDD tests — all hold period types + escrow exclusion
jest.config.js
tsconfig.json
package.json
docs/                     # Yellowstone gRPC API reference
```

---

## Prerequisites

- Node.js 20+
- pnpm (`npm i -g pnpm`)

---

## Setup

```bash
pnpm install
```

---

## Running the tests

```bash
pnpm test
```

Output:

```
 PASS  src/__tests__/indexer.test.ts
  NftHoldIndexer
    ✓ measures hold from mint to first outbound transfer
    ✓ excludes escrow address from hold allocation
    ✓ closes current holder's period at stream EOF (end of subscription)
    ✓ full scenario: mint → ALICE → escrow listing → BOB (end of subscription)
    ✓ accumulates across multiple hold periods for the same wallet (re-buy)
```

---

## How decoding works

Yellowstone streams raw `SubscribeUpdate` protobuf messages. For each account update the decoder:

1. Checks the account owner is the SPL Token Program
2. Checks data length is exactly 165 bytes (SPL token account layout)
3. Decodes with `AccountLayout` from `@solana/spl-token`
4. Returns `{ mint, holder, amount, slot }` — or `null` for anything else

Slot values arrive as strings (`"280000000"`) from the protobuf runtime. `BigInt()` handles this transparently.

---

## How the mock works

`yellowstone-grpc-mock` serializes real on-chain byte layouts using the same libraries the indexer uses at runtime. Tests exercise the full decode pipeline, not just business logic:

```typescript
const ysm = new YellowStoneMock();
ysm
  .push(mintedNFT(MINT, ALICE))
  .push(transferNFT(MINT, ALICE, ESCROW))
  .push(transferNFT(MINT, ESCROW, BOB))
  .push(slotUpdate())
  .end();

const indexer = new NftHoldIndexer(new MockClient("https://mock", "token"), MINT, escrows);
await indexer.run();

expect(indexer.holdSlots(ALICE)).toBe(1);
expect(indexer.holdSlots(ESCROW)).toBe(0); // excluded
expect(indexer.holdSlots(BOB)).toBe(1);
```

Playback starts only when the indexer sends its first `SubscribeRequest` — matching real Geyser behavior.

---

## Going live with real Yellowstone gRPC

In `src/indexer.ts`, the `run()` method constructs a subscribe request and processes any `GeyserClient`. To point it at a real node, pass the real client:

```typescript
import Client from "@triton-one/yellowstone-grpc";
import { NftHoldIndexer } from "./src/indexer";

const ENDPOINT = "https://go.getblock.io/<YOUR_ACCESS_TOKEN>/";
const TOKEN    = "<YOUR_ACCESS_TOKEN>";

const client  = new Client(ENDPOINT, TOKEN, {});
const MADLADS = "J1S9H3QjnRtBbbuD4HjPV6RpRhwuk4zKbxsnCHuTgh9w";
const ESCROWS = new Set(["<MAGIC_EDEN_ESCROW>", "<TENSOR_ESCROW>"]);

const indexer = new NftHoldIndexer(client, MADLADS, ESCROWS);
await indexer.run();
```

Nothing else changes — the decoder, the hold logic, and the tests all stay exactly the same.

GetBlock provides managed Yellowstone gRPC endpoints as an add-on to Dedicated Solana Node subscriptions. See the [docs](./docs/Quickstart%20guide.md) for endpoint setup.

---

## Key design decisions

**`GeyserClient` interface instead of a concrete import** — the indexer never imports `Client` directly, so mocking requires no `jest.mock()` wiring. Pass whatever satisfies the interface.

**`excludedAddresses: Set<string>` on the constructor** — escrow exclusion is explicit and testable. Pass the known program addresses for any marketplace.

**Hold closes at `lastSlot` on EOF** — the highest slot tick seen on the stream is used as the end-of-subscription timestamp for any wallet still holding when the stream closes.

**Burn = hold forever** — a burned NFT's token account goes to `amount=0` with no subsequent `amount=1`, so the hold period never closes. By design, this counts as indefinite holding for allocation purposes.
