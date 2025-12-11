import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import * as OneSignal from '@onesignal/node-onesignal';
import { EventStatus, Prisma, IncidentSeverity } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';
import { TestSendDto } from './dto/test-send.dto';

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
    status: 'PENDING' | 'PUBLISHED' | 'CANCELED',
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
    } catch (error) {
      this.logger.error(
        `Failed to send event status notification to organizer owner ${organizerOwnerId} for event ${event.id}: ${String(
          error,
        )}`,
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
      new Set(
        [...adminSubs, ...organizerSubs].map((s) => s.subscriptionId),
      ),
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
}
