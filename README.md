# Real-time NFT Holders Indexer — GetBlock Workshop

A live demo built for a developer workshop on **Yellowstone gRPC** (Solana's real-time event stream). It simulates a production NFT indexer that tracks holder balances and allocates tokens based on hold duration — running entirely offline with a mock adapter so you can present it without a live RPC connection.

The punchline: **swapping the mock for a real Yellowstone adapter is a one-file change.**

---

## What it does

- Streams simulated on-chain events (mint, list, unlist, purchase) through an adapter interface
- Indexes current NFT ownership and computes token allocation in real time
- Renders a live trading-terminal dashboard: mint log, marketplace grid, event log, leaderboard
- Leaderboard updates every tick with rank-change indicators (↑↓) and token totals

---

## Architecture

```
[Faker agents] ──► [MockAdapter] ──► [AllocationEngine] ──► [NestJS SSE] ──► [React Dashboard]
                        │
                  same interface as
                        │
               [YellowstoneAdapter]  ← swap this one file to go live
```

The engine knows nothing about where events come from. It only talks to the `Adapter` interface:

```typescript
interface Adapter {
  on(event: 'nft_event', listener: (e: NFTEvent) => void): this;
  off(event: 'nft_event', listener: (e: NFTEvent) => void): this;
  start(): void;
  stop(): void;
}
```

`MockAdapter` implements it with simulated agents. A real `YellowstoneAdapter` would implement the same interface, subscribing to a Yellowstone gRPC stream and emitting the same `NFTEvent` shape.

---

## Project structure

```
shared/
  types.ts              # All TypeScript types + Adapter interface (shared by frontend & backend)

server/
  main.ts               # NestJS bootstrap (port 3001)
  app.module.ts
  indexer.service.ts    # Wires MockAdapter → AllocationEngine, runs tick loop
  events.controller.ts  # GET /events (SSE), POST /simulate, GET /status
  engine.ts             # Allocation engine — pure event processing + token math
  faker.ts              # Simulated agents + NFT lifecycle
  mock-adapter.ts       # Implements Adapter interface with the faker

src/
  App.tsx               # Root layout + start-simulation splash screen
  hooks/useSse.ts       # EventSource → StateSnapshot React hook
  components/
    Navbar.tsx          # Slot counter, tick rate, total tokens, mint progress
    MarketplaceGrid.tsx # Listed NFT cards with MadLad pfps
    EventLog.tsx        # Combined mint + event log (newest first)
    Leaderboard.tsx     # Token allocation table with rank-change indicators
  lib/fmt.ts            # agentLabel(), sinceMs(), fmtTokens() helpers

scripts/
  cache-images.mjs      # Pre-downloads MadLad images to public/images/
```

---

## Prerequisites

- Node.js 20+
- pnpm (`npm i -g pnpm`)

---

## Setup

```bash
# Install dependencies
pnpm install

# Pre-cache MadLad NFT images locally (avoids S3 requests during the demo)
pnpm cache-images
```

---

## Running

Open two terminals:

```bash
# Terminal 1 — backend (NestJS, port 3001)
pnpm server:dev

# Terminal 2 — frontend (Vite, port 5173)
pnpm dev
```

Open `http://localhost:5173`, wait for the green pulse, then click **Start Simulation**.

The server logs every on-chain event to the console so you can verify allocation math live:

```
[slot 12] MINT     MadLad #7  | (mint) → WALLET_3_AB12XY
[slot 13] LIST     MadLad #7  | WALLET_3_AB12XY → MAGIC_EDEN_PRO
[slot 14] PURCHASE MadLad #7  | MAGIC_EDEN_PRO → WALLET_11_ZZ99
```

---

## Config

All knobs are in `shared/types.ts`:

```typescript
export const DEFAULT_CONFIG: Config = {
  TICK_RATE_MS: 800,       // how often the faker ticks
  COLLECTION_SIZE: 30,     // total NFTs — mint phase lasts ~20-30s
  INITIAL_AGENTS: 20,      // wallets at start
  NEW_AGENT_CHANCE: 0.08,  // probability of a new agent joining per tick
  TOKENS_PER_SECOND: 200,  // total emission rate, split across held NFTs
};
```

---

## Going live with real Yellowstone gRPC

1. Install the Triton client:
   ```bash
   pnpm add @triton-one/yellowstone-grpc
   ```

2. Create `server/yellowstone-adapter.ts` that implements `Adapter`:
   ```typescript
   import Client from '@triton-one/yellowstone-grpc';
   import { EventEmitter } from 'node:events';
   import type { Adapter, NFTEvent } from '../shared/types';

   export class YellowstoneAdapter extends EventEmitter implements Adapter {
     private client: Client;

     constructor(endpoint: string, token: string) {
       super();
       this.client = new Client(endpoint, token, {});
     }

     start(): void {
       // Subscribe to account updates for your NFT program
       // Parse each update into an NFTEvent and emit it:
       //   this.emit('nft_event', event);
     }

     stop(): void { /* close stream */ }
   }
   ```

3. In `server/indexer.service.ts`, swap one line:
   ```typescript
   // Before:
   private readonly adapter = new MockAdapter(this.config);
   // After:
   private readonly adapter = new YellowstoneAdapter(ENDPOINT, TOKEN);
   ```

The engine, the dashboard, and every other file stay exactly the same.

---

## Workshop slides

See [`slides.md`](slides.md) for the presentation outline accompanying this demo.
