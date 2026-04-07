import { DEFAULT_CONFIG } from './types';
import type { Agent, Config, NFTEvent } from './types';

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

export const MARKETPLACE_ADDRESS = 'MAGIC_EDEN_PROGRAM_1111111111111111111111111';
const COLLECTION_NAME = 'MadLad';

// Weighted action pool — DO_NOTHING appears 4× so it wins most rolls
const ACTION_POOL = [
  'DO_NOTHING', 'DO_NOTHING', 'DO_NOTHING', 'DO_NOTHING',
  'MINT', 'LIST', 'UNLIST', 'BUY',
] as const;
type Action = (typeof ACTION_POOL)[number];

function roll(): Action {
  return ACTION_POOL[Math.floor(Math.random() * ACTION_POOL.length)];
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal NFT state tracked by the faker
// ─────────────────────────────────────────────────────────────────────────────

interface FakerNFT {
  id: number;
  name: string;
  owner: string;    // current owner address
  listed: boolean;
  listedBy: string; // original seller — needed to match UNLIST to the right agent
}

// ─────────────────────────────────────────────────────────────────────────────
// Faker
// ─────────────────────────────────────────────────────────────────────────────

export class Faker {
  private readonly config: Config;

  readonly marketplace: Agent = {
    address: MARKETPLACE_ADDRESS,
    name: 'Magic Eden',
    isProgram: true,
  };

  private readonly wallets: Agent[] = [];
  private readonly nfts = new Map<number, FakerNFT>();
  private nextNftId = 0;
  private slot = 0;

  constructor(config: Config = DEFAULT_CONFIG) {
    this.config = config;
    this.spawnAgents(config.INITIAL_AGENTS);
  }

  // Public read-only access for the adapter to register agents with the engine
  getAgents(): Agent[] {
    return [...this.wallets];
  }

  // ── Tick ───────────────────────────────────────────────────────────────────
  // Returns the events generated during this tick.

  tick(): NFTEvent[] {
    this.slot += 1;
    const now = Date.now();
    const events: NFTEvent[] = [];

    // Small chance a brand-new agent joins each tick
    if (Math.random() < this.config.NEW_AGENT_CHANCE) {
      this.spawnAgents(1);
    }

    const mintedOut = this.nextNftId >= this.config.COLLECTION_SIZE;
    const listed = [...this.nfts.values()].filter(n => n.listed);

    for (const agent of this.wallets) {
      let action = roll();

      // Sold out → mint attempts become buy attempts
      if (action === 'MINT' && mintedOut) action = 'BUY';

      // Buy only makes sense when sold out (primary market closed)
      if (action === 'BUY' && !mintedOut) action = 'DO_NOTHING';

      switch (action) {
        case 'MINT': {
          const event = this.doMint(agent, now);
          if (event) events.push(event);
          break;
        }
        case 'LIST': {
          const event = this.doList(agent, now);
          if (event) events.push(event);
          break;
        }
        case 'UNLIST': {
          const event = this.doUnlist(agent, now);
          if (event) events.push(event);
          break;
        }
        case 'BUY': {
          const event = this.doBuy(agent, listed, now);
          if (event) events.push(event);
          break;
        }
        // DO_NOTHING — fall through
      }
    }

    return events;
  }

  // ── Actions ────────────────────────────────────────────────────────────────

  private doMint(agent: Agent, now: number): NFTEvent | null {
    if (this.nextNftId >= this.config.COLLECTION_SIZE) return null;

    const id = this.nextNftId++;
    const name = `${COLLECTION_NAME} #${id}`;
    this.nfts.set(id, { id, name, owner: agent.address, listed: false, listedBy: '' });

    return {
      type: 'MINT',
      nftId: id,
      nftName: name,
      from: '',
      to: agent.address,
      slot: this.slot,
      timestamp: now,
    };
  }

  private doList(agent: Agent, now: number): NFTEvent | null {
    const owned = [...this.nfts.values()].find(
      n => n.owner === agent.address && !n.listed
    );
    if (!owned) return null;

    owned.listed = true;
    owned.listedBy = agent.address;
    owned.owner = MARKETPLACE_ADDRESS;

    return {
      type: 'LIST',
      nftId: owned.id,
      nftName: owned.name,
      from: agent.address,
      to: MARKETPLACE_ADDRESS,
      slot: this.slot,
      timestamp: now,
    };
  }

  private doUnlist(agent: Agent, now: number): NFTEvent | null {
    const owned = [...this.nfts.values()].find(
      n => n.listed && n.listedBy === agent.address
    );
    if (!owned) return null;

    owned.listed = false;
    owned.listedBy = '';
    owned.owner = agent.address;

    return {
      type: 'UNLIST',
      nftId: owned.id,
      nftName: owned.name,
      from: MARKETPLACE_ADDRESS,
      to: agent.address,
      slot: this.slot,
      timestamp: now,
    };
  }

  private doBuy(
    buyer: Agent,
    listed: FakerNFT[],
    now: number,
  ): NFTEvent | null {
    // Can't buy your own listing
    const available = listed.filter(n => n.listedBy !== buyer.address);
    if (available.length === 0) return null;

    const nft = available[Math.floor(Math.random() * available.length)];
    nft.listed = false;
    nft.listedBy = '';
    nft.owner = buyer.address;

    return {
      type: 'PURCHASE',
      nftId: nft.id,
      nftName: nft.name,
      from: MARKETPLACE_ADDRESS,
      to: buyer.address,
      slot: this.slot,
      timestamp: now,
    };
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  private spawnAgents(count: number): void {
    for (let i = 0; i < count; i++) {
      const index = this.wallets.length;
      const address = `WALLET_${index}_${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
      this.wallets.push({
        address,
        name: `Agent_${String(index).padStart(2, '0')}`,
        isProgram: false,
      });
    }
  }
}

