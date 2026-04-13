import { Injectable, OnModuleDestroy, Logger } from '@nestjs/common';
import { Subject } from 'rxjs';
import { AllocationEngine } from './engine';
import { MockAdapter } from './mock-adapter';
import { YellowstoneAdapter } from './yellowstone-adapter';
import { DEFAULT_CONFIG } from '../shared/types';
import type { Adapter, Agent, NFTEvent, StateSnapshot } from '../shared/types';

// Magic Eden program — must be registered as isProgram=true so it earns no allocation
const MAGIC_EDEN_V2 = 'M2mx93ekt1fmXSVkTrUL9xVFHkmME8HTUi5Cyc5aF7K';

@Injectable()
export class IndexerService implements OnModuleDestroy {
  private readonly logger = new Logger(IndexerService.name);
  private readonly config = DEFAULT_CONFIG;
  private readonly engine = new AllocationEngine(this.config);

  // ── Adapter selection ──────────────────────────────────────────────────────
  //
  // Set YELLOWSTONE_ENDPOINT + YELLOWSTONE_TOKEN env vars to go live.
  // Leave them unset to run the mock simulation (default for the workshop).
  private readonly adapter: Adapter = this.buildAdapter();

  private readonly snapshots$ = new Subject<StateSnapshot>();
  private tickTimer: NodeJS.Timeout | null = null;
  private running = false;

  private buildAdapter(): Adapter {
    const endpoint = process.env.YELLOWSTONE_ENDPOINT;
    const token    = process.env.YELLOWSTONE_TOKEN;

    if (endpoint && token) {
      this.logger.log('Using YellowstoneAdapter (live gRPC stream)');
      return new YellowstoneAdapter({ endpoint, token });
    }

    this.logger.log('Using MockAdapter (simulation mode)');
    return new MockAdapter(this.config);
  }

  // ── Public interface ───────────────────────────────────────────────────────

  get stream() {
    return this.snapshots$.asObservable();
  }

  get isRunning() {
    return this.running;
  }

  // ── Start ──────────────────────────────────────────────────────────────────

  startSimulation(): void {
    if (this.running) return;
    this.running = true;

    if (this.adapter instanceof MockAdapter) {
      // Mock: register the simulated marketplace + pre-spawned agents upfront
      this.engine.registerAgent(this.adapter.faker.marketplace);
      for (const agent of this.adapter.faker.getAgents()) {
        this.engine.registerAgent(agent);
      }
    } else {
      // Real: register Magic Eden as the marketplace program so it earns no allocation
      this.engine.registerAgent({ address: MAGIC_EDEN_V2, name: 'Magic Eden', isProgram: true });
    }

    // Wire adapter → engine — same code path for both adapters
    this.adapter.on('nft_event', (event: NFTEvent) => {
      if (this.adapter instanceof MockAdapter) {
        // Mock: register any newly spawned agents each tick
        for (const agent of this.adapter.faker.getAgents()) {
          this.engine.registerAgent(agent);
        }
      } else {
        // Real: register wallet addresses the first time we see them
        this.registerWallet(event.from);
        this.registerWallet(event.to);
      }

      this.engine.processEvent(event);
      this.logEvent(event);
    });

    this.adapter.start();

    this.tickTimer = setInterval(() => {
      this.engine.tick();
      this.snapshots$.next(this.engine.getSnapshot());
    }, this.config.TICK_RATE_MS);

    const mode = this.adapter instanceof MockAdapter ? 'mock' : 'live gRPC';
    this.logger.log(`Indexer running in ${mode} mode`);
  }

  onModuleDestroy() {
    this.adapter.stop();
    if (this.tickTimer) clearInterval(this.tickTimer);
    this.snapshots$.complete();
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  /** Register a wallet address on first encounter (real adapter path). */
  private registerWallet(address: string): void {
    if (!address) return;
    const agent: Agent = {
      address,
      name: address.slice(0, 8),
      isProgram: false,
    };
    this.engine.registerAgent(agent);
  }

  private logEvent(e: NFTEvent) {
    const from = e.from ? e.from.slice(0, 14) : '(mint)';
    const to = e.to.slice(0, 14);
    this.logger.verbose(`[slot ${e.slot}] ${e.type.padEnd(8)} ${e.nftName} | ${from} → ${to}`);
  }
}
