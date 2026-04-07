# Yellowstone gRPC Workshop — NFT Holders Indexer

## What this is

A live demo for a dev workshop presentation. It simulates a real-time NFT indexer built on Solana's Yellowstone gRPC, but runs entirely offline with fabricated data. The audience should believe it's real until we reveal the adapter pattern.

The message: **it is surprisingly easy to build a real-time NFT indexer with Yellowstone gRPC.**

## Architecture

```
[Faker/Agents] → [Mock Adapter] → [Indexer Engine] → [Frontend Dashboard]
                        ↑
              same interface as
                        ↑
              [Real Yellowstone Adapter] (not implemented, but the seam is obvious)
```

The key design decision: the indexer engine talks to an **adapter interface**. The mock adapter injects fake events. To go live, you swap one file. That's the whole point.

## Tech stack

- TypeScript (Node.js backend)
- React frontend (single page dashboard)
- No database — everything in memory
- No actual gRPC connection — mocked via adapter

## Core concepts

### Adapter interface

A simple interface that emits on-chain events. Two implementations exist in the codebase:

1. `MockAdapter` — generates fake events from simulated agents (this is what we use)
2. The real adapter would use `@triton-one/yellowstone-grpc` — we don't build it, but the interface makes it obvious how

### Events the adapter emits

- `MINT` — NFT minted to a wallet
- `TRANSFER` — NFT moved from one wallet to another
- `LIST` — NFT transferred to the marketplace program address (escrow)
- `UNLIST` — NFT transferred back from marketplace to the wallet
- `PURCHASE` — NFT transferred from marketplace to a buyer wallet

Under the hood, LIST/UNLIST/PURCHASE are all just transfers. The indexer determines the event type by checking if source or destination is the marketplace program address.

### Allocation engine

Distributes tokens continuously to NFT holders based on hold duration:

- Rate: configurable tokens per second, split equally across all currently-held NFTs
- Holding 1 NFT for 10 seconds == holding 2 NFTs for 5 seconds
- When an NFT is listed (transferred to marketplace address), allocation STOPS for that NFT
- When an NFT is unlisted (transferred back), allocation RESUMES
- No upper cap on total tokens allocated — it runs indefinitely

### Smart contract / program address filter

The marketplace (e.g., Magic Eden) is represented as a single special address in the system. It has the same shape as an agent but is flagged as a program. NFTs held by this address do NOT earn allocation. This is the only program address; all other addresses are wallets.

### Faker / simulated agents

- Start with 30 agents
- Each tick, there is a small chance a NEW agent joins (random)
- Each tick, each agent rolls a weighted dice:
  - **Do nothing** (weight 4x) — most common
  - **Mint an NFT** — if mint is not sold out. Agents can mint more than one over time
  - **List an NFT** — if they hold any unlisted NFT. Transfers to marketplace address
  - **Unlist an NFT** — if they have any listed NFT. Transfers back from marketplace
  - **Buy a listed NFT** — if mint is sold out AND there are listed NFTs available. Transfers from marketplace to buyer
- If mint is sold out, "mint" action attempts become "buy" actions instead

### Configurable variables (top of config file)

```typescript
const CONFIG = {
  TICK_RATE_MS: 1000, // how often the faker ticks (ms)
  COLLECTION_SIZE: 80, // total NFTs in the collection
  INITIAL_AGENTS: 30, // agents at start
  NEW_AGENT_CHANCE: 0.05, // probability of new agent per tick
  TOKENS_PER_SECOND: 100, // total token emission rate per second, split across all held NFTs
};
```

## Frontend dashboard

Single page, multi-column layout. Should feel like a live trading terminal.

### Navbar / top bar

- Slot counter (incrementing each tick, ties back to Solana slot concept from the presentation)
- Current tick rate display
- Total tokens allocated so far
- Total NFTs minted / collection size

### Columns (left to right)

1. **Mint Log** — scrolling list of mint events. Format: `Agent_12 minted MadLad #42`. New entries appear at top. Shows most recent ~20 entries.

2. **Marketplace Grid** — grid of currently listed NFTs. Each card shows: NFT id, listed by whom, how long listed. Cards appear when listed, disappear when bought or unlisted.

3. **Event Log** — scrolling list of all non-mint events (list, unlist, purchase, transfer). Format: `Agent_05 listed MadLad #17` / `Agent_22 bought MadLad #17 from Agent_05`. New entries at top. Shows most recent ~20 entries.

4. **Leaderboard** — sorted table of current token allocation. Columns: rank, agent name, NFTs held count, tokens allocated. Updates every tick. Top holders highlighted. This is the star of the dashboard.

## Phases

### Phase 1: Types & interfaces

Define all TypeScript types and the adapter interface.

- `NFT`, `Agent`, `Event`, `EventType` types
- `Adapter` interface with event emitter pattern
- `Config` type and defaults
- Keep it in one file: `src/types.ts`

### Phase 2: Allocation engine

The core logic that processes events and computes token distribution.

- In-memory state: who holds what NFT, since when
- On each tick (or event): recalculate allocation based on hold duration
- Listed NFTs excluded from allocation
- File: `src/engine.ts`
- Should be testable standalone — feed it events, check allocations

### Phase 3: Faker & mock adapter

The simulated agents and event generator.

- Agent dice rolls per tick
- Mint → transfer → list/unlist/buy lifecycle
- Implements the same adapter interface
- Emits events that the engine consumes
- File: `src/faker.ts` and `src/mock-adapter.ts`

### Phase 4: Wire backend together

- Connect mock adapter → engine
- Run the tick loop
- Expose state via websocket or SSE to the frontend
- Entry point: `src/server.ts`
- At this point, running the server should print events to console and you can verify the allocation math

### Phase 5: Frontend dashboard

- React app with the 4-column layout described above
- Connects to backend via websocket/SSE
- Renders live-updating state
- Should look polished — dark theme, monospace fonts, trading terminal aesthetic
- File: `src/app/` or single-file React artifact

### Phase 6: Tuning & polish

- Adjust CONFIG values so the demo runs well in ~3-5 minutes of screen time
- Mint phase should be quick (~30 seconds), then secondary market takes over
- Leaderboard should show meaningful movement and rank changes
- Add visual flair: rank change indicators (↑↓), token count animations, color coding

## Important constraints

- Every line of code should serve the message: "this is easy to build with Yellowstone"
- The indexer code (engine.ts) should be **dead simple**. If a line doesn't directly serve event processing or allocation, remove it.
- The faker is allowed to be more complex — it's behind the curtain
- No external dependencies beyond React and a websocket library
- No database, no persistence, no auth, no error recovery — this is a demo
- The adapter interface is the hero of the architecture. It should be obvious that swapping MockAdapter for a real YellowstoneAdapter is trivial
