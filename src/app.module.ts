import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { UserModule } from './user/user.module';
import { EventModule } from './event/event.module';
import { PrismaModule } from './prisma/prisma.module';
import { SpeakerModule } from './speaker/speaker.module';
import { CampusModule } from './campus/campus.module';
import { VenueModule } from './venue/venue.module';

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
  ],
})
export class AppModule {}
