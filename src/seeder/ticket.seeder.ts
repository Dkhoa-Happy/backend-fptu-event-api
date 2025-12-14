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

    const targetEvent = await prisma.event.findFirst({
      where: { venueId: { not: null } },
      orderBy: { startTime: 'asc' },
      select: { id: true, venueId: true },
    });

    if (!targetEvent?.venueId) {
      console.warn('No event with a venue found, skip TicketSeeder');
      return;
    }

    const venueId = targetEvent.venueId;

    await prisma.$transaction(async (tx) => {
      const seat = await tx.seat.findFirst({
        where: { venueId, isBooked: false },
        orderBy: { id: 'asc' },
        select: { id: true },
      });

      if (!seat) {
        console.warn('No available seat to assign for demo ticket');
        return;
      }

      const existingTicket = await tx.ticket.findUnique({
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
      if (!existingTicket || existingTicket.eventId !== targetEvent.id) {
        // If ticket existed with different event, decrement old event first
        if (existingTicket && existingTicket.eventId !== targetEvent.id) {
          await tx.event.update({
            where: { id: existingTicket.eventId },
            data: {
              registeredCount: {
                decrement: 1,
              },
            },
          });
        }
        // Increment registeredCount of the new event
        await tx.event.update({
          where: { id: targetEvent.id },
          data: {
            registeredCount: {
              increment: 1,
            },
          },
        });
      }

      await tx.seat.update({
        where: { id: seat.id },
        data: { isBooked: true },
      });
    });
  }
}
