import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { UserModule } from './user/user.module';
import { EventModule } from './event/event.module';
import { PrismaModule } from './prisma/prisma.module';
import { SpeakerModule } from './speaker/speaker.module';
import { CampusModule } from './campus/campus.module';
import { VenueModule } from './venue/venue.module';
import { OrganizerModule } from './organizer/organizer.module';
import { TicketModule } from './ticket/ticket.module';
import { SeatModule } from './seat/seat.module';
import { FeedbackModule } from './feedback/feedback.module';
import { NotificationModule } from './notification/notification.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    UserModule,
    EventModule,
    SpeakerModule,
    CampusModule,
    VenueModule,
    OrganizerModule,
    TicketModule,
    SeatModule,
    FeedbackModule,
    NotificationModule,
  ],
})
export class AppModule {}
