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
      throw new NotFoundException('User not found');
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
        'Cannot register for this event. Event is not published yet.',
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
        `Registration has not started yet. Registration starts at ${startTime.toISOString()}`,
      );
    }

    if (now > endTime) {
      throw new BadRequestException(
        `Registration has ended. Registration ended at ${endTime.toISOString()}`,
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
      throw new BadRequestException('User already registered for this event');
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
      throw new NotFoundException(`Seat with ID ${dto.seatId} not found`);
    }

    if (!seat.isActive) {
      throw new BadRequestException('Seat is not active');
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

    // Check if seat is already booked for this event (check via Ticket, not isBooked)
    const existingSeatBooking = await this.prisma.ticket.findFirst({
      where: {
        eventId: dto.eventId,
        seatId: dto.seatId,
        status: {
          notIn: ['CANCELLED', 'EXPIRED'], // Chỉ check các ticket còn hiệu lực
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
        'Failed to generate unique QR code. Please try again.',
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
          throw new NotFoundException(`Event with ID ${dto.eventId} not found`);
        }

        if (currentEvent.registeredCount >= currentEvent.maxCapacity) {
          throw new BadRequestException(
            `Sự kiện đã đạt số lượng tối đa (${currentEvent.maxCapacity} người). Không thể đăng ký thêm.`,
          );
        }

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

        if (
          meta?.target &&
          meta.target.includes('userId') &&
          meta.target.includes('eventId')
        ) {
          throw new BadRequestException('User đã đăng ký sự kiện này rồi');
        }

        if (
          meta?.target &&
          meta.target.includes('eventId') &&
          meta.target.includes('seatId')
        ) {
          throw new BadRequestException('Ghế này đã được chọn');
        }

        throw new BadRequestException('Unique constraint violation');
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
      throw new NotFoundException(`Ticket with ID ${id} not found`);
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
      throw new NotFoundException(`Ticket with QR code ${qrCode} not found`);
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
      throw new NotFoundException(`Ticket with ID ${id} not found`);
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
        throw new NotFoundException(`Ticket with ID ${id} not found`);
      }

      throw error;
    }
  }

  async remove(id: string) {
    // Check if ticket exists
    const ticket = await this.prisma.ticket.findUnique({
      where: { id },
    });

    if (!ticket) {
      throw new NotFoundException(`Ticket with ID ${id} not found`);
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
        throw new NotFoundException(`Ticket with ID ${id} not found`);
      }

      // Handle foreign key constraint errors
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        (error as { code: string }).code === 'P2003'
      ) {
        throw new BadRequestException(
          'Cannot delete ticket because it is referenced by other records',
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
      throw new NotFoundException(`Staff with ID ${staffId} not found`);
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
        throw new NotFoundException(`Ticket with QR code ${qrCode} not found`);
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
          'You are not assigned to this event. Only assigned staff can scan tickets for this event.',
        );
      }

      // Check if ticket is expired (event has ended)
      const now = new Date();
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
          message: 'Ticket already used',
          ticket: null,
        };
      }

      if (ticket.status === 'CANCELLED') {
        return {
          success: false,
          message: 'Ticket cancelled',
          ticket: null,
        };
      }

      if (ticket.status === 'EXPIRED') {
        return {
          success: false,
          message: 'Ticket expired. Event has ended.',
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
          message: 'Check-in successful',
          ticket: updatedTicket,
          user: updatedTicket.user,
        };
      }

      return {
        success: false,
        message: `Unknown ticket status: ${String(ticket.status)}`,
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
        'You are not allowed to view attendees of this event',
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
