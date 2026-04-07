import { DEFAULT_CONFIG } from './types';
import type { Agent, Config, NFTEvent } from './types';

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

export const MARKETPLACE_ADDRESS = 'MAGIC_EDEN_PROGRAM_1111111111111111111111111';
const COLLECTION_NAME = 'MadLad';

// Action pool — DO_NOTHING removed. The exponential gate below is the "do nothing" decision.
// Each action has equal weight; conditions (sold out, has NFT, etc.) act as the real filter.
const ACTION_POOL = ['MINT', 'LIST', 'UNLIST', 'BUY'] as const;
type Action = (typeof ACTION_POOL)[number];

function roll(): Action {
  return ACTION_POOL[Math.floor(Math.random() * ACTION_POOL.length)];
}

// Knuth shuffle — in-place Fisher-Yates
function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
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

    if (Math.random() < this.config.NEW_AGENT_CHANCE) {
      this.spawnAgents(1);
    }

    const mintedOut = this.nextNftId >= this.config.COLLECTION_SIZE;
    // Snapshot listed NFTs once — BUY picks from this list for the whole tick
    const listed = [...this.nfts.values()].filter(n => n.listed);

    // Shuffle so no wallet index has a structural advantage
    const shuffled = shuffle([...this.wallets]);

    // Exponential gate: 1st agent always goes, each subsequent event makes the
    // next agent 4× less likely to act → effectively 1 event per tick, with
    // occasional 2nd for drama (25% after 1st event, 6.25% after 2nd, …)
    let actedCount = 0;

    for (const agent of shuffled) {
      if (Math.random() >= 1 / Math.pow(4, actedCount)) continue;

      let action = roll();
      if (action === 'MINT' && mintedOut)  action = 'BUY';
      if (action === 'BUY'  && !mintedOut) continue; // no secondary market yet

      let event: NFTEvent | null = null;
      switch (action) {
        case 'MINT':  event = this.doMint(agent, now);         break;
        case 'LIST':  event = this.doList(agent, now);         break;
        case 'UNLIST': event = this.doUnlist(agent, now);      break;
        case 'BUY':   event = this.doBuy(agent, listed, now);  break;
      }

      if (event) {
        events.push(event);
        actedCount++;
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

