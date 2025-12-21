import { PrismaClient, TicketStatus } from '@prisma/client';
import { Seeder } from './base.seeder';

export class TicketSeeder implements Seeder {
  async seed(prisma: PrismaClient): Promise<void> {
    const student = await prisma.user.findUnique({
      where: { email: 'student@example.com' },
    });

    if (!student) {
      console.warn('Required student user not found, skip TicketSeeder');
      return;
    }

    // Find an event that student doesn't have a ticket for yet
    // Skip "Demo event" as it's already handled by EventSeeder
    const targetEvent = await prisma.event.findFirst({
      where: {
        venueId: { not: null },
        title: { not: 'Demo event' }, // Skip Demo event
        tickets: {
          none: {
            userId: student.id,
          },
        },
      },
      orderBy: { startTime: 'asc' },
      select: { id: true, venueId: true },
    });

    if (!targetEvent?.venueId) {
      console.warn(
        'No event with a venue found (or student already has tickets), skip TicketSeeder',
      );
      return;
    }

    const venueId = targetEvent.venueId;

    await prisma.$transaction(async (tx) => {
      // Check if student already has a ticket for this event
      const existingTicketForEvent = await tx.ticket.findFirst({
        where: {
          userId: student.id,
          eventId: targetEvent.id,
        },
        select: { id: true },
      });

      if (existingTicketForEvent) {
        console.warn(
          `Student already has a ticket for event ${targetEvent.id}, skip TicketSeeder`,
        );
        return;
      }

      const seat = await tx.seat.findFirst({
        where: {
          venueId,
          isActive: true,
          tickets: {
            none: {
              eventId: targetEvent.id,
              status: {
                in: [TicketStatus.VALID, TicketStatus.USED],
              },
            },
          },
        },
        orderBy: { id: 'asc' },
        select: { id: true },
      });

      if (!seat) {
        console.warn('No available seat to assign for demo ticket');
        return;
      }

      const existingTicketByQr = await tx.ticket.findUnique({
        where: { qrCode: 'QR-STUDENT-DEMO-1' },
        select: { eventId: true },
      });

      await tx.ticket.upsert({
        where: { qrCode: 'QR-STUDENT-DEMO-1' },
        update: {
          status: TicketStatus.VALID,
          eventId: targetEvent.id,
          userId: student.id,
          seatId: seat.id,
        },
        create: {
          qrCode: 'QR-STUDENT-DEMO-1',
          status: TicketStatus.VALID,
          eventId: targetEvent.id,
          userId: student.id,
          seatId: seat.id,
        },
      });

      // Increment registeredCount if this is a new ticket or event changed
      if (
        !existingTicketByQr ||
        existingTicketByQr.eventId !== targetEvent.id
      ) {
        // If ticket existed with different event, decrement old event first
        if (
          existingTicketByQr &&
          existingTicketByQr.eventId !== targetEvent.id
        ) {
          await tx.event.update({
            where: { id: existingTicketByQr.eventId },
            data: {
              registeredCount: {
                decrement: 1,
              },
            },
          });
        }
        // Increment registeredCount of the new event (only if student didn't have ticket for this event)
        if (!existingTicketForEvent) {
          await tx.event.update({
            where: { id: targetEvent.id },
            data: {
              registeredCount: {
                increment: 1,
              },
            },
          });
        }
      }

      await tx.seat.update({
        where: { id: seat.id },
        data: { isBooked: true },
      });
    });
  }
}
