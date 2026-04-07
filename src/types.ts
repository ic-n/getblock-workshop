// ─────────────────────────────────────────────────────────────────────────────
// Config
// ─────────────────────────────────────────────────────────────────────────────

export interface Config {
  TICK_RATE_MS: number; // how often the faker ticks (ms)
  COLLECTION_SIZE: number; // total NFTs in the collection
  INITIAL_AGENTS: number; // agents at start
  NEW_AGENT_CHANCE: number; // probability of new agent per tick (0–1)
  TOKENS_PER_SECOND: number; // total token emission rate, split across held NFTs
}

export const DEFAULT_CONFIG: Config = {
  TICK_RATE_MS: 1600, // faster ticks = snappier feel
  COLLECTION_SIZE: 30, // ~24 ticks to mint out → ~20s mint phase, then secondary market
  INITIAL_AGENTS: 20, // enough wallets for visible leaderboard competition
  NEW_AGENT_CHANCE: 0.08, // steady trickle of new participants
  TOKENS_PER_SECOND: 200, // bigger numbers → more dramatic leaderboard movement
};

// ─────────────────────────────────────────────────────────────────────────────
// Core domain types
// ─────────────────────────────────────────────────────────────────────────────

export type EventType = "MINT" | "TRANSFER" | "LIST" | "UNLIST" | "PURCHASE";

export interface NFT {
  id: number; // sequential index within the collection (0-based)
  name: string; // display name, e.g. "MadLad #42"
  owner: string; // current owner address
  listed: boolean; // true while held by the marketplace program
}

/**
 * An agent is either a user wallet or the marketplace program.
 * The marketplace is the only address with isProgram = true.
 * NFTs held by a program address do NOT earn token allocation.
 */
export interface Agent {
  address: string;
  name: string; // display name, e.g. "Agent_12" or "Magic Eden"
  isProgram: boolean;
}

export interface NFTEvent {
  type: EventType;
  nftId: number;
  nftName: string;
  from: string; // source address — empty string for MINT
  to: string; // destination address
  slot: number; // simulated Solana slot
  timestamp: number; // Unix ms
}

// ─────────────────────────────────────────────────────────────────────────────
// Adapter interface  ←  the hero of the architecture
//
// MockAdapter and (hypothetical) YellowstoneAdapter both implement this.
// Swapping one for the other is the entire point of the demo.
// ─────────────────────────────────────────────────────────────────────────────

export interface Adapter {
  /** Subscribe to on-chain (or simulated) NFT events. */
  on(event: "nft_event", listener: (e: NFTEvent) => void): this;
  /** Remove a previously registered listener. */
  off(event: "nft_event", listener: (e: NFTEvent) => void): this;
  /** Start producing events. */
  start(): void;
  /** Stop producing events. */
  stop(): void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Frontend state snapshot (sent over WebSocket / SSE each tick)
// ─────────────────────────────────────────────────────────────────────────────

export interface HolderEntry {
  address: string;
  name: string;
  nftsHeld: number;
  tokensAllocated: number;
}

export interface MarketplaceEntry {
  nftId: number;
  nftName: string;
  listedBy: string; // seller name
  listedAt: number; // Unix ms — used to show "listed Xs ago"
}

export interface StateSnapshot {
  slot: number;
  tickRateMs: number;
  totalTokensAllocated: number;
  nftsMinted: number;
  collectionSize: number;
  leaderboard: HolderEntry[]; // sorted by tokensAllocated desc
  marketplace: MarketplaceEntry[];
  recentMints: NFTEvent[]; // last 20 MINT events
  recentEvents: NFTEvent[]; // last 20 non-MINT events
}
