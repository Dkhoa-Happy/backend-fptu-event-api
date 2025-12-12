import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { EventStatus } from '@prisma/client';

@Injectable()
export class EventSummaryService {
  private readonly logger = new Logger(EventSummaryService.name);

  constructor(private readonly prisma: PrismaService) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
  async generateSummariesForEndedEvents() {
    const now = new Date();

    // Lấy các event đã kết thúc, đã publish, chưa có summary
    const endedEvents = await this.prisma.event.findMany({
      where: {
        endTime: { lt: now },
        status: EventStatus.PUBLISHED,
        summary: { is: null },
      },
      select: { id: true },
    });

    if (!endedEvents.length) return;

    for (const ev of endedEvents) {
      try {
        await this.generateSummaryForEvent(ev.id);
      } catch (error) {
        this.logger.error(
          `Generate summary failed for event ${ev.id}: ${
            error instanceof Error ? error.message : error
          }`,
        );
      }
    }
  }

  async getSummary(eventId: string) {
    const summary = await this.prisma.eventSummary.findUnique({
      where: { eventId },
    });
    if (summary) return summary;
    // Nếu chưa có, cố gắng tạo (trường hợp cron chưa chạy kịp)
    return this.generateSummaryForEvent(eventId);
  }

  private async generateSummaryForEvent(eventId: string) {
    // Kiểm tra event tồn tại và đã kết thúc
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      select: { id: true, endTime: true, status: true, venueId: true },
    });

    if (!event) {
      throw new Error('Event not found');
    }

    const now = new Date();
    if (now < new Date(event.endTime)) {
      throw new Error('Event has not ended yet');
    }

    // Tính toán số liệu
    const [totalRegistered, totalAttended, totalCancelled] = await Promise.all([
      this.prisma.ticket.count({
        where: { eventId, status: { in: ['VALID', 'USED'] } },
      }),
      this.prisma.ticket.count({
        where: { eventId, status: 'USED' },
      }),
      this.prisma.ticket.count({
        where: { eventId, status: 'CANCELLED' },
      }),
    ]);

    const totalNoShow = Math.max(totalRegistered - totalAttended, 0);

    const summary = await this.prisma.eventSummary.upsert({
      where: { eventId },
      update: {
        totalRegistered,
        totalAttended,
        totalNoShow,
      },
      create: {
        eventId,
        totalRegistered,
        totalAttended,
        totalNoShow,
      },
    });

    // Reset seats to active after event ends
    if (event.venueId) {
      await this.prisma.seat.updateMany({
        where: { venueId: event.venueId },
        data: { isBooked: false },
      });
    }

    return summary;
  }
}
