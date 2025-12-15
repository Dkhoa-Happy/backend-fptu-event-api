import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CheckinGateway } from '../realtime/checkin.gateway';
import {
  CreateTicketDto,
  UpdateTicketDto,
  QueryTicketDto,
  QueryMyTicketDto,
  QueryEventAttendeesDto,
  ManualCheckinDto,
} from './dto';
import { TicketStatus } from '@prisma/client';

@Injectable()
export class TicketService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly checkinGateway: CheckinGateway,
  ) {}

  async create(dto: CreateTicketDto, userId: number) {
    // Get user info to check campus
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        campusId: true,
        roleName: true,
      },
    });

    if (!user) {
      throw new NotFoundException('Không tìm thấy user');
    }

    // Check if event exists and get registration time
    const event = await this.prisma.event.findUnique({
      where: { id: dto.eventId },
      select: {
        id: true,
        title: true,
        startTimeRegister: true,
        endTimeRegister: true,
        status: true,
        maxCapacity: true,
        registeredCount: true,
        isGlobal: true,
        venueId: true,
        venue: {
          select: {
            id: true,
            campusId: true,
          },
        },
      },
    });

    if (!event) {
      throw new NotFoundException(`Event with ID ${dto.eventId} not found`);
    }

    // Check if event is published
    if (event.status !== 'PUBLISHED') {
      throw new BadRequestException(
        'Không thể đăng ký sự kiện này. Sự kiện chưa được công bố.',
      );
    }

    // Check campus restriction for non-global events
    if (!event.isGlobal) {
      // If event is not global, student must be from the same campus as the venue
      if (!event.venue) {
        throw new BadRequestException(
          'Event không có venue. Không thể đăng ký sự kiện này.',
        );
      }

      if (user.campusId !== event.venue.campusId) {
        throw new ForbiddenException(
          'Bạn không thể đăng ký sự kiện này. Sự kiện chỉ dành cho sinh viên thuộc campus của venue.',
        );
      }
    }
    // If isGlobal = true, allow all students from any campus

    // Check if event has reached max capacity
    if (event.registeredCount >= event.maxCapacity) {
      throw new BadRequestException(
        `Sự kiện đã đạt số lượng tối đa (${event.maxCapacity} người). Không thể đăng ký thêm.`,
      );
    }

    // Check registration time
    const now = new Date();
    const startTime = new Date(event.startTimeRegister);
    const endTime = new Date(event.endTimeRegister);

    if (now < startTime) {
      throw new BadRequestException(
        `Đăng ký chưa bắt đầu. Đăng ký bắt đầu lúc ${startTime.toISOString()}`,
      );
    }

    if (now > endTime) {
      throw new BadRequestException(
        `Đăng ký đã kết thúc. Đăng ký kết thúc lúc ${endTime.toISOString()}`,
      );
    }

    // Check if user already has a ticket for this event
    const existingTicket = await this.prisma.ticket.findFirst({
      where: {
        userId,
        eventId: dto.eventId,
      },
    });

    if (existingTicket) {
      if (existingTicket.status === 'CANCELLED') {
        throw new BadRequestException(
          'Bạn đã hủy vé cho sự kiện này trước đó. Vui lòng liên hệ admin nếu muốn đăng ký lại.',
        );
      }
      if (existingTicket.status === 'EXPIRED') {
        throw new BadRequestException(
          'Bạn đã có vé cho sự kiện này nhưng đã hết hạn. Vui lòng liên hệ admin nếu muốn đăng ký lại.',
        );
      }
      throw new BadRequestException(
        'Bạn đã đăng ký sự kiện này rồi. Mỗi người chỉ có thể đăng ký 1 lần cho mỗi sự kiện.',
      );
    }

    // Check if seat exists and is active
    const seat = await this.prisma.seat.findUnique({
      where: { id: dto.seatId },
      select: {
        id: true,
        venueId: true,
        isActive: true,
      },
    });

    if (!seat) {
      throw new NotFoundException(`Không tìm thấy ghế với ID ${dto.seatId}`);
    }

    if (!seat.isActive) {
      throw new BadRequestException('Ghế không đang hoạt động');
    }

    // Validate that seat belongs to the event's venue
    if (!event.venueId) {
      throw new BadRequestException(
        'Sự kiện này không có venue (có thể là sự kiện online). Không thể chọn ghế.',
      );
    }

    if (seat.venueId !== event.venueId) {
      throw new BadRequestException(
        `Ghế này không thuộc venue của sự kiện. Ghế thuộc venue ID ${seat.venueId}, nhưng sự kiện tổ chức tại venue ID ${event.venueId}.`,
      );
    }

    // Check if seat is already booked for this event (only check VALID/USED tickets)
    // CANCELLED/EXPIRED tickets will be handled in transaction to allow re-booking
    const existingSeatBooking = await this.prisma.ticket.findFirst({
      where: {
        eventId: dto.eventId,
        seatId: dto.seatId,
        status: {
          in: ['VALID', 'USED'], // Chỉ check các ticket còn hiệu lực hoặc đã dùng
        },
      },
    });

    if (existingSeatBooking) {
      throw new BadRequestException('Ghế này đã được đặt cho sự kiện này');
    }

    // Generate unique QR code using UUID v4
    let qrCode: string;
    let isUnique = false;
    let attempts = 0;
    const maxAttempts = 10;

    // Ensure QR code is unique (retry if collision occurs)
    while (!isUnique && attempts < maxAttempts) {
      qrCode = randomUUID();
      const existingQrCode = await this.prisma.ticket.findUnique({
        where: { qrCode },
      });

      if (!existingQrCode) {
        isUnique = true;
      }
      attempts++;
    }

    if (!isUnique) {
        throw new BadRequestException(
          'Không thể tạo mã QR duy nhất. Vui lòng thử lại.',
        );
    }

    try {
      // Use transaction to ensure data consistency
      return await this.prisma.$transaction(async (tx) => {
        // Double-check capacity within transaction to prevent race condition
        const currentEvent = await tx.event.findUnique({
          where: { id: dto.eventId },
          select: {
            maxCapacity: true,
            registeredCount: true,
          },
        });

        if (!currentEvent) {
          throw new NotFoundException(`Không tìm thấy sự kiện với ID ${dto.eventId}`);
        }

        if (currentEvent.registeredCount >= currentEvent.maxCapacity) {
          throw new BadRequestException(
            `Sự kiện đã đạt số lượng tối đa (${currentEvent.maxCapacity} người). Không thể đăng ký thêm.`,
          );
        }

        // Double-check user ticket within transaction to prevent race condition
        const existingUserTicket = await tx.ticket.findFirst({
          where: {
            userId,
            eventId: dto.eventId,
          },
        });

        if (existingUserTicket) {
          if (
            existingUserTicket.status === 'VALID' ||
            existingUserTicket.status === 'USED'
          ) {
            throw new BadRequestException(
              'Bạn đã đăng ký sự kiện này rồi. Mỗi người chỉ có thể đăng ký 1 lần cho mỗi sự kiện.',
            );
          }
          // If CANCELLED or EXPIRED, delete it to allow new booking
          // Note: registeredCount was already decremented when ticket was cancelled/expired
          await tx.ticket.delete({
            where: { id: existingUserTicket.id },
          });
        }

        // Double-check seat booking within transaction to prevent race condition
        // Only check VALID/USED tickets, CANCELLED/EXPIRED will be deleted below
        const existingSeatTicket = await tx.ticket.findFirst({
          where: {
            eventId: dto.eventId,
            seatId: dto.seatId,
            status: {
              in: ['VALID', 'USED'],
            },
          },
        });

        if (existingSeatTicket) {
          throw new BadRequestException('Ghế này đã được đặt cho sự kiện này');
        }

        // Delete any CANCELLED/EXPIRED tickets for this seat to allow re-booking
        // This handles the case where someone cancelled/expired and someone else wants to book
        await tx.ticket.deleteMany({
          where: {
            eventId: dto.eventId,
            seatId: dto.seatId,
            status: {
              in: ['CANCELLED', 'EXPIRED'],
            },
          },
        });

        // Create ticket
        const ticket = await tx.ticket.create({
          data: {
            qrCode: qrCode!,
            userId,
            eventId: dto.eventId,
            seatId: dto.seatId,
            status: 'VALID',
          },
          include: {
            user: {
              select: {
                id: true,
                userName: true,
                email: true,
                firstName: true,
                lastName: true,
                studentCode: true,
              },
            },
            event: {
              select: {
                id: true,
                title: true,
                description: true,
                startTime: true,
                endTime: true,
                status: true,
                bannerUrl: true,
                venue: {
                  select: {
                    id: true,
                    name: true,
                    location: true,
                  },
                },
              },
            },
            seat: {
              select: {
                id: true,
                rowLabel: true,
                colLabel: true,
                seatType: true,
                isBooked: true,
              },
            },
          },
        });

        // Note: Không cần set isBooked vì availability được check qua Ticket với eventId
        // Mỗi event có thể book cùng một seat ở các thời điểm khác nhau

        // Increment registeredCount of the event
        await tx.event.update({
          where: { id: dto.eventId },
          data: {
            registeredCount: {
              increment: 1,
            },
          },
        });

        return ticket;
      });
    } catch (error: unknown) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        (error as { code: string }).code === 'P2002'
      ) {
        // Unique constraint violation
        const meta =
          'meta' in error && typeof error.meta === 'object'
            ? (error.meta as { target?: string[] })
            : undefined;

        const targetFields = meta?.target || [];

        // Check for userId + eventId constraint violation
        if (
          targetFields.includes('userId') &&
          targetFields.includes('eventId')
        ) {
          throw new BadRequestException(
            'Bạn đã đăng ký sự kiện này rồi. Mỗi người chỉ có thể đăng ký 1 lần cho mỗi sự kiện.',
          );
        }

        // Check for eventId + seatId constraint violation
        if (
          targetFields.includes('eventId') &&
          targetFields.includes('seatId')
        ) {
          throw new BadRequestException(
            'Ghế này đã được đặt cho sự kiện này. Vui lòng chọn ghế khác.',
          );
        }

        // Check for qrCode constraint violation (shouldn't happen with UUID, but just in case)
        if (targetFields.includes('qrCode')) {
          throw new BadRequestException(
            'Lỗi tạo mã QR. Vui lòng thử lại.',
          );
        }

        // Generic unique constraint violation
        throw new BadRequestException(
          `Vi phạm ràng buộc duy nhất. Có thể bạn đã đăng ký sự kiện này hoặc ghế đã được chọn. Chi tiết: ${JSON.stringify(targetFields)}`,
        );
      }

      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        (error as { code: string }).code === 'P2003'
      ) {
        throw new NotFoundException('Không tìm thấy user hoặc seat');
      }

      throw error;
    }
  }

  async findAll(query: QueryTicketDto) {
    const { page = 1, limit = 10, status, userId, eventId } = query;

    const where: Prisma.TicketWhereInput = {};

    if (status) {
      where.status = status;
    }

    if (userId) {
      where.userId = userId;
    }

    if (eventId) {
      where.eventId = eventId;
    }

    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      this.prisma.ticket.findMany({
        where,
        skip,
        take: limit,
        orderBy: { bookingDate: 'desc' },
        include: {
          user: {
            select: {
              id: true,
              userName: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
          event: {
            select: {
              id: true,
              title: true,
              description: true,
              startTime: true,
              endTime: true,
              status: true,
              bannerUrl: true,
              venue: {
                select: {
                  id: true,
                  name: true,
                  location: true,
                },
              },
            },
          },
        },
      }),
      this.prisma.ticket.count({ where }),
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

  async findOne(id: string) {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            userName: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        event: {
          select: {
            id: true,
            title: true,
            description: true,
            startTime: true,
            endTime: true,
            status: true,
            bannerUrl: true,
            organizer: {
              select: {
                id: true,
                name: true,
                logoUrl: true,
              },
            },
            venue: {
              select: {
                id: true,
                name: true,
                location: true,
              },
            },
          },
        },
        seat: {
          select: {
            id: true,
            rowLabel: true,
            colLabel: true,
            seatType: true,
            isActive: true,
            isBooked: true,
          },
        },
      },
    });

    if (!ticket) {
      throw new NotFoundException(`Không tìm thấy vé với ID ${id}`);
    }

    return ticket;
  }

  async findMyTickets(userId: number, query: QueryMyTicketDto) {
    const { page = 1, limit = 10, status, eventId } = query;

    const where: Prisma.TicketWhereInput = {
      userId,
    };

    if (status) {
      where.status = status;
    }

    if (eventId) {
      where.eventId = eventId;
    }

    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      this.prisma.ticket.findMany({
        where,
        skip,
        take: limit,
        orderBy: { bookingDate: 'desc' },
        include: {
          seat: {
            select: {
              id: true,
              rowLabel: true,
              colLabel: true,
              seatType: true,
              isActive: true,
              venueId: true,
            },
          },
          event: {
            select: {
              id: true,
              title: true,
              description: true,
              startTime: true,
              endTime: true,
              status: true,
              bannerUrl: true,
              organizer: {
                select: {
                  id: true,
                  name: true,
                  logoUrl: true,
                },
              },
              venue: {
                select: {
                  id: true,
                  name: true,
                  location: true,
                },
              },
            },
          },
        },
      }),
      this.prisma.ticket.count({ where }),
    ]);

    // Auto-update expired tickets
    await this.updateExpiredTickets(items);

    // Reload items to get updated status
    const updatedItems = await this.prisma.ticket.findMany({
      where: {
        id: { in: items.map((item) => item.id) },
      },
      include: {
        seat: {
          select: {
            id: true,
            rowLabel: true,
            colLabel: true,
            seatType: true,
            isActive: true,
          },
        },
        event: {
          select: {
            id: true,
            title: true,
            description: true,
            startTime: true,
            endTime: true,
            status: true,
            bannerUrl: true,
            organizer: {
              select: {
                id: true,
                name: true,
                logoUrl: true,
              },
            },
            venue: {
              select: {
                id: true,
                name: true,
                location: true,
              },
            },
          },
        },
      },
      orderBy: { bookingDate: 'desc' },
    });

    return {
      data: updatedItems,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findByQrCode(qrCode: string) {
    const ticket = await this.prisma.ticket.findUnique({
      where: { qrCode },
      include: {
        user: {
          select: {
            id: true,
            userName: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        event: {
          select: {
            id: true,
            title: true,
            description: true,
            startTime: true,
            endTime: true,
            status: true,
            bannerUrl: true,
            organizer: {
              select: {
                id: true,
                name: true,
                logoUrl: true,
              },
            },
            venue: {
              select: {
                id: true,
                name: true,
                location: true,
              },
            },
          },
        },
      },
    });

    if (!ticket) {
      throw new NotFoundException(`Không tìm thấy vé với mã QR ${qrCode}`);
    }

    // Check and update expired tickets
    await this.checkAndUpdateExpiredTicket(ticket.id, ticket.event.endTime);

    // Reload ticket to get updated status
    const updatedTicket = await this.prisma.ticket.findUnique({
      where: { qrCode },
      include: {
        user: {
          select: {
            id: true,
            userName: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        event: {
          select: {
            id: true,
            title: true,
            description: true,
            startTime: true,
            endTime: true,
            status: true,
            bannerUrl: true,
            organizer: {
              select: {
                id: true,
                name: true,
                logoUrl: true,
              },
            },
            venue: {
              select: {
                id: true,
                name: true,
                location: true,
              },
            },
          },
        },
      },
    });

    return updatedTicket!;
  }

  async update(id: string, dto: UpdateTicketDto) {
    // Check if ticket exists
    const existingTicket = await this.prisma.ticket.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        seatId: true,
        checkinTime: true,
      },
    });

    if (!existingTicket) {
      throw new NotFoundException(`Không tìm thấy vé với ID ${id}`);
    }

    try {
      const updateData: Prisma.TicketUncheckedUpdateInput = {};

      if (dto.status !== undefined) {
        updateData.status = dto.status;
        // If status is changed to USED, set checkinTime
        if (dto.status === 'USED' && !existingTicket.checkinTime) {
          updateData.checkinTime = new Date();
        }
        // Note: Không cần set isBooked = false vì availability được check qua Ticket với eventId
      }

      const ticket = await this.prisma.ticket.update({
        where: { id },
        data: updateData,
        include: {
          user: {
            select: {
              id: true,
              userName: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
          event: {
            select: {
              id: true,
              title: true,
              description: true,
              startTime: true,
              endTime: true,
              status: true,
              bannerUrl: true,
              venue: {
                select: {
                  id: true,
                  name: true,
                  location: true,
                },
              },
            },
          },
        },
      });

      return ticket;
    } catch (error: unknown) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        (error as { code: string }).code === 'P2025'
      ) {
        throw new NotFoundException(`Không tìm thấy vé với ID ${id}`);
      }

      throw error;
    }
  }

  async cancel(id: string, userId: number) {
    // Check if ticket exists and belongs to user
    const ticket = await this.prisma.ticket.findUnique({
      where: { id },
      include: {
        event: {
          select: {
            id: true,
            title: true,
            startTime: true,
          },
        },
        seat: {
          select: {
            id: true,
            isBooked: true,
          },
        },
      },
    });

    if (!ticket) {
      throw new NotFoundException(`Không tìm thấy vé với ID ${id}`);
    }

    // Check if ticket belongs to the user
    if (ticket.userId !== userId) {
      throw new ForbiddenException(
        'Bạn không có quyền hủy vé này. Vé này không thuộc về bạn.',
      );
    }

    // Check if ticket is already cancelled, used, or expired
    if (ticket.status === 'CANCELLED') {
      throw new BadRequestException('Vé này đã bị hủy rồi');
    }

    if (ticket.status === 'USED') {
      throw new BadRequestException('Vé này đã được sử dụng, không thể hủy');
    }

    if (ticket.status === 'EXPIRED') {
      throw new BadRequestException('Vé này đã hết hạn, không thể hủy');
    }

    // Check if cancellation is allowed (at least 1 day before event start)
    const now = new Date();
    const eventStartTime = new Date(ticket.event.startTime);
    const oneDayInMs = 24 * 60 * 60 * 1000; // 1 day in milliseconds
    const timeUntilEvent = eventStartTime.getTime() - now.getTime();

    if (timeUntilEvent <= oneDayInMs) {
      throw new BadRequestException(
        `Không thể hủy vé. Chỉ có thể hủy vé trước khi sự kiện diễn ra ít nhất 1 ngày. Sự kiện bắt đầu lúc ${eventStartTime.toISOString()}`,
      );
    }

    // Use transaction to ensure data consistency
    return await this.prisma.$transaction(async (tx) => {
      // Update ticket status to CANCELLED
      const updatedTicket = await tx.ticket.update({
        where: { id },
        data: {
          status: 'CANCELLED',
        },
        include: {
          user: {
            select: {
              id: true,
              userName: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
          event: {
            select: {
              id: true,
              title: true,
              description: true,
              startTime: true,
              endTime: true,
              status: true,
              bannerUrl: true,
              venue: {
                select: {
                  id: true,
                  name: true,
                  location: true,
                },
              },
            },
          },
          seat: {
            select: {
              id: true,
              rowLabel: true,
              colLabel: true,
              seatType: true,
              isBooked: true,
            },
          },
        },
      });

      // Free the seat (set isBooked to false) if seat exists
      if (ticket.seatId) {
        await tx.seat.update({
          where: { id: ticket.seatId },
          data: {
            isBooked: false,
          },
        });
      }

      // Decrement registeredCount of the event
      await tx.event.update({
        where: { id: ticket.eventId },
        data: {
          registeredCount: {
            decrement: 1,
          },
        },
      });

      return {
        message: 'Vé đã được hủy thành công',
        ticket: updatedTicket,
      };
    });
  }

  async remove(id: string) {
    // Check if ticket exists
    const ticket = await this.prisma.ticket.findUnique({
      where: { id },
    });

    if (!ticket) {
      throw new NotFoundException(`Không tìm thấy vé với ID ${id}`);
    }

    try {
      // Use transaction to ensure data consistency
      return await this.prisma.$transaction(async (tx) => {
        // Delete ticket
        await tx.ticket.delete({
          where: { id },
        });

        // Decrement registeredCount of the event
        await tx.event.update({
          where: { id: ticket.eventId },
          data: {
            registeredCount: {
              decrement: 1,
            },
          },
        });

        // Note: Không cần set isBooked = false vì availability được check qua Ticket với eventId

        return {
          message: `Ticket with ID ${id} has been deleted successfully`,
        };
      });
    } catch (error: unknown) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        (error as { code: string }).code === 'P2025'
      ) {
        throw new NotFoundException(`Không tìm thấy vé với ID ${id}`);
      }

      // Handle foreign key constraint errors
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        (error as { code: string }).code === 'P2003'
      ) {
        throw new BadRequestException(
          'Không thể xóa vé vì nó đang được tham chiếu bởi các bản ghi khác',
        );
      }

      throw error;
    }
  }

  async scanTicket(qrCode: string, staffId: number) {
    // Validate that staff exists
    const staff = await this.prisma.user.findUnique({
      where: { id: staffId },
    });

    if (!staff) {
      throw new NotFoundException(`Không tìm thấy staff với ID ${staffId}`);
    }

    // Use transaction to ensure data consistency
    return await this.prisma.$transaction(async (tx) => {
      // Find ticket by QR code
      const ticket = await tx.ticket.findUnique({
        where: { qrCode },
        include: {
          user: {
            select: {
              id: true,
              userName: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
          event: {
            select: {
              id: true,
              title: true,
              startTime: true,
              endTime: true,
              bannerUrl: true,
              venue: {
                select: {
                  id: true,
                  name: true,
                  location: true,
                },
              },
            },
          },
        },
      });

      if (!ticket) {
        throw new NotFoundException(`Không tìm thấy vé với mã QR ${qrCode}`);
      }

      // Check if staff is assigned to this event
      const eventStaff = await tx.eventStaff.findFirst({
        where: {
          eventId: ticket.eventId,
          userId: staffId,
        },
      });

      if (!eventStaff) {
        throw new ForbiddenException(
          'Bạn không được phân công cho sự kiện này. Chỉ staff được phân công mới có thể quét vé cho sự kiện này.',
        );
      }

      // Check if event has started
      const now = new Date();
      const eventStartTime = new Date(ticket.event.startTime);
      if (now < eventStartTime) {
        throw new BadRequestException(
          `Chưa thể quét mã QR. Sự kiện sẽ bắt đầu lúc ${eventStartTime.toLocaleString('vi-VN')}. Vui lòng quét lại sau khi sự kiện bắt đầu.`,
        );
      }

      // Check if ticket is expired (event has ended)
      if (new Date(ticket.event.endTime) < now && ticket.status === 'VALID') {
        // Auto-update expired ticket
        await tx.ticket.update({
          where: { id: ticket.id },
          data: { status: 'EXPIRED' },
        });
        ticket.status = 'EXPIRED';
      }

      // Check ticket status
      if (ticket.status === 'USED') {
        return {
          success: false,
          message: 'Vé đã được sử dụng',
          ticket: null,
        };
      }

      if (ticket.status === 'CANCELLED') {
        return {
          success: false,
          message: 'Vé đã bị hủy',
          ticket: null,
        };
      }

      if (ticket.status === 'EXPIRED') {
        return {
          success: false,
          message: 'Vé đã hết hạn. Sự kiện đã kết thúc.',
          ticket: null,
        };
      }

      // Ticket is VALID - proceed with check-in
      if (ticket.status === 'VALID') {
        // Update ticket status to USED
        const updatedTicket = await tx.ticket.update({
          where: { id: ticket.id },
          data: {
            status: 'USED',
            checkinTime: new Date(),
          },
          include: {
            user: {
              select: {
                id: true,
                userName: true,
                email: true,
                firstName: true,
                lastName: true,
                studentCode: true,
              },
            },
            event: {
              select: {
                id: true,
                title: true,
                startTime: true,
                endTime: true,
                bannerUrl: true,
                venue: {
                  select: {
                    id: true,
                    name: true,
                    location: true,
                  },
                },
              },
            },
          },
        });

        // Publish realtime check-in event to event room
        this.checkinGateway.broadcastCheckin(ticket.eventId, {
          ticketId: updatedTicket.id,
          eventId: updatedTicket.eventId,
          user: updatedTicket.user,
          status: updatedTicket.status,
          checkinTime: updatedTicket.checkinTime,
          handledBy: staffId,
        });

        return {
          success: true,
          message: 'Check-in thành công',
          ticket: updatedTicket,
          user: updatedTicket.user,
        };
      }

      return {
        success: false,
        message: `Trạng thái vé không xác định: ${String(ticket.status)}`,
        ticket: null,
      };
    });
  }

  async manualCheckin(dto: ManualCheckinDto) {
    const { ticketId, studentCode, eventId, staffId } = dto;

    // Validate input: either ticketId or (studentCode + eventId) must be provided
    if (!ticketId && (!studentCode || !eventId)) {
      throw new BadRequestException(
        'Vui lòng cung cấp ticketId hoặc (studentCode + eventId) để check-in',
      );
    }

    // Validate that staff exists
    const staff = await this.prisma.user.findUnique({
      where: { id: staffId },
    });

    if (!staff) {
      throw new NotFoundException(`Không tìm thấy staff với ID ${staffId}`);
    }

    // Use transaction to ensure data consistency
    return await this.prisma.$transaction(async (tx) => {
      // Find ticket by ticketId or studentCode + eventId
      let ticket;
      if (ticketId) {
        ticket = await tx.ticket.findUnique({
          where: { id: ticketId },
          include: {
            user: {
              select: {
                id: true,
                userName: true,
                email: true,
                firstName: true,
                lastName: true,
                studentCode: true,
              },
            },
            event: {
              select: {
                id: true,
                title: true,
                startTime: true,
                endTime: true,
                bannerUrl: true,
                venue: {
                  select: {
                    id: true,
                    name: true,
                    location: true,
                  },
                },
              },
            },
          },
        });
      } else if (studentCode && eventId) {
        // First, find user by studentCode
        const user = await tx.user.findUnique({
          where: { studentCode },
          select: { id: true },
        });

        if (!user) {
          throw new NotFoundException(
            `Không tìm thấy user với student code ${studentCode}`,
          );
        }

        // Then find ticket by userId + eventId
        ticket = await tx.ticket.findFirst({
          where: {
            userId: user.id,
            eventId,
          },
          include: {
            user: {
              select: {
                id: true,
                userName: true,
                email: true,
                firstName: true,
                lastName: true,
                studentCode: true,
              },
            },
            event: {
              select: {
                id: true,
                title: true,
                startTime: true,
                endTime: true,
                bannerUrl: true,
                venue: {
                  select: {
                    id: true,
                    name: true,
                    location: true,
                  },
                },
              },
            },
          },
        });
      }

      if (!ticket) {
        if (ticketId) {
          throw new NotFoundException(
            `Không tìm thấy vé với ID ${ticketId}`,
          );
        } else {
          throw new NotFoundException(
            `Không tìm thấy vé cho student code ${studentCode} và event ID ${eventId}`,
          );
        }
      }

      // Check if staff is assigned to this event
      const eventStaff = await tx.eventStaff.findFirst({
        where: {
          eventId: ticket.eventId,
          userId: staffId,
        },
      });

      if (!eventStaff) {
        throw new ForbiddenException(
          'Bạn không được phân công cho sự kiện này. Chỉ staff được phân công mới có thể check-in cho sự kiện này.',
        );
      }

      // Check if event has started
      const now = new Date();
      const eventStartTime = new Date(ticket.event.startTime);
      if (now < eventStartTime) {
        throw new BadRequestException(
          `Chưa thể check-in. Sự kiện sẽ bắt đầu lúc ${eventStartTime.toLocaleString('vi-VN')}. Vui lòng check-in sau khi sự kiện bắt đầu.`,
        );
      }

      // Check if ticket is expired (event has ended)
      if (new Date(ticket.event.endTime) < now && ticket.status === 'VALID') {
        // Auto-update expired ticket
        await tx.ticket.update({
          where: { id: ticket.id },
          data: { status: 'EXPIRED' },
        });
        ticket.status = 'EXPIRED';
      }

      // Check ticket status
      if (ticket.status === 'USED') {
        return {
          success: false,
          message: 'Vé đã được sử dụng',
          ticket: null,
        };
      }

      if (ticket.status === 'CANCELLED') {
        return {
          success: false,
          message: 'Vé đã bị hủy',
          ticket: null,
        };
      }

      if (ticket.status === 'EXPIRED') {
        return {
          success: false,
          message: 'Vé đã hết hạn. Sự kiện đã kết thúc.',
          ticket: null,
        };
      }

      // Ticket is VALID - proceed with check-in
      if (ticket.status === 'VALID') {
        // Update ticket status to USED
        const updatedTicket = await tx.ticket.update({
          where: { id: ticket.id },
          data: {
            status: 'USED',
            checkinTime: new Date(),
          },
          include: {
            user: {
              select: {
                id: true,
                userName: true,
                email: true,
                firstName: true,
                lastName: true,
                studentCode: true,
              },
            },
            event: {
              select: {
                id: true,
                title: true,
                startTime: true,
                endTime: true,
                bannerUrl: true,
                venue: {
                  select: {
                    id: true,
                    name: true,
                    location: true,
                  },
                },
              },
            },
          },
        });

        // Publish realtime check-in event to event room
        this.checkinGateway.broadcastCheckin(ticket.eventId, {
          ticketId: updatedTicket.id,
          eventId: updatedTicket.eventId,
          user: updatedTicket.user,
          status: updatedTicket.status,
          checkinTime: updatedTicket.checkinTime,
          handledBy: staffId,
        });

        return {
          success: true,
          message: 'Check-in thủ công thành công',
          ticket: updatedTicket,
          user: updatedTicket.user,
        };
      }

      return {
        success: false,
        message: `Trạng thái vé không xác định: ${String(ticket.status)}`,
        ticket: null,
      };
    });
  }

  /**
   * Check and update expired tickets (event has ended)
   * Only updates VALID tickets that have passed event end time
   */
  private async checkAndUpdateExpiredTicket(
    ticketId: string,
    eventEndTime: Date,
  ): Promise<void> {
    const now = new Date();
    if (now > new Date(eventEndTime)) {
      await this.prisma.ticket.updateMany({
        where: {
          id: ticketId,
          status: 'VALID',
        },
        data: {
          status: 'EXPIRED',
        },
      });
    }
  }

  /**
   * Batch update expired tickets for multiple tickets
   */
  private async updateExpiredTickets(
    tickets: Array<{ id: string; event: { endTime: Date } }>,
  ): Promise<void> {
    const now = new Date();
    const expiredTicketIds = tickets
      .filter((t) => t.event && new Date(t.event.endTime) < now)
      .map((t) => t.id);

    if (expiredTicketIds.length > 0) {
      await this.prisma.ticket.updateMany({
        where: {
          id: { in: expiredTicketIds },
          status: 'VALID',
        },
        data: {
          status: 'EXPIRED',
        },
      });
    }
  }

  /**
   * Get attendees and summary for a specific event
   */
  async getEventAttendees(
    eventId: string,
    query: QueryEventAttendeesDto,
    currentUser?: { id?: number; roleName?: string },
  ) {
    // 1) Permission checks
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      select: {
        id: true,
        organizer: {
          select: { ownerId: true },
        },
        eventStaffs: {
          select: { userId: true },
        },
      },
    });

    if (!event) {
      throw new NotFoundException(`Event with ID ${eventId} not found`);
    }

    const isAdmin = currentUser?.roleName === 'admin';
    const isOrganizerOwner =
      currentUser?.roleName === 'event_organizer' &&
      event.organizer?.ownerId === currentUser?.id;
    const isAssignedStaff =
      currentUser?.roleName === 'staff' &&
      event.eventStaffs.some((s) => s.userId === currentUser?.id);

    if (!isAdmin && !isOrganizerOwner && !isAssignedStaff) {
        throw new ForbiddenException(
          'Bạn không được phép xem danh sách người tham dự của sự kiện này',
        );
    }

    // 2) Filters & pagination
    const { page = 1, limit = 10, search, status } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.TicketWhereInput = {
      eventId,
    };

    if (status) {
      where.status = status;
    }

    if (search) {
      where.OR = [
        { user: { userName: { contains: search, mode: 'insensitive' } } },
        { user: { firstName: { contains: search, mode: 'insensitive' } } },
        { user: { lastName: { contains: search, mode: 'insensitive' } } },
        { user: { email: { contains: search, mode: 'insensitive' } } },
        { user: { studentCode: { contains: search, mode: 'insensitive' } } },
      ];
    }

    // 3) Query data & counts
    const [tickets, total, usedCount, cancelledCount] = await Promise.all([
      this.prisma.ticket.findMany({
        where,
        skip,
        take: limit,
        orderBy: { bookingDate: 'desc' },
        select: {
          id: true,
          qrCode: true,
          status: true,
          bookingDate: true,
          checkinTime: true,
          user: {
            select: {
              id: true,
              userName: true,
              firstName: true,
              lastName: true,
              email: true,
              phoneNumber: true,
              studentCode: true,
            },
          },
          seat: {
            select: {
              rowLabel: true,
              colLabel: true,
              seatType: true,
            },
          },
        },
      }),
      this.prisma.ticket.count({ where }),
      this.prisma.ticket.count({
        where: { ...where, status: TicketStatus.USED },
      }),
      this.prisma.ticket.count({
        where: { ...where, status: TicketStatus.CANCELLED },
      }),
    ]);

    const notCheckin = total - usedCount - cancelledCount;
    const attendanceRate =
      total > 0 ? Math.round((usedCount / total) * 100) : 0;

    // 4) Map response
    const data = tickets.map((t) => ({
      ticketId: t.id,
      qrCode: t.qrCode,
      status: t.status,
      bookingDate: t.bookingDate,
      checkinTime: t.checkinTime,
      fullName:
        `${t.user.firstName ?? ''} ${t.user.lastName ?? ''}`.trim() ||
        t.user.userName,
      email: t.user.email,
      phoneNumber: t.user.phoneNumber,
      studentCode: t.user.studentCode,
      seat: t.seat
        ? {
            label: `${t.seat.rowLabel}${t.seat.colLabel}`,
            row: t.seat.rowLabel,
            col: t.seat.colLabel,
            type: t.seat.seatType,
          }
        : null,
    }));

    return {
      summary: {
        totalRegistered: total,
        checkedIn: usedCount,
        notCheckin,
        cancelled: cancelledCount,
        attendanceRate,
      },
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}
