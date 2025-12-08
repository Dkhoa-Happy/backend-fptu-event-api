import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import * as OneSignal from '@onesignal/node-onesignal';
import { EventStatus, Prisma } from '@prisma/client';
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
    // Lưu subscription vào DB nếu muốn gửi đích danh (chưa có bảng, ví dụ chỉ log)
    // Tạm thời chỉ log để FE biết đã nhận
    this.logger.log(
      `Registered subscription for user ${userId}: ${dto.subscriptionId} device=${dto.deviceId}`,
    );
    return { registered: true };
  }
}
