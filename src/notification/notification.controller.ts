import {
  Body,
  Controller,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { NotificationService } from './notification.service';
import { TestSendDto } from './dto/test-send.dto';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';
import { JwtGuard, RolesGuard } from '../auth/guard';
import { Roles } from '../auth/decorator';
import { UserRole } from '@prisma/client';
import { GetUser } from '../auth/decorator/get-user-decorator';

@ApiTags('notifications')
@ApiBearerAuth()
@UseGuards(JwtGuard, RolesGuard)
@Controller('notifications')
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Post('test-send')
  @Roles(UserRole.admin)
  @ApiOperation({
    summary: 'Test send OneSignal notification (admin)',
    description:
      'Trigger sending notification for an event with a chosen window (one_day | thirty_min)',
  })
  async testSend(@Body() dto: TestSendDto) {
    return this.notificationService.testSend(dto);
  }

  @Post('subscriptions')
  @Roles(UserRole.student, UserRole.staff, UserRole.admin, UserRole.event_organizer)
  @ApiOperation({
    summary: 'Register OneSignal subscription for current user',
    description:
      'Frontend sends subscription/player ID (OneSignal) to map with current user for targeted push',
  })
  async createSubscription(
    @GetUser('id') userId: number,
    @Body() dto: CreateSubscriptionDto,
  ) {
    return this.notificationService.createSubscription(userId, dto);
  }
}


