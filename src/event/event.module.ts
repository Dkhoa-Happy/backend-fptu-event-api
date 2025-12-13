import { Module } from '@nestjs/common';
import { EventController } from './event.controller';
import { EventService } from './event.service';
import { EventSummaryService } from './event-summary.service';
import { EventSchedulerService } from './event-scheduler.service';
import { NotificationModule } from '../notification/notification.module';
import { EmailModule } from '../email/email.module';

@Module({
  imports: [NotificationModule, EmailModule],
  controllers: [EventController],
  providers: [EventService, EventSummaryService, EventSchedulerService],
  exports: [EventService, EventSummaryService],
})
export class EventModule {}
