import { Controller, Get, Sse, MessageEvent, Res } from '@nestjs/common';
import { Observable, map } from 'rxjs';
import { Response } from 'express';
import { IndexerService } from './indexer.service';

@Controller()
export class EventsController {
  constructor(private readonly indexer: IndexerService) {}

  /**
   * SSE stream — frontend connects here and receives a StateSnapshot every tick.
   * EventSource URL: http://localhost:3001/events
   */
  @Sse('events')
  events(@Res({ passthrough: true }) res: Response): Observable<MessageEvent> {
    // Allow the Vite dev server (port 5173) to connect
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'no-cache');

    return this.indexer.stream.pipe(
      map(snapshot => ({ data: snapshot }) as MessageEvent),
    );
  }

  /** Health check — useful for verifying the server is up. */
  @Get('health')
  health() {
    return { ok: true };
  }
}
