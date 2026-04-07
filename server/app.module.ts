import { Module } from '@nestjs/common';
import { IndexerService } from './indexer.service';
import { EventsController } from './events.controller';

@Module({
  controllers: [EventsController],
  providers: [IndexerService],
})
export class AppModule {}
