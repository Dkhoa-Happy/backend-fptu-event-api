import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { NotificationService } from './notification.service';
import { TestSendDto } from './dto/test-send.dto';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';
import { QueryNotificationsDto } from './dto/query-notifications.dto';
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
  @Roles(
    UserRole.student,
    UserRole.staff,
    UserRole.admin,
    UserRole.event_organizer,
  )
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

  @Get()
  @Roles(
    UserRole.student,
    UserRole.staff,
    UserRole.admin,
    UserRole.event_organizer,
  )
  @ApiOperation({
    summary: 'Get notifications for current user',
    description:
      'Get paginated list of notifications for the current user. Supports filtering by read status and type.',
  })
  @ApiResponse({
    status: 200,
    description: 'List of notifications retrieved successfully',
  })
  async getNotifications(
    @GetUser('id') userId: number,
    @Query() query: QueryNotificationsDto,
  ) {
    return this.notificationService.getUserNotifications(userId, query);
  }

  @Get('unread-count')
  @Roles(
    UserRole.student,
    UserRole.staff,
    UserRole.admin,
    UserRole.event_organizer,
  )
  @ApiOperation({
    summary: 'Get unread notification count for current user',
    description: 'Returns the count of unread notifications for the current user',
  })
  @ApiResponse({
    status: 200,
    description: 'Unread count retrieved successfully',
  })
  async getUnreadCount(@GetUser('id') userId: number) {
    return this.notificationService.getUnreadCount(userId);
  }

  @Patch(':id/read')
  @Roles(
    UserRole.student,
    UserRole.staff,
    UserRole.admin,
    UserRole.event_organizer,
  )
  @ApiOperation({
    summary: 'Mark notification as read',
    description: 'Mark a specific notification as read for the current user',
  })
  @ApiResponse({
    status: 200,
    description: 'Notification marked as read successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Notification not found or access denied',
  })
  async markAsRead(
    @GetUser('id') userId: number,
    @Param('id', ParseIntPipe) notificationId: number,
  ) {
    return this.notificationService.markAsRead(userId, notificationId);
  }

  @Patch('read-all')
  @Roles(
    UserRole.student,
    UserRole.staff,
    UserRole.admin,
    UserRole.event_organizer,
  )
  @ApiOperation({
    summary: 'Mark all notifications as read',
    description: 'Mark all unread notifications as read for the current user',
  })
  @ApiResponse({
    status: 200,
    description: 'All notifications marked as read successfully',
  })
  async markAllAsRead(@GetUser('id') userId: number) {
    return this.notificationService.markAllAsRead(userId);
  }
}
