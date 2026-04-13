



export interface Config {
    TICK_RATE_MS: number;
    COLLECTION_SIZE: number;
    INITIAL_AGENTS: number;
    NEW_AGENT_CHANCE: number;
    TOKENS_PER_SECOND: number;
}

export const DEFAULT_CONFIG: Config = {
    TICK_RATE_MS: 1600,
    COLLECTION_SIZE: 30,
    INITIAL_AGENTS: 20,
    NEW_AGENT_CHANCE: 0.08,
    TOKENS_PER_SECOND: 200,
};





export type EventType = 'MINT' | 'TRANSFER' | 'LIST' | 'UNLIST' | 'PURCHASE';

export interface NFT {
    id: number;
    name: string;
    owner: string;
    listed: boolean;
}

/**
 * An agent is either a user wallet or the marketplace program.
 * The marketplace is the only address with isProgram = true.
 * NFTs held by a program address do NOT earn token allocation.
 */
export interface Agent {
    address: string;
    name: string;
    isProgram: boolean;
}

export interface NFTEvent {
    type: EventType;
    nftId: number;
    nftName: string;
    from: string;
    to: string;
    slot: number;
    timestamp: number;
}



//




export interface Adapter {
    /** Subscribe to on-chain (or simulated) NFT events. */
    on(event: 'nft_event', listener: (e: NFTEvent) => void): this;
    /** Remove a previously registered listener. */
    off(event: 'nft_event', listener: (e: NFTEvent) => void): this;
    /** Start producing events. */
    start(): void;
    /** Stop producing events. */
    stop(): void;
}





export interface HolderEntry {
    address: string;
    name: string;
    nftsHeld: number;
    tokensAllocated: number;
}

export interface MarketplaceEntry {
    nftId: number;
    nftName: string;
    listedBy: string;
    listedAt: number;
}

export interface StateSnapshot {
    slot: number;
    tickRateMs: number;
    totalTokensAllocated: number;
    nftsMinted: number;
    collectionSize: number;
    leaderboard: HolderEntry[];
    marketplace: MarketplaceEntry[];
    recentMints: NFTEvent[];
    recentEvents: NFTEvent[];
}
