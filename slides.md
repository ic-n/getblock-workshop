## Slide 2 — What is Yellowstone gRPC

<title>What is Yellowstone gRPC</title>
<body>
* a direct *low latency* stream of on-chain events
* uses a Geyser plugin to stream from *validator memory*
* gRPC is a high performance protocol for realtime applications
</body>
<!-- that places your application as close to the events happening on blockchain as possible -->

---

## Slide 2.5 — As Close to the Chain as You Can Get

<title>Closer to the source</title>
<body>
<diagram>
Flowchart, top to bottom:

[Validator executes transaction]
↓
branches into two:

LEFT branch (gRPC path):
[Geyser plugin] → [YOUR APP]
label: ~instant, intra-slot

RIGHT branch (RPC path):
[Block produced (~400ms slot)] → [Block committed] → [RPC node indexes it] → [Your app polls / calls RPC] → [YOUR APP]
label: 400ms+ minimum, often seconds

Both branches converge at YOUR APP, but the left arrow arrives visibly first. The right path is longer, has more boxes — the point is obvious at a glance without reading a word.
</diagram>

</body>
<!-- This is exactly how serious trading bots outperform any bot that relies on RPC. -->
<!-- If your AI trading bot uses RPC polling, it is already in danger of being outplayed by a far less intelligent algorithm that simply reads events faster. -->
<!-- And let's be honest — RPC polling is the default for most AI agent frameworks. So if you're building AI trading, this should concern you. -->

---

## Slide 3 — "But I'll need a heavy ETL pipeline, right?"

<title>But I'll need a heavy ETL pipeline, right?</title>
<body>
* Subscribe only to what you need — accounts, transactions, programs
* Filter by account key, owner program, even data patterns
* Combine multiple filters in a single stream

What can you do with that?

- watch a wallet → react to its trades instantly
- monitor a program → catch every interaction as it happens
- track token accounts → build a live holders map with zero cron jobs
</body>
<!-- No heavy pipeline, no batch jobs. You open one connection, set your filters, and the data comes to you. -->
<!-- Think of it as a WHERE clause on the entire blockchain, but streaming. -->
<!-- The filtering happens server-side on the validator, so you're not drowning in data you don't need. -->

---

## Slide 4 — What this unlocks: MEV on Solana

<title>What this unlocks: MEV on Solana</title>
<body>
* *Mint protection* — see supply-threatening transactions before they land, react to protect your allocation
* *Copy trading* — mirror a whale's moves at processed commitment, before the block even confirms
* *Liquidations* — spot undercollateralized positions the moment the price account updates
* *Arbitrage* — detect price discrepancies across DEXs within the same slot
</body>
<!-- These are all forms of MEV — maximal extractable value. On Solana, MEV is driven by speed, not gas auctions like on Ethereum. -->
<!-- The common thread: whoever sees the event first, wins. Yellowstone puts you at the front of that line. -->
<!-- And notice — none of this requires complex infrastructure. It's the same subscribe pattern, different filters. -->

---

## Slide 5 — Real-time indexing, not batch jobs

<title>Real-time indexing, not batch jobs</title>
<body>
* instead of a cron job calling getProgramAccounts every hour...
* ...you have a live stream of every holder change as it happens
* aggregate anything: holders per hour, transfers per minute, portfolio snapshots
</body>
<!-- With RPC you either miss data between polls, or you do expensive lookback queries every single time. -->
<!-- With gRPC it's a running counter. NFT holders changed this hour? You already know, because you watched it happen. -->
<!-- This is what makes indexing with Yellowstone surprisingly straightforward — you're not reconstructing history, you're just keeping score. -->

---

## Slide 6 — Solana's clock: Slots, not blocks

<title>Solana's clock: Slots, not blocks</title>
<body>
<diagram>
Animated loop, cycling continuously:

A horizontal timeline of slots, each ~400ms apart.
Solana uses Proof of History — a cryptographic clock that ticks forward independently, without waiting for consensus. Validators don't synchronize clocks — PoH IS the clock.

Each slot is a scheduled window where a leader MAY produce a block:
[Slot 1: ✅ block] → [Slot 2: ✅ block] → [Slot 3: ❌ skipped] → [Slot 4: ✅ block] → [Slot 5: ❌ skipped] → [Slot 6: ✅ block] → ...

The animation loops, showing that slots tick at a fixed pace but blocks appear irregularly. Skipped slots are greyed out or empty.

Caption: "Slots tick every ~400ms. Blocks are not guaranteed."
</diagram>

</body>
<!-- If you come from Ethereum, you expect a block every 12 seconds like clockwork. Solana is fundamentally different. -->
<!-- There is no global clock sync. Proof of History is a cryptographic sequence — a verifiable delay function — that lets validators agree on time without talking to each other. -->
<!-- A slot is a ~400ms window where a designated leader can produce a block. But if the leader is slow or offline, that slot is skipped. No block. The clock moves on. -->
<!-- This is why RPC gives you a choppy, incomplete view. It only sees finished blocks. Yellowstone sees the slots themselves. -->

---

## Slide 7 — Commitment levels: speed vs certainty

<title>Commitment levels: speed vs certainty</title>
<body>
| Level | Meaning | Trade-off |
|---|---|---|
| `processed` | validator received & executing — may roll back | ⚡ fastest |
| `confirmed` | supermajority voted | ⚖️ balanced |
| `finalized` | full consensus, 31+ blocks deep, irreversible | 🔒 safest |

<animation>
Horizontal timeline of ~15 sequential slots, animating left to right over time:

Rightmost slots appear blinking/pulsing — these are PROCESSED (just seen by the validator)
After a beat, slots shift color to yellow — CONFIRMED (supermajority voted)
Further left, slots turn solid green — FINALIZED (31+ confirmed blocks built on top)
Occasional grey slots — skipped, no block

The whole strip scrolls slowly left, new slots appearing on the right. The visual impression: a gradient from uncertain (right) to permanent (left). The audience sees finality as a wave that moves through time.
</animation>

</body>
<!-- Choosing your commitment level is choosing your position on the speed-certainty spectrum. -->
<!-- For HFT, you want processed — you see the transaction the moment the leader touches it. Yes, it could roll back, but you're optimizing for reaction time. -->
<!-- For settlement or anything with real money consequences, finalized — 31 confirmed blocks on top, it's carved in stone. -->
<!-- Most apps? Confirmed is the sweet spot. -->

---

## Slide 8 — The numbers that should scare you

<title>The numbers that should scare you</title>
<body>
* slot = *400ms*
* block is *NOT guaranteed* in every slot
* at best, RPC users are *400ms behind* a Yellowstone user
* in practice — *seconds behind* when slots skip

> Unacceptable if you're competing for alpha.

</body>
<!-- Let that sink in. Four hundred milliseconds per slot. And slots can skip. -->
<!-- If you are polling RPC, you are waiting for a block to be produced, indexed, and served. That's the happy path. -->
<!-- When slots skip, that gap grows. Your competitor on Yellowstone already saw the event, already reacted, already submitted their transaction. -->
<!-- You're reading yesterday's newspaper. -->

---

## Slides 9–12 — Workshop (to be developed together)

_Parked for later. Plan agreed: MadLads NFT holders indexer, $BP allocation tracking, TypeScript + @triton-one/yellowstone-grpc._
