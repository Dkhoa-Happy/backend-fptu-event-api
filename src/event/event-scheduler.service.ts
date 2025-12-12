import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { EventStatus } from '@prisma/client';

@Injectable()
export class EventSchedulerService {
  private readonly logger = new Logger(EventSchedulerService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Tự động cập nhật status của các event đã kết thúc sang COMPLETED
   * Chạy mỗi phút để kiểm tra và cập nhật
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async updateCompletedEvents() {
    try {
      const now = new Date();

      // Tìm tất cả các event đã kết thúc nhưng chưa có status COMPLETED hoặc CANCELED
      const completedEvents = await this.prisma.event.updateMany({
        where: {
          endTime: {
            lt: now, // endTime < now (đã kết thúc)
          },
          status: {
            in: [EventStatus.PENDING, EventStatus.PUBLISHED], // Chỉ update các event chưa completed hoặc canceled
          },
        },
        data: {
          status: EventStatus.COMPLETED,
        },
      });

      if (completedEvents.count > 0) {
        this.logger.log(
          `Đã tự động cập nhật ${completedEvents.count} sự kiện sang trạng thái COMPLETED`,
        );
      }
    } catch (error) {
      this.logger.error(
        'Lỗi khi tự động cập nhật trạng thái sự kiện:',
        error,
      );
    }
  }
}

