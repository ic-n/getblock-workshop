import { DEFAULT_CONFIG } from '../shared/types';
import type { Agent, Config, NFTEvent } from '../shared/types';





export const MARKETPLACE_ADDRESS =
    'MAGIC_EDEN_PROGRAM_1111111111111111111111111';
const COLLECTION_NAME = 'MadLad';



const ACTION_POOL = ['MINT', 'LIST', 'UNLIST', 'BUY'] as const;
type Action = (typeof ACTION_POOL)[number];

function roll(): Action {
    return ACTION_POOL[Math.floor(Math.random() * ACTION_POOL.length)];
}


function shuffle<T>(arr: T[]): T[] {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}





interface FakerNFT {
    id: number;
    name: string;
    owner: string;
    listed: boolean;
    listedBy: string;
}





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

    getAgents(): Agent[] {
        return [...this.wallets];
    }

    tick(): NFTEvent[] {
        this.slot += 1;
        const now = Date.now();
        const events: NFTEvent[] = [];

        if (Math.random() < this.config.NEW_AGENT_CHANCE) {
            this.spawnAgents(1);
        }

        const mintedOut = this.nextNftId >= this.config.COLLECTION_SIZE;

        const listed = [...this.nfts.values()].filter((n) => n.listed);

        const shuffled = shuffle([...this.wallets]);

        let actedCount = 0;

        for (const agent of shuffled) {
            if (Math.random() >= 1 / Math.pow(4, actedCount)) continue;

            let action = roll();
            if (action === 'MINT' && mintedOut) action = 'BUY';
            if (action === 'BUY' && !mintedOut) continue;

            let event: NFTEvent | null = null;
            switch (action) {
                case 'MINT':
                    event = this.doMint(agent, now);
                    break;
                case 'LIST':
                    event = this.doList(agent, now);
                    break;
                case 'UNLIST':
                    event = this.doUnlist(agent, now);
                    break;
                case 'BUY':
                    event = this.doBuy(agent, listed, now);
                    break;
            }

            if (event) {
                events.push(event);
                actedCount++;
            }
        }

        return events;
    }

    private doMint(agent: Agent, now: number): NFTEvent | null {
        if (this.nextNftId >= this.config.COLLECTION_SIZE) return null;

        const id = this.nextNftId++;
        const name = `${COLLECTION_NAME} #${id}`;
        this.nfts.set(id, {
            id,
            name,
            owner: agent.address,
            listed: false,
            listedBy: '',
        });

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
            (n) => n.owner === agent.address && !n.listed
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
            (n) => n.listed && n.listedBy === agent.address
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
        now: number
    ): NFTEvent | null {
        const available = listed.filter((n) => n.listedBy !== buyer.address);
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

    private spawnAgents(count: number): void {
        for (let i = 0; i < count; i++) {
            const index = this.wallets.length;
            const address = `WALLET_${index}_${Math.random()
                .toString(36)
                .slice(2, 8)
                .toUpperCase()}`;
            this.wallets.push({
                address,
                name: `Agent_${String(index).padStart(2, '0')}`,
                isProgram: false,
            });
        }
    }
}
