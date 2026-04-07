import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { Subject } from 'rxjs';
import { AllocationEngine } from '../src/engine';
import { MockAdapter } from '../src/mock-adapter';
import { DEFAULT_CONFIG, NFTEvent, StateSnapshot } from '../src/types';

@Injectable()
export class IndexerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(IndexerService.name);
  private readonly config = DEFAULT_CONFIG;
  private readonly engine = new AllocationEngine(this.config);
  private readonly adapter = new MockAdapter(this.config);
  private readonly snapshots$ = new Subject<StateSnapshot>();
  private tickTimer: NodeJS.Timeout | null = null;

  /** Frontend subscribes to this stream for live state updates. */
  get stream() {
    return this.snapshots$.asObservable();
  }

  onModuleInit() {
    // Register the marketplace program so it's excluded from allocation
    this.engine.registerAgent(this.adapter.faker.marketplace);

    // Register all initial agents
    for (const agent of this.adapter.faker.getAgents()) {
      this.engine.registerAgent(agent);
    }

    // Wire adapter → engine: every on-chain event flows through here
    this.adapter.on('nft_event', (event: NFTEvent) => {
      // Re-register agents in case new ones spawned this tick
      for (const agent of this.adapter.faker.getAgents()) {
        this.engine.registerAgent(agent);
      }
      this.engine.processEvent(event);
      this.logEvent(event);
    });

    this.adapter.start();

    // Allocation tick + SSE broadcast — runs every TICK_RATE_MS
    this.tickTimer = setInterval(() => {
      this.engine.tick();
      const snapshot = this.engine.getSnapshot();
      this.snapshots$.next(snapshot);
    }, this.config.TICK_RATE_MS);

    this.logger.log(
      `Indexer started — ${this.config.COLLECTION_SIZE} NFT collection, ` +
      `${this.config.INITIAL_AGENTS} agents, ` +
      `${this.config.TICK_RATE_MS}ms ticks`
    );
  }

  onModuleDestroy() {
    this.adapter.stop();
    if (this.tickTimer) clearInterval(this.tickTimer);
    this.snapshots$.complete();
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  private logEvent(e: NFTEvent) {
    const from = e.from ? e.from.slice(0, 14) : '(mint)';
    const to = e.to.slice(0, 14);
    this.logger.verbose(`[slot ${e.slot}] ${e.type.padEnd(8)} ${e.nftName} | ${from} → ${to}`);
  }
}
