import { Controller, Get, Post, Sse, MessageEvent, Inject, Res } from '@nestjs/common';
import { Observable, map } from 'rxjs';
import { Response } from 'express';
import { IndexerService } from './indexer.service';

@Controller()
export class EventsController {
  // Explicit @Inject avoids relying on emitDecoratorMetadata (not supported by esbuild/tsx)
  constructor(@Inject(IndexerService) private readonly indexer: IndexerService) {}

  /**
   * SSE stream — frontend connects here and receives StateSnapshot every tick.
   * EventSource URL: http://localhost:3001/events
   */
  @Sse('events')
  events(@Res({ passthrough: true }) res: Response): Observable<MessageEvent> {
    res.setHeader('Cache-Control', 'no-cache');
    return this.indexer.stream.pipe(
      map(snapshot => ({ data: snapshot }) as MessageEvent),
    );
  }

  /**
   * Start the simulation. Called by the frontend "Start Simulation" button.
   * Idempotent — calling it again while running is a no-op.
   */
  @Post('simulate')
  startSimulation() {
    this.indexer.startSimulation();
    return { ok: true, running: this.indexer.isRunning };
  }

  /** Status — lets the frontend know if the sim is already running. */
  @Get('status')
  status() {
    return { running: this.indexer.isRunning };
  }

  @Get('health')
  health() {
    return { ok: true };
  }
}
