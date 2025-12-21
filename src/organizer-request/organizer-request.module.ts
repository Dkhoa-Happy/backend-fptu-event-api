import { Module } from '@nestjs/common';
import { OrganizerRequestService } from './organizer-request.service';
import { OrganizerRequestController } from './organizer-request.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { EmailModule } from '../email/email.module';
import { NotificationModule } from '../notification/notification.module';

@Module({
  imports: [PrismaModule, EmailModule, NotificationModule],
  controllers: [OrganizerRequestController],
  providers: [OrganizerRequestService],
})
export class OrganizerRequestModule {}
