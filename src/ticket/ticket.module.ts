import { Module } from '@nestjs/common';
import { TicketController } from './ticket.controller';
import { TicketService } from './ticket.service';
import { CheckinGateway } from '../realtime/checkin.gateway';

@Module({
  controllers: [TicketController],
  providers: [TicketService, CheckinGateway],
  exports: [TicketService],
})
export class TicketModule {}

