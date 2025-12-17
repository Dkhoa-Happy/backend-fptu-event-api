import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import * as OneSignal from '@onesignal/node-onesignal';
import { EventStatus, Prisma, IncidentSeverity } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';
import { TestSendDto } from './dto/test-send.dto';
import { QueryNotificationsDto } from './dto/query-notifications.dto';

type NotificationWindow = 'one_day' | 'thirty_min';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);
  private readonly oneSignalClient: OneSignal.DefaultApi | null;
  private readonly appId: string | undefined;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    const appId = this.config.get<string>('ONESIGNAL_APP_ID');
    const apiKey = this.config.get<string>('ONESIGNAL_REST_API_KEY');
    this.appId = appId;

    if (appId && apiKey) {
      const configuration = OneSignal.createConfiguration({
        authMethods: {
          rest_api_key: {
            tokenProvider: {
              getToken() {
                return apiKey;
              },
            },
          },
        },
      });
      this.oneSignalClient = new OneSignal.DefaultApi(configuration);
    } else {
      this.logger.warn(
        'ONESIGNAL_APP_ID or ONESIGNAL_REST_API_KEY missing. Notifications will be skipped.',
      );
      this.oneSignalClient = null;
    }
  }

  @Cron(CronExpression.EVERY_5_MINUTES)
  async handleScheduledNotifications() {
    if (!this.oneSignalClient || !this.appId) {
      return;
    }

    const now = new Date();

    // Lấy các event PUBLISHED trong tương lai
    const events = await this.prisma.event.findMany({
      where: {
        status: EventStatus.PUBLISHED,
        startTime: { gt: now },
      },
      select: {
        id: true,
        title: true,
        startTime: true,
        organizer: { select: { name: true } },
      },
    });

    for (const event of events) {
      const diffMs = new Date(event.startTime).getTime() - now.getTime();
      const diffMinutes = diffMs / (1000 * 60);

      // Gửi trước 1 ngày ~ 1440 phút (window 60 phút)
      if (
        diffMinutes <= 1440 &&
        diffMinutes > 1380 &&
        (await this.shouldSend(event.id, 'one_day'))
      ) {
        await this.sendOneSignalNotification(event, 'one_day');
      }

      // Gửi trước 30 phút (window 10 phút)
      if (
        diffMinutes <= 30 &&
        diffMinutes > 20 &&
        (await this.shouldSend(event.id, 'thirty_min'))
      ) {
        await this.sendOneSignalNotification(event, 'thirty_min');
      }
    }
  }

  private async shouldSend(eventId: string, type: NotificationWindow) {
    const exists = await this.prisma.eventNotificationLog.findUnique({
      where: { eventId_type: { eventId, type } },
    });
    return !exists;
  }

  private async logSent(eventId: string, type: NotificationWindow) {
    await this.prisma.eventNotificationLog.create({
      data: { eventId, type },
    });
  }

  private async sendOneSignalNotification(
    event: {
      id: string;
      title: string;
      startTime: Date;
      organizer: { name: string } | null;
    },
    type: NotificationWindow,
  ) {
    const heading =
      type === 'one_day'
        ? 'Sự kiện sắp diễn ra trong 1 ngày'
        : 'Sự kiện sắp diễn ra trong 30 phút';

    const content = `${event.title} ${
      event.organizer?.name ? `- ${event.organizer.name}` : ''
    }`;

    const payload: OneSignal.Notification = {
      app_id: this.appId!,
      included_segments: ['All'], // TODO: thay bằng target theo user/subscription nếu có
      headings: { en: heading },
      contents: { en: content },
      data: {
        eventId: event.id,
        type,
        startTime: event.startTime,
      },
    };

    try {
      if (!this.oneSignalClient) return;
      await this.oneSignalClient.createNotification(payload);
      await this.logSent(event.id, type);
      this.logger.log(
        `Sent OneSignal notification (${type}) for event ${event.id}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to send OneSignal notification for event ${event.id}: ${String(
          error,
        )}`,
      );
    }
  }

  // API helpers
  async testSend(dto: TestSendDto) {
    if (!this.oneSignalClient || !this.appId) {
      throw new Error('OneSignal config missing');
    }

    const event = await this.prisma.event.findUnique({
      where: { id: dto.eventId },
      select: {
        id: true,
        title: true,
        startTime: true,
        organizer: { select: { name: true } },
      },
    });

    if (!event) {
      throw new Error(`Event ${dto.eventId} not found`);
    }

    await this.sendOneSignalNotification(event, dto.type);
    return { sent: true };
  }

  async createSubscription(userId: number, dto: CreateSubscriptionDto) {
    // Lưu subscription vào DB để gửi đích danh
    await this.prisma.userSubscription.upsert({
      where: { subscriptionId: dto.subscriptionId },
      update: {
        userId,
        deviceId: dto.deviceId,
        updatedAt: new Date(),
      },
      create: {
        userId,
        subscriptionId: dto.subscriptionId,
        deviceId: dto.deviceId,
      },
    });

    this.logger.log(
      `Registered subscription for user ${userId}: ${dto.subscriptionId} device=${dto.deviceId}`,
    );
    return { registered: true };
  }

  /**
   * Gửi thông báo cho staff khi được assign vào event
   * @param userId - ID của staff được assign
   * @param event - Thông tin event
   */
  async notifyStaffAssigned(
    userId: number,
    event: {
      id: string;
      title: string;
      startTime: Date;
      endTime: Date;
      organizer?: { name: string } | null;
    },
  ) {
    if (!this.oneSignalClient || !this.appId) {
      this.logger.warn(
        'OneSignal config missing. Skipping staff assignment notification.',
      );
      return;
    }

    // Lấy subscriptionId của user từ DB
    const subscriptions = await this.prisma.userSubscription.findMany({
      where: { userId },
      select: { subscriptionId: true },
    });

    // Nếu user chưa có subscription, không gửi thông báo
    if (subscriptions.length === 0) {
      this.logger.warn(
        `User ${userId} has no OneSignal subscription. Skipping notification.`,
      );
      return;
    }

    const heading = 'Bạn đã được phân công làm staff cho sự kiện';
    const startTimeStr = new Date(event.startTime).toLocaleString('vi-VN', {
      dateStyle: 'short',
      timeStyle: 'short',
    });
    const content = `${event.title} - Bắt đầu: ${startTimeStr}`;

    // Lấy danh sách subscriptionId để gửi đích danh
    const playerIds = subscriptions.map((sub) => sub.subscriptionId);

    // Sử dụng type assertion vì OneSignal SDK type có thể không đầy đủ
    const payload: OneSignal.Notification = {
      app_id: this.appId,
      // Gửi đích danh cho user thông qua subscriptionId (player ID)
      include_subscription_ids: playerIds,
      headings: { en: heading, vi: heading },
      contents: { en: content, vi: content },
      data: {
        eventId: event.id,
        type: 'staff_assigned',
        startTime: event.startTime,
        endTime: event.endTime,
      },
    } as any;

    try {
      await this.oneSignalClient.createNotification(payload);
      this.logger.log(
        `Sent staff assignment notification to user ${userId} (${playerIds.length} device(s)) for event ${event.id}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to send staff assignment notification to user ${userId} for event ${event.id}: ${String(
          error,
        )}`,
      );
    }
  }

  /**
   * Gửi thông báo cho organizer khi event status thay đổi
   * @param organizerOwnerId - ID của organizer owner (user tạo event)
   * @param event - Thông tin event
   * @param status - Status mới của event (PENDING, PUBLISHED, CANCELED)
   */
  async notifyEventStatusChange(
    organizerOwnerId: number,
    event: {
      id: string;
      title: string;
      status: string;
    },
    status: 'PENDING' | 'PUBLISHED' | 'CANCELED' | 'COMPLETED',
  ) {
    if (!this.oneSignalClient || !this.appId) {
      this.logger.warn(
        'OneSignal config missing. Skipping event status notification.',
      );
      return;
    }

    // Lấy subscriptionId của organizer owner từ DB
    const subscriptions = await this.prisma.userSubscription.findMany({
      where: { userId: organizerOwnerId },
      select: { subscriptionId: true },
    });

    // Nếu user chưa có subscription, không gửi thông báo
    if (subscriptions.length === 0) {
      this.logger.warn(
        `Organizer owner ${organizerOwnerId} has no OneSignal subscription. Skipping notification.`,
      );
      return;
    }

    // Tạo nội dung thông báo dựa trên status
    let heading: string;
    let content: string;
    let notificationType: string;

    switch (status) {
      case 'PENDING':
        heading = 'Sự kiện của bạn đã được tạo thành công';
        content = `Sự kiện "${event.title}" đang chờ admin phê duyệt`;
        notificationType = 'event_created';
        break;
      case 'PUBLISHED':
        heading = 'Sự kiện của bạn đã được phê duyệt';
        content = `Sự kiện "${event.title}" đã được admin phê duyệt và đã được công bố`;
        notificationType = 'event_approved';
        break;
      case 'CANCELED':
        heading = 'Sự kiện của bạn đã bị từ chối';
        content = `Sự kiện "${event.title}" đã bị admin từ chối`;
        notificationType = 'event_rejected';
        break;
      default:
        return; // Không gửi nếu status không hợp lệ
    }

    // Lấy danh sách subscriptionId để gửi đích danh
    const playerIds = subscriptions.map((sub) => sub.subscriptionId);

    const payload: OneSignal.Notification = {
      app_id: this.appId,
      include_subscription_ids: playerIds,
      headings: { en: heading, vi: heading },
      contents: { en: content, vi: content },
      data: {
        eventId: event.id,
        type: notificationType,
        status: status,
      },
    } as any;

    try {
      await this.oneSignalClient.createNotification(payload);
      this.logger.log(
        `Sent event status notification (${status}) to organizer owner ${organizerOwnerId} for event ${event.id}`,
      );

      // Lưu notification vào database
      await this.saveNotification({
        userId: organizerOwnerId,
        type: notificationType,
        title: heading,
        content: content,
        data: {
          eventId: event.id,
          status: status,
        },
      });
    } catch (error) {
      this.logger.error(
        `Failed to send event status notification to organizer owner ${organizerOwnerId} for event ${event.id}: ${String(
          error,
        )}`,
      );
    }
  }

  /**
   * Gửi thông báo cho admin khi có sự kiện mới ở trạng thái PENDING cần phê duyệt
   * @param event - Thông tin event
   * @param organizerName - Tên của organizer tạo event
   */
  async notifyAdminNewEventPending(
    event: {
      id: string;
      title: string;
      status: string;
    },
    organizerName: string,
  ) {
    if (!this.oneSignalClient || !this.appId) {
      this.logger.warn(
        'OneSignal config missing. Skipping admin new event notification.',
      );
      return;
    }

    // Lấy subscription của tất cả admin
    const adminSubs = await this.prisma.userSubscription.findMany({
      where: {
        user: {
          roleName: 'admin',
          isActive: true,
        },
      },
      select: { subscriptionId: true },
    });

    if (adminSubs.length === 0) {
      this.logger.warn(
        `No admin subscriptions found for new event ${event.id}. Skipping notification.`,
      );
      return;
    }

    const heading = 'Có sự kiện mới cần phê duyệt';
    const content = `${organizerName} đã tạo sự kiện "${event.title}" và đang chờ phê duyệt`;

    const playerIds = adminSubs.map((sub) => sub.subscriptionId);

    const payload: OneSignal.Notification = {
      app_id: this.appId,
      include_subscription_ids: playerIds,
      headings: { en: heading, vi: heading },
      contents: { en: content, vi: content },
      data: {
        type: 'event_pending_approval',
        eventId: event.id,
        status: event.status,
        eventTitle: event.title,
        organizerName: organizerName,
      },
    } as any;

    try {
      await this.oneSignalClient.createNotification(payload);
      this.logger.log(
        `Sent new event pending notification to ${adminSubs.length} admin(s) for event ${event.id}`,
      );

      // Lưu notification vào database cho tất cả admin
      const adminUsers = await this.prisma.user.findMany({
        where: {
          roleName: 'admin',
          isActive: true,
        },
        select: { id: true },
      });

      for (const admin of adminUsers) {
        await this.saveNotification({
          userId: admin.id,
          type: 'event_pending_approval',
          title: heading,
          content: content,
          data: {
            type: 'event_pending_approval',
            eventId: event.id,
            status: event.status,
            eventTitle: event.title,
            organizerName: organizerName,
          },
        });
      }
    } catch (error) {
      this.logger.error(
        `Failed to send new event pending notification for event ${event.id}: ${String(error)}`,
      );
    }
  }

  /**
   * Gửi thông báo khi staff báo cáo sự cố trước sự kiện
   * Gửi cho: tất cả admin + organizer owner của event (nếu có)
   */
  async notifyIncidentReported(params: {
    incidentId: number;
    eventId: string;
    eventTitle: string;
    severity: IncidentSeverity;
    reporterName?: string;
    organizerOwnerId?: number | null;
  }) {
    if (!this.oneSignalClient || !this.appId) {
      this.logger.warn(
        'OneSignal config missing. Skipping incident notification.',
      );
      return;
    }

    // Lấy subscription của admin
    const adminSubs = await this.prisma.userSubscription.findMany({
      where: {
        user: {
          roleName: 'admin',
          isActive: true,
        },
      },
      select: { subscriptionId: true },
    });

    // Lấy subscription của organizer owner (nếu có)
    let organizerSubs: { subscriptionId: string }[] = [];
    if (params.organizerOwnerId) {
      organizerSubs = await this.prisma.userSubscription.findMany({
        where: {
          userId: params.organizerOwnerId,
          user: { isActive: true },
        },
        select: { subscriptionId: true },
      });
    }

    const playerIds = Array.from(
      new Set([...adminSubs, ...organizerSubs].map((s) => s.subscriptionId)),
    );

    if (playerIds.length === 0) {
      this.logger.warn(
        `No subscriptions found for incident ${params.incidentId}. Skipping notification.`,
      );
      return;
    }

    const heading = 'Báo cáo sự cố mới';
    const content = `${params.eventTitle} - Mức độ: ${params.severity}`;

    const payload: OneSignal.Notification = {
      app_id: this.appId,
      include_subscription_ids: playerIds,
      headings: { en: heading, vi: heading },
      contents: { en: content, vi: content },
      data: {
        type: 'incident_reported',
        incidentId: params.incidentId,
        eventId: params.eventId,
        severity: params.severity,
        reporterName: params.reporterName,
      },
    } as any;

    try {
      await this.oneSignalClient.createNotification(payload);
      this.logger.log(
        `Sent incident notification to admins/organizer for incident ${params.incidentId}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to send incident notification ${params.incidentId}: ${String(error)}`,
      );
    }
  }

  /**
   * Gửi thông báo cho tất cả users đã đăng ký sự kiện khi sự kiện bị hủy
   * @param eventId - ID của sự kiện bị hủy
   * @param eventTitle - Tiêu đề sự kiện
   */
  async notifyEventCancelledToAttendees(eventId: string, eventTitle: string) {
    if (!this.oneSignalClient || !this.appId) {
      this.logger.warn(
        'OneSignal config missing. Skipping event cancellation notification.',
      );
      return;
    }

    // Lấy tất cả tickets VALID của sự kiện (trước khi bị hủy)
    const tickets = await this.prisma.ticket.findMany({
      where: {
        eventId,
        status: 'VALID', // Chỉ gửi cho những người có vé còn hiệu lực
      },
      select: {
        userId: true,
      },
    });

    if (tickets.length === 0) {
      this.logger.log(
        `No valid tickets found for event ${eventId}. Skipping notification.`,
      );
      return;
    }

    // Lấy unique user IDs
    const userIds = Array.from(new Set(tickets.map((t) => t.userId)));

    // Lấy tất cả subscriptions của các users này
    const subscriptions = await this.prisma.userSubscription.findMany({
      where: {
        userId: { in: userIds },
      },
      select: { subscriptionId: true },
    });

    if (subscriptions.length === 0) {
      this.logger.warn(
        `No subscriptions found for ${userIds.length} users registered for event ${eventId}. Skipping notification.`,
      );
      return;
    }

    const heading = 'Sự kiện đã bị hủy';
    const content = `Sự kiện "${eventTitle}" đã bị hủy. Vé của bạn đã được tự động hủy.`;

    const playerIds = subscriptions.map((sub) => sub.subscriptionId);

    const payload: OneSignal.Notification = {
      app_id: this.appId,
      include_subscription_ids: playerIds,
      headings: { en: heading, vi: heading },
      contents: { en: content, vi: content },
      data: {
        eventId: eventId,
        type: 'event_cancelled',
        title: eventTitle,
      },
    } as any;

    try {
      await this.oneSignalClient.createNotification(payload);
      this.logger.log(
        `Sent event cancellation notification to ${subscriptions.length} subscribers (${userIds.length} users) for event ${eventId}`,
      );

      // Lưu notification vào database cho từng user
      const heading = 'Sự kiện đã bị hủy';
      const content = `Sự kiện "${eventTitle}" đã bị hủy. Vé của bạn đã được tự động hủy.`;
      for (const userId of userIds) {
        await this.saveNotification({
          userId,
          type: 'event_cancelled',
          title: heading,
          content: content,
          data: {
            eventId: eventId,
            type: 'event_cancelled',
            title: eventTitle,
          },
        });
      }
    } catch (error) {
      this.logger.error(
        `Failed to send event cancellation notification for event ${eventId}: ${String(
          error,
        )}`,
      );
    }
  }

  /**
   * Gửi thông báo cho tất cả users đã đăng ký sự kiện khi thời gian sự kiện thay đổi
   * @param eventId - ID của sự kiện
   * @param eventTitle - Tiêu đề sự kiện
   * @param hasStartTimeChange - Có thay đổi thời gian bắt đầu không
   * @param hasEndTimeChange - Có thay đổi thời gian kết thúc không
   */
  async notifyEventTimeChangedToAttendees(
    eventId: string,
    eventTitle: string,
    hasStartTimeChange: boolean,
    hasEndTimeChange: boolean,
  ) {
    if (!this.oneSignalClient || !this.appId) {
      this.logger.warn(
        'OneSignal config missing. Skipping event time change notification.',
      );
      return;
    }

    // Lấy tất cả tickets VALID của sự kiện
    const tickets = await this.prisma.ticket.findMany({
      where: {
        eventId,
        status: 'VALID', // Chỉ gửi cho những người có vé còn hiệu lực
      },
      select: {
        userId: true,
      },
    });

    if (tickets.length === 0) {
      this.logger.log(
        `No valid tickets found for event ${eventId}. Skipping notification.`,
      );
      return;
    }

    // Lấy unique user IDs
    const userIds = Array.from(new Set(tickets.map((t) => t.userId)));

    // Lấy tất cả subscriptions của các users này
    const subscriptions = await this.prisma.userSubscription.findMany({
      where: {
        userId: { in: userIds },
      },
      select: { subscriptionId: true },
    });

    if (subscriptions.length === 0) {
      this.logger.warn(
        `No subscriptions found for ${userIds.length} users registered for event ${eventId}. Skipping notification.`,
      );
      return;
    }

    const heading = 'Thông báo thay đổi thời gian sự kiện';
    let content = `Sự kiện "${eventTitle}" đã thay đổi thời gian`;
    if (hasStartTimeChange && hasEndTimeChange) {
      content += ' (thời gian bắt đầu và kết thúc)';
    } else if (hasStartTimeChange) {
      content += ' (thời gian bắt đầu)';
    } else if (hasEndTimeChange) {
      content += ' (thời gian kết thúc)';
    }
    content += '. Vui lòng kiểm tra email để biết chi tiết.';

    const playerIds = subscriptions.map((sub) => sub.subscriptionId);

    const payload: OneSignal.Notification = {
      app_id: this.appId,
      include_subscription_ids: playerIds,
      headings: { en: heading, vi: heading },
      contents: { en: content, vi: content },
      data: {
        eventId: eventId,
        type: 'event_time_changed',
        title: eventTitle,
      },
    } as any;

    try {
      await this.oneSignalClient.createNotification(payload);
      this.logger.log(
        `Sent event time change notification to ${subscriptions.length} subscribers (${userIds.length} users) for event ${eventId}`,
      );

      // Lưu notification vào database cho từng user
      for (const userId of userIds) {
        await this.saveNotification({
          userId,
          type: 'event_time_changed',
          title: heading,
          content: content,
          data: {
            eventId: eventId,
            type: 'event_time_changed',
            title: eventTitle,
          },
        });
      }
    } catch (error) {
      this.logger.error(
        `Failed to send event time change notification for event ${eventId}: ${String(
          error,
        )}`,
      );
    }
  }

  /**
   * Gửi thông báo cho tất cả admin khi có yêu cầu hủy sự kiện từ organizer
   */
  async notifyCancellationRequestToAdmins(params: {
    eventId: string;
    eventTitle: string;
    organizerName: string;
    reason: string;
    requestId: number;
  }) {
    if (!this.oneSignalClient || !this.appId) {
      this.logger.warn(
        'OneSignal config missing. Skipping cancellation request notification.',
      );
      return;
    }

    // Lấy subscription của tất cả admin
    const adminSubs = await this.prisma.userSubscription.findMany({
      where: {
        user: {
          roleName: 'admin',
          isActive: true,
        },
      },
      select: { subscriptionId: true },
    });

    if (adminSubs.length === 0) {
      this.logger.warn(
        `No admin subscriptions found for cancellation request ${params.requestId}. Skipping notification.`,
      );
      return;
    }

    const heading = 'Yêu cầu hủy sự kiện mới';
    const content = `${params.organizerName} yêu cầu hủy sự kiện "${params.eventTitle}"`;

    const playerIds = adminSubs.map((sub) => sub.subscriptionId);

    const payload: OneSignal.Notification = {
      app_id: this.appId,
      include_subscription_ids: playerIds,
      headings: { en: heading, vi: heading },
      contents: { en: content, vi: content },
      data: {
        type: 'cancellation_request',
        eventId: params.eventId,
        requestId: params.requestId,
        eventTitle: params.eventTitle,
        reason: params.reason,
      },
    } as any;

    try {
      await this.oneSignalClient.createNotification(payload);
      this.logger.log(
        `Sent cancellation request notification to ${adminSubs.length} admin(s) for request ${params.requestId}`,
      );

      // Lưu notification vào database cho tất cả admin
      const adminUsers = await this.prisma.user.findMany({
        where: {
          roleName: 'admin',
          isActive: true,
        },
        select: { id: true },
      });

      for (const admin of adminUsers) {
        await this.saveNotification({
          userId: admin.id,
          type: 'cancellation_request',
          title: heading,
          content: content,
          data: {
            type: 'cancellation_request',
            eventId: params.eventId,
            requestId: params.requestId,
            eventTitle: params.eventTitle,
            reason: params.reason,
          },
        });
      }
    } catch (error) {
      this.logger.error(
        `Failed to send cancellation request notification ${params.requestId}: ${String(error)}`,
      );
    }
  }

  /**
   * Gửi thông báo cho organizer khi yêu cầu hủy sự kiện được phê duyệt
   */
  async notifyCancellationRequestApproved(params: {
    organizerOwnerId: number;
    eventId: string;
    eventTitle: string;
  }) {
    if (!this.oneSignalClient || !this.appId) {
      this.logger.warn(
        'OneSignal config missing. Skipping cancellation approval notification.',
      );
      return;
    }

    const subscriptions = await this.prisma.userSubscription.findMany({
      where: { userId: params.organizerOwnerId },
      select: { subscriptionId: true },
    });

    if (subscriptions.length === 0) {
      this.logger.warn(
        `Organizer owner ${params.organizerOwnerId} has no OneSignal subscription. Skipping notification.`,
      );
      return;
    }

    const heading = 'Yêu cầu hủy sự kiện đã được phê duyệt';
    const content = `Yêu cầu hủy sự kiện "${params.eventTitle}" đã được admin phê duyệt. Sự kiện đã được hủy.`;

    const playerIds = subscriptions.map((sub) => sub.subscriptionId);

    const payload: OneSignal.Notification = {
      app_id: this.appId,
      include_subscription_ids: playerIds,
      headings: { en: heading, vi: heading },
      contents: { en: content, vi: content },
      data: {
        type: 'cancellation_approved',
        eventId: params.eventId,
        eventTitle: params.eventTitle,
      },
    } as any;

    try {
      await this.oneSignalClient.createNotification(payload);
      this.logger.log(
        `Sent cancellation approval notification to organizer owner ${params.organizerOwnerId} for event ${params.eventId}`,
      );

      // Lưu notification vào database
      await this.saveNotification({
        userId: params.organizerOwnerId,
        type: 'cancellation_approved',
        title: heading,
        content: content,
        data: {
          type: 'cancellation_approved',
          eventId: params.eventId,
          eventTitle: params.eventTitle,
        },
      });
    } catch (error) {
      this.logger.error(
        `Failed to send cancellation approval notification to organizer owner ${params.organizerOwnerId} for event ${params.eventId}: ${String(error)}`,
      );
    }
  }

  /**
   * Gửi thông báo cho organizer khi yêu cầu hủy sự kiện bị từ chối
   */
  async notifyCancellationRequestRejected(params: {
    organizerOwnerId: number;
    eventId: string;
    eventTitle: string;
    adminNote?: string;
  }) {
    if (!this.oneSignalClient || !this.appId) {
      this.logger.warn(
        'OneSignal config missing. Skipping cancellation rejection notification.',
      );
      return;
    }

    const subscriptions = await this.prisma.userSubscription.findMany({
      where: { userId: params.organizerOwnerId },
      select: { subscriptionId: true },
    });

    if (subscriptions.length === 0) {
      this.logger.warn(
        `Organizer owner ${params.organizerOwnerId} has no OneSignal subscription. Skipping notification.`,
      );
      return;
    }

    const heading = 'Yêu cầu hủy sự kiện bị từ chối';
    const content = `Yêu cầu hủy sự kiện "${params.eventTitle}" đã bị admin từ chối.`;

    const playerIds = subscriptions.map((sub) => sub.subscriptionId);

    const payload: OneSignal.Notification = {
      app_id: this.appId,
      include_subscription_ids: playerIds,
      headings: { en: heading, vi: heading },
      contents: { en: content, vi: content },
      data: {
        type: 'cancellation_rejected',
        eventId: params.eventId,
        eventTitle: params.eventTitle,
        adminNote: params.adminNote,
      },
    } as any;

    try {
      await this.oneSignalClient.createNotification(payload);
      this.logger.log(
        `Sent cancellation rejection notification to organizer owner ${params.organizerOwnerId} for event ${params.eventId}`,
      );

      // Lưu notification vào database
      await this.saveNotification({
        userId: params.organizerOwnerId,
        type: 'cancellation_rejected',
        title: heading,
        content: content,
        data: {
          type: 'cancellation_rejected',
          eventId: params.eventId,
          eventTitle: params.eventTitle,
          adminNote: params.adminNote,
        },
      });
    } catch (error) {
      this.logger.error(
        `Failed to send cancellation rejection notification to organizer owner ${params.organizerOwnerId} for event ${params.eventId}: ${String(error)}`,
      );
    }
  }

  /**
   * Gửi thông báo khi student gửi yêu cầu trở thành organizer
   */
  async notifyOrganizerRequestSubmittedToAdmins(params: {
    requestId: number;
    organizerName: string;
    requesterName: string;
  }) {
    if (!this.oneSignalClient || !this.appId) {
      this.logger.warn(
        'OneSignal config missing. Skipping organizer request (admin) notification.',
      );
      return;
    }

    const adminSubs = await this.prisma.userSubscription.findMany({
      where: { user: { roleName: 'admin', isActive: true } },
      select: { subscriptionId: true },
    });

    if (adminSubs.length === 0) {
      this.logger.warn(
        `No admin subscriptions found for organizer request ${params.requestId}. Skipping notification.`,
      );
      return;
    }

    const heading = 'Yêu cầu trở thành Organizer mới';
    const content = `${params.requesterName} gửi yêu cầu cho CLB "${params.organizerName}"`;

    const playerIds = adminSubs.map((s) => s.subscriptionId);

    const payload: OneSignal.Notification = {
      app_id: this.appId,
      include_subscription_ids: playerIds,
      headings: { en: heading, vi: heading },
      contents: { en: content, vi: content },
      data: {
        type: 'organizer_request_submitted',
        requestId: params.requestId,
        organizerName: params.organizerName,
        requesterName: params.requesterName,
      },
    } as any;

    try {
      await this.oneSignalClient.createNotification(payload);
      this.logger.log(
        `Sent organizer request notification to admins for request ${params.requestId}`,
      );

      const admins = await this.prisma.user.findMany({
        where: { roleName: 'admin', isActive: true },
        select: { id: true },
      });

      for (const admin of admins) {
        await this.saveNotification({
          userId: admin.id,
          type: 'organizer_request_submitted',
          title: heading,
          content,
          data: {
            type: 'organizer_request_submitted',
            requestId: params.requestId,
            organizerName: params.organizerName,
            requesterName: params.requesterName,
          },
        });
      }
    } catch (error) {
      this.logger.error(
        `Failed to send organizer request notification ${params.requestId}: ${String(error)}`,
      );
    }
  }

  /**
   * Gửi thông báo cho student khi đã gửi yêu cầu trở thành organizer
   */
  async notifyOrganizerRequestSubmittedToUser(params: {
    userId: number;
    requestId: number;
    organizerName: string;
  }) {
    if (!this.oneSignalClient || !this.appId) {
      this.logger.warn(
        'OneSignal config missing. Skipping organizer request (user) notification.',
      );
      return;
    }

    const subs = await this.prisma.userSubscription.findMany({
      where: { userId: params.userId },
      select: { subscriptionId: true },
    });

    if (subs.length === 0) {
      this.logger.warn(
        `User ${params.userId} has no OneSignal subscription. Skipping organizer request submitted notification.`,
      );
      return;
    }

    const heading = 'Đã nhận yêu cầu Organizer';
    const content = `Yêu cầu cho CLB "${params.organizerName}" đang chờ admin duyệt.`;
    const playerIds = subs.map((s) => s.subscriptionId);

    const payload: OneSignal.Notification = {
      app_id: this.appId,
      include_subscription_ids: playerIds,
      headings: { en: heading, vi: heading },
      contents: { en: content, vi: content },
      data: {
        type: 'organizer_request_received',
        requestId: params.requestId,
        organizerName: params.organizerName,
        status: 'PENDING',
      },
    } as any;

    try {
      await this.oneSignalClient.createNotification(payload);
      this.logger.log(
        `Sent organizer request received notification to user ${params.userId} for request ${params.requestId}`,
      );

      await this.saveNotification({
        userId: params.userId,
        type: 'organizer_request_received',
        title: heading,
        content,
        data: {
          type: 'organizer_request_received',
          requestId: params.requestId,
          organizerName: params.organizerName,
          status: 'PENDING',
        },
      });
    } catch (error) {
      this.logger.error(
        `Failed to send organizer request received notification to user ${params.userId}: ${String(error)}`,
      );
    }
  }

  /**
   * Gửi thông báo cho student khi yêu cầu organizer được phê duyệt
   */
  async notifyOrganizerRequestApproved(params: {
    userId: number;
    requestId: number;
    organizerName: string;
  }) {
    if (!this.oneSignalClient || !this.appId) {
      this.logger.warn(
        'OneSignal config missing. Skipping organizer request approved notification.',
      );
      return;
    }

    const subs = await this.prisma.userSubscription.findMany({
      where: { userId: params.userId },
      select: { subscriptionId: true },
    });

    if (subs.length === 0) {
      this.logger.warn(
        `User ${params.userId} has no OneSignal subscription. Skipping organizer request approved notification.`,
      );
      return;
    }

    const heading = 'Yêu cầu Organizer đã được duyệt';
    const content = `Yêu cầu cho CLB "${params.organizerName}" đã được phê duyệt. Tài khoản của bạn đã là event_organizer.`;

    const payload: OneSignal.Notification = {
      app_id: this.appId,
      include_subscription_ids: subs.map((s) => s.subscriptionId),
      headings: { en: heading, vi: heading },
      contents: { en: content, vi: content },
      data: {
        type: 'organizer_request_approved',
        requestId: params.requestId,
        organizerName: params.organizerName,
      },
    } as any;

    try {
      await this.oneSignalClient.createNotification(payload);
      this.logger.log(
        `Sent organizer request approved notification to user ${params.userId} for request ${params.requestId}`,
      );

      await this.saveNotification({
        userId: params.userId,
        type: 'organizer_request_approved',
        title: heading,
        content,
        data: {
          type: 'organizer_request_approved',
          requestId: params.requestId,
          organizerName: params.organizerName,
        },
      });
    } catch (error) {
      this.logger.error(
        `Failed to send organizer request approved notification to user ${params.userId}: ${String(error)}`,
      );
    }
  }

  /**
   * Gửi thông báo cho student khi yêu cầu organizer bị từ chối
   */
  async notifyOrganizerRequestRejected(params: {
    userId: number;
    requestId: number;
    organizerName: string;
    reason?: string;
  }) {
    if (!this.oneSignalClient || !this.appId) {
      this.logger.warn(
        'OneSignal config missing. Skipping organizer request rejected notification.',
      );
      return;
    }

    const subs = await this.prisma.userSubscription.findMany({
      where: { userId: params.userId },
      select: { subscriptionId: true },
    });

    if (subs.length === 0) {
      this.logger.warn(
        `User ${params.userId} has no OneSignal subscription. Skipping organizer request rejected notification.`,
      );
      return;
    }

    const heading = 'Yêu cầu Organizer bị từ chối';
    const content = `Yêu cầu cho CLB "${params.organizerName}" đã bị từ chối.${params.reason ? ` Lý do: ${params.reason}` : ''}`;

    const payload: OneSignal.Notification = {
      app_id: this.appId,
      include_subscription_ids: subs.map((s) => s.subscriptionId),
      headings: { en: heading, vi: heading },
      contents: { en: content, vi: content },
      data: {
        type: 'organizer_request_rejected',
        requestId: params.requestId,
        organizerName: params.organizerName,
        reason: params.reason,
      },
    } as any;

    try {
      await this.oneSignalClient.createNotification(payload);
      this.logger.log(
        `Sent organizer request rejected notification to user ${params.userId} for request ${params.requestId}`,
      );

      await this.saveNotification({
        userId: params.userId,
        type: 'organizer_request_rejected',
        title: heading,
        content,
        data: {
          type: 'organizer_request_rejected',
          requestId: params.requestId,
          organizerName: params.organizerName,
          reason: params.reason,
        },
      });
    } catch (error) {
      this.logger.error(
        `Failed to send organizer request rejected notification to user ${params.userId}: ${String(error)}`,
      );
    }
  }

  /**
   * Lưu notification vào database
   */
  private async saveNotification(params: {
    userId: number;
    type: string;
    title: string;
    content: string;
    data?: any;
  }) {
    try {
      await this.prisma.notification.create({
        data: {
          userId: params.userId,
          type: params.type,
          title: params.title,
          content: params.content,
          data: params.data || {},
        },
      });
    } catch (error) {
      // Log lỗi nhưng không throw để không ảnh hưởng đến flow gửi notification
      this.logger.error(
        `Failed to save notification for user ${params.userId}: ${String(error)}`,
      );
    }
  }

  /**
   * Lấy danh sách thông báo của user
   */
  async getUserNotifications(userId: number, query: QueryNotificationsDto) {
    const { page = 1, limit = 10, isRead, type } = query;

    const where: Prisma.NotificationWhereInput = {
      userId,
    };

    if (isRead !== undefined) {
      where.isRead = isRead;
    }

    if (type) {
      where.type = type;
    }

    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          type: true,
          title: true,
          content: true,
          data: true,
          isRead: true,
          readAt: true,
          createdAt: true,
        },
      }),
      this.prisma.notification.count({ where }),
    ]);

    return {
      data: items,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Đánh dấu notification là đã đọc
   */
  async markAsRead(userId: number, notificationId: number) {
    const notification = await this.prisma.notification.findFirst({
      where: {
        id: notificationId,
        userId, // Đảm bảo user chỉ có thể đánh dấu notification của chính mình
      },
    });

    if (!notification) {
      throw new NotFoundException(
        'Không tìm thấy thông báo hoặc bạn không có quyền truy cập',
      );
    }

    if (notification.isRead) {
      return notification;
    }

    return await this.prisma.notification.update({
      where: { id: notificationId },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });
  }

  /**
   * Đánh dấu tất cả notifications của user là đã đọc
   */
  async markAllAsRead(userId: number) {
    const result = await this.prisma.notification.updateMany({
      where: {
        userId,
        isRead: false,
      },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });

    return {
      message: `Đã đánh dấu ${result.count} thông báo là đã đọc`,
      count: result.count,
    };
  }

  /**
   * Đếm số thông báo chưa đọc của user
   */
  async getUnreadCount(userId: number) {
    const count = await this.prisma.notification.count({
      where: {
        userId,
        isRead: false,
      },
    });

    return { unreadCount: count };
  }
}
