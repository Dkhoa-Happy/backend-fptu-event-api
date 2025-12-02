import { PrismaClient } from '@prisma/client';
import type { Seeder } from './base.seeder';

export class EventSeeder implements Seeder {
  async seed(prisma: PrismaClient): Promise<void> {
    const campus =
      (await prisma.campus.findFirst({
        where: { code: 'FU-HCM' },
      })) ?? (await prisma.campus.findFirst());

    if (!campus) {
      // eslint-disable-next-line no-console
      console.warn('No campus found, skip EventSeeder');
      return;
    }

    const staff = await prisma.user.findUnique({
      where: { email: 'staff@example.com' },
    });
    const organizerUser = await prisma.user.findUnique({
      where: { email: 'organizer@example.com' },
    });
    const student = await prisma.user.findUnique({
      where: { email: 'student@example.com' },
    });

    if (!staff || !organizerUser || !student) {
      // eslint-disable-next-line no-console
      console.warn('Required users not found, skip EventSeeder');
      return;
    }

    const organizer = await prisma.organizer.upsert({
      where: { id: 1 },
      update: {},
      create: {
        name: 'FU HCM Event Club',
        description: 'Default event organizer for demo data',
        contactEmail: 'organizer@example.com',
        campusId: campus.id,
      },
    });

    const venue = await prisma.venue.upsert({
      where: { id: 1 },
      update: {},
      create: {
        name: 'FU HCM Hall A',
        location: 'FPT University Hồ Chí Minh',
        capacity: 500,
        hasSeats: false,
        campusId: campus.id,
      },
    });

    const now = new Date();
    const startRegister = new Date(now.getTime() - 24 * 60 * 60 * 1000); // yesterday
    const endRegister = new Date(now.getTime() + 24 * 60 * 60 * 1000); // tomorrow
    const startTime = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000); // +2 days
    const endTime = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000); // +3 days

    const event = await prisma.event.upsert({
      where: { id: 1 },
      update: {},
      create: {
        title: 'Demo Event - FU HCM',
        description: 'Sample event for seeded student registration',
        bannerUrl: null,
        startTimeRegister: startRegister,
        endTimeRegister: endRegister,
        startTime,
        endTime,
        status: 'OPEN',
        maxCapacity: 500,
        registeredCount: 1,
        hostId: staff.id,
        organizerId: organizer.id,
        venueId: venue.id,
      },
    });

    await prisma.ticket.upsert({
      where: { id: 1 },
      update: {},
      create: {
        qrCode: 'QR-STUDENT-DEMO-1',
        ticketStatus: 'REGISTERED',
        eventId: event.id,
        userId: student.id,
      },
    });
  }
}


