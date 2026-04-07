import { Injectable, OnModuleDestroy, Logger } from '@nestjs/common';
import { Subject } from 'rxjs';
import { AllocationEngine } from '../src/engine';
import { MockAdapter } from '../src/mock-adapter';
import { DEFAULT_CONFIG } from '../src/types';
import type { NFTEvent, StateSnapshot } from '../src/types';

@Injectable()
export class IndexerService implements OnModuleDestroy {
  private readonly logger = new Logger(IndexerService.name);
  private readonly config = DEFAULT_CONFIG;
  private readonly engine = new AllocationEngine(this.config);
  private readonly adapter = new MockAdapter(this.config);
  private readonly snapshots$ = new Subject<StateSnapshot>();
  private tickTimer: NodeJS.Timeout | null = null;
  private running = false;

  /** SSE stream — frontend subscribes once, receives snapshots every tick. */
  get stream() {
    return this.snapshots$.asObservable();
  }

  get isRunning() {
    return this.running;
  }

  // ── Start / Stop ───────────────────────────────────────────────────────────

  startSimulation(): void {
    if (this.running) return;
    this.running = true;

    // Register marketplace program + all initial agents with the engine
    this.engine.registerAgent(this.adapter.faker.marketplace);
    for (const agent of this.adapter.faker.getAgents()) {
      this.engine.registerAgent(agent);
    }

    // Wire adapter → engine: every on-chain event flows through here
    this.adapter.on('nft_event', (event: NFTEvent) => {
      for (const agent of this.adapter.faker.getAgents()) {
        this.engine.registerAgent(agent);
      }
      this.engine.processEvent(event);
      this.logEvent(event);
    });

    this.adapter.start();

    // Allocation tick + SSE broadcast every TICK_RATE_MS
    this.tickTimer = setInterval(() => {
      this.engine.tick();
      this.snapshots$.next(this.engine.getSnapshot());
    }, this.config.TICK_RATE_MS);

    this.logger.log(
      `Simulation started — ${this.config.COLLECTION_SIZE} NFT collection, ` +
      `${this.config.INITIAL_AGENTS} agents, ${this.config.TICK_RATE_MS}ms ticks`,
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
