import { DEFAULT_CONFIG } from '../shared/types';
import type { Adapter, Config, NFTEvent } from '../shared/types';
import { Faker } from './faker';



//





export class MockAdapter implements Adapter {
    readonly faker: Faker;

    private readonly config: Config;
    private readonly listeners = new Set<(e: NFTEvent) => void>();
    private timer: ReturnType<typeof setInterval> | null = null;

    constructor(config: Config = DEFAULT_CONFIG) {
        this.config = config;
        this.faker = new Faker(config);
    }

    on(_event: 'nft_event', listener: (e: NFTEvent) => void): this {
        this.listeners.add(listener);
        return this;
    }

    off(_event: 'nft_event', listener: (e: NFTEvent) => void): this {
        this.listeners.delete(listener);
        return this;
    }

    start(): void {
        if (this.timer !== null) return;
        this.timer = setInterval(
            () => this.runTick(),
            this.config.TICK_RATE_MS
        );
    }

    stop(): void {
        if (this.timer === null) return;
        clearInterval(this.timer);
        this.timer = null;
    }

    private runTick(): void {
        const events = this.faker.tick();
        for (const event of events) {
            for (const listener of this.listeners) {
                listener(event);
            }
        }
    }
}
