import { PrismaClient, EventStatus, TicketStatus } from '@prisma/client';
import { randomUUID } from 'crypto';
import type { Seeder } from './base.seeder';

export class EventSeeder implements Seeder {
  async seed(prisma: PrismaClient): Promise<void> {
    const campus =
      (await prisma.campus.findFirst({
        where: { code: 'FU-HCM' },
      })) ?? (await prisma.campus.findFirst());

    if (!campus) {
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
      console.warn('Required users not found, skip EventSeeder');
      return;
    }

    const organizer = await prisma.organizer.upsert({
      where: { id: 1 },
      update: {
        ownerId: organizerUser.id, // Set ownerId cho organizer
        logoUrl:
          'https://res.cloudinary.com/dpqvdxj10/image/upload/v1765203425/591501061_1442644294527717_8695305271568333145_n_nwatou.jpg',
      },
      create: {
        name: 'FU HCM Event Club',
        description: 'Default event organizer for demo data',
        contactEmail: 'organizer@example.com',
        campusId: campus.id,
        ownerId: organizerUser.id, // Set ownerId cho organizer
        logoUrl:
          'https://res.cloudinary.com/dpqvdxj10/image/upload/v1765203425/591501061_1442644294527717_8695305271568333145_n_nwatou.jpg',
      },
    });

    // Lấy venue đầu tiên của campus (venue seeder đã tạo sẵn)
    const venue = await prisma.venue.findFirst({
      where: {
        campusId: campus.id,
        status: 'ACTIVE',
      },
      orderBy: { id: 'asc' },
    });

    if (!venue) {
      console.warn('No venue found for campus, skip EventSeeder');
      return;
    }

    const now = new Date();
    const startRegister = new Date(now.getTime() - 24 * 60 * 60 * 1000); // yesterday
    const endRegister = new Date(now.getTime() + 24 * 60 * 60 * 1000); // tomorrow
    const startTime = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000); // +2 days
    const endTime = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000); // +3 days

    const eventsData = [
      {
        title: 'Demo event',
        description:
          'Sự kiện test để kiểm tra quét mã QR. Sự kiện này luôn bắt đầu vào hôm nay để có thể test check-in.',
        category: 'Technology',
        bannerUrl:
          'https://i.pinimg.com/736x/f0/0e/20/f00e20a1a907882495d85e263ca5ee9e.jpg',
        offsetDaysStart: 0, // Hôm nay
        durationHours: 4,
      },
      {
        title: 'FPT Tech Summit 2025',
        description:
          'Hội nghị công nghệ thường niên của FPT với các chủ đề AI, Cloud, Security.',
        category: 'Technology',
        bannerUrl:
          'https://i.pinimg.com/736x/f0/0e/20/f00e20a1a907882495d85e263ca5ee9e.jpg',
        offsetDaysStart: 7,
        durationHours: 8,
      },
      {
        title: 'Career Fair & Networking Day',
        description:
          'Ngày hội việc làm kết nối sinh viên và doanh nghiệp đối tác.',
        category: 'Career',
        bannerUrl:
          'https://i.pinimg.com/1200x/b0/55/48/b0554869cf9198e7011b45b06a6ff351.jpg',
        offsetDaysStart: 10,
        durationHours: 6,
      },
      {
        title: 'Innovation & Startup Showcase',
        description:
          'Trình diễn sản phẩm khởi nghiệp của sinh viên và CLB Innovation.',
        category: 'Startup',
        bannerUrl:
          'https://i.pinimg.com/736x/cc/d4/d5/ccd4d52eb880a3def9ee3936b92c1360.jpg',
        offsetDaysStart: 14,
        durationHours: 5,
      },
      {
        title: 'Data Science Workshop Series',
        description:
          'Chuỗi workshop về dữ liệu lớn, phân tích và trực quan hóa.',
        category: 'Data',
        bannerUrl:
          'https://i.pinimg.com/736x/4f/dc/e2/4fdce2ecff9d1d68510d4898aed0c3c4.jpg',
        offsetDaysStart: 3,
        durationHours: 4,
      },
      {
        title: 'Green Campus Sustainability Day',
        description:
          'Sự kiện truyền thông môi trường, thu gom rác và đổi rác lấy quà.',
        category: 'Community',
        bannerUrl:
          'https://i.pinimg.com/736x/63/ca/6e/63ca6ef17763f60e322d66e61700323c.jpg',
        offsetDaysStart: 5,
        durationHours: 3,
      },
    ];

    // Global events - visible to all campuses
    const globalEventsData = [
      {
        title: 'FPT University National Conference 2025',
        description:
          'Hội nghị toàn quốc của FPT University với sự tham gia của tất cả các campus. Chủ đề: "Digital Transformation in Education".',
        category: 'Education',
        bannerUrl:
          'https://i.pinimg.com/736x/f0/0e/20/f00e20a1a907882495d85e263ca5ee9e.jpg',
        offsetDaysStart: 20,
        durationHours: 8,
        isGlobal: true,
      },
      {
        title: 'FPT Alumni Global Meetup',
        description:
          'Gặp gỡ cựu sinh viên FPT từ khắp các campus, chia sẻ kinh nghiệm và networking.',
        category: 'Networking',
        bannerUrl:
          'https://i.pinimg.com/1200x/b0/55/48/b0554869cf9198e7011b45b06a6ff351.jpg',
        offsetDaysStart: 25,
        durationHours: 6,
        isGlobal: true,
      },
      {
        title: 'FPT Hackathon 2025 - Online Edition',
        description:
          'Cuộc thi lập trình trực tuyến dành cho tất cả sinh viên FPT. Giải thưởng hấp dẫn!',
        category: 'Competition',
        bannerUrl:
          'https://i.pinimg.com/736x/cc/d4/d5/ccd4d52eb880a3def9ee3936b92c1360.jpg',
        offsetDaysStart: 30,
        durationHours: 48,
        isGlobal: true,
        venueId: null, // Online event
      },
      {
        title: 'FPT Leadership Summit',
        description:
          'Hội nghị lãnh đạo sinh viên toàn hệ thống FPT University. Chia sẻ kinh nghiệm quản lý CLB và tổ chức sự kiện.',
        category: 'Leadership',
        bannerUrl:
          'https://i.pinimg.com/736x/4f/dc/e2/4fdce2ecff9d1d68510d4898aed0c3c4.jpg',
        offsetDaysStart: 35,
        durationHours: 6,
        isGlobal: true,
      },
    ];

    const createdEvents: { id: string; title: string }[] = [];

    // Seed local events (isGlobal = false)
    for (const item of eventsData) {
      const start = new Date(
        now.getTime() + item.offsetDaysStart * 24 * 60 * 60 * 1000,
      );
      const end = new Date(
        start.getTime() + item.durationHours * 60 * 60 * 1000,
      );
      // For test event (starts today), keep registration open until event starts
      // For other events, registration ends 12 hours before event starts
      let startReg: Date;
      let endReg: Date;
      if (item.offsetDaysStart === 0) {
        // Test event: registration starts 3 days ago, ends when event starts
        startReg = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
        endReg = new Date(start.getTime()); // Ends when event starts
      } else {
        // Normal events: registration ends 12 hours before event starts
        startReg = new Date(start.getTime() - 3 * 24 * 60 * 60 * 1000);
        endReg = new Date(start.getTime() - 12 * 60 * 60 * 1000);
      }

      const existing = await prisma.event.findFirst({
        where: { title: item.title },
        select: { id: true, title: true },
      });

      if (!existing) {
        const newEvent = await prisma.event.create({
          data: {
            title: item.title,
            description: item.description,
            category: item.category,
            bannerUrl: item.bannerUrl,
            startTimeRegister: startReg,
            endTimeRegister: endReg,
            startTime: start,
            endTime: end,
            status: EventStatus.PUBLISHED,
            maxCapacity: 5,
            registeredCount: 0,
            isGlobal: false,
            hostId: staff.id,
            organizerId: organizer.id,
            venueId: venue.id,
          },
        });
        createdEvents.push({ id: newEvent.id, title: newEvent.title });
      } else {
        // Update time for existing event to always use current date (for test events)
        // This ensures the event can be tested on any day
        await prisma.event.update({
          where: { id: existing.id },
          data: {
            startTimeRegister: startReg,
            endTimeRegister: endReg,
            startTime: start,
            endTime: end,
          },
        });
        createdEvents.push({ id: existing.id, title: existing.title });
      }
    }

    // Create ticket for student to join "Demo event" for testing QR check-in
    const demoEvent = await prisma.event.findFirst({
      where: { title: 'Demo event' },
      select: { id: true, venueId: true, registeredCount: true },
    });

    if (demoEvent && demoEvent.venueId) {
      // Check if ticket already exists for this student and event
      const existingTicket = await prisma.ticket.findFirst({
        where: {
          userId: student.id,
          eventId: demoEvent.id,
        },
        select: { id: true },
      });

      if (!existingTicket) {
        // Find an available seat that is not booked for this event
        const seat = await prisma.seat.findFirst({
          where: {
            venueId: demoEvent.venueId,
            isActive: true,
            tickets: {
              none: {
                eventId: demoEvent.id,
                status: {
                  in: [TicketStatus.VALID, TicketStatus.USED],
                },
              },
            },
          },
          orderBy: { id: 'asc' },
          select: { id: true },
        });

        if (seat) {
          // Generate unique QR code
          const qrCode = randomUUID();

          // Create ticket and increment registeredCount in transaction
          await prisma.$transaction(async (tx) => {
            await tx.ticket.create({
              data: {
                qrCode,
                userId: student.id,
                eventId: demoEvent.id,
                seatId: seat.id,
                status: TicketStatus.VALID,
              },
            });

            // Increment registeredCount
            await tx.event.update({
              where: { id: demoEvent.id },
              data: {
                registeredCount: {
                  increment: 1,
                },
              },
            });
          });
        }
      }
    }

    // Seed global events (isGlobal = true)
    for (const item of globalEventsData) {
      const start = new Date(
        now.getTime() + item.offsetDaysStart * 24 * 60 * 60 * 1000,
      );
      const end = new Date(
        start.getTime() + item.durationHours * 60 * 60 * 1000,
      );
      const startReg = new Date(start.getTime() - 3 * 24 * 60 * 60 * 1000);
      const endReg = new Date(start.getTime() - 12 * 60 * 60 * 1000);

      const existing = await prisma.event.findFirst({
        where: { title: item.title },
        select: { id: true, title: true },
      });

      if (!existing) {
        const newEvent = await prisma.event.create({
          data: {
            title: item.title,
            description: item.description,
            category: item.category,
            bannerUrl: item.bannerUrl,
            startTimeRegister: startReg,
            endTimeRegister: endReg,
            startTime: start,
            endTime: end,
            status: EventStatus.PUBLISHED,
            maxCapacity: 100,
            registeredCount: 0,
            isGlobal: item.isGlobal ?? true,
            hostId: staff.id,
            organizerId: organizer.id,
            venueId: item.venueId ?? venue.id,
          },
        });
        createdEvents.push({ id: newEvent.id, title: newEvent.title });
      } else {
        // Update time for existing event to always use current date (for test events)
        // This ensures the event can be tested on any day
        await prisma.event.update({
          where: { id: existing.id },
          data: {
            startTimeRegister: startReg,
            endTimeRegister: endReg,
            startTime: start,
            endTime: end,
          },
        });
        createdEvents.push({ id: existing.id, title: existing.title });
      }
    }

    // Seed speakers
    const speakersData = [
      {
        name: 'Nguyễn Minh Trí',
        bio: 'Chuyên gia AI/ML tại FPT Software, 8 năm kinh nghiệm triển khai sản phẩm AI.',
        avatar:
          'https://i.pinimg.com/736x/69/78/19/69781905dd57ba144ab71ca4271ab294.jpg',
        type: 'external',
        company: 'FPT Software',
      },
      {
        name: 'Lê Thùy Dung',
        bio: 'Data Scientist, tập trung vào Big Data & BI cho lĩnh vực tài chính.',
        avatar:
          'https://i.pinimg.com/736x/8c/6d/db/8c6ddb5fe6600fcc4b183cb2ee228eb7.jpg',
        type: 'external',
        company: 'FPT IS',
      },
      {
        name: 'Phạm Anh Khoa',
        bio: 'Product Manager về nền tảng Cloud & DevOps, chia sẻ về vận hành quy mô lớn.',
        avatar:
          'https://i.pinimg.com/736x/da/36/3b/da363b913ed65af5aa1c496011ec4164.jpg',
        type: 'external',
        company: 'FPT Cloud',
      },
    ];

    const speakerIds: number[] = [];
    for (const sp of speakersData) {
      const existing = await prisma.speaker.findFirst({
        where: { name: sp.name },
        select: { id: true },
      });
      if (existing) {
        speakerIds.push(existing.id);
      } else {
        const created = await prisma.speaker.create({
          data: {
            name: sp.name,
            bio: sp.bio,
            avatar: sp.avatar,
            type: sp.type,
            company: sp.company,
          },
          select: { id: true },
        });
        speakerIds.push(created.id);
      }
    }

    // Gắn 3 speaker vào mỗi event (tránh trùng)
    for (const ev of createdEvents) {
      for (const speakerId of speakerIds) {
        const exists = await prisma.eventSpeaker.findFirst({
          where: { eventId: ev.id, speakerId },
        });
        if (!exists) {
          await prisma.eventSpeaker.create({
            data: {
              eventId: ev.id,
              speakerId,
              topic: `Chia sẻ tại ${ev.title}`,
            },
          });
        }
      }
    }
  }
}
