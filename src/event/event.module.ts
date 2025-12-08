import { Module } from '@nestjs/common';
import { EventController } from './event.controller';
import { EventService } from './event.service';
import { EventSummaryService } from './event-summary.service';

@Module({
  controllers: [EventController],
  providers: [EventService, EventSummaryService],
  exports: [EventService, EventSummaryService],
})
export class EventModule {}
