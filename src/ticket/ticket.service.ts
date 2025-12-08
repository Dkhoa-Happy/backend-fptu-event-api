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
} from './dto';

@Injectable()
export class TicketService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly checkinGateway: CheckinGateway,
  ) {}

  async create(dto: CreateTicketDto, userId: number) {
    // Check if event exists and get registration time
    const event = await this.prisma.event.findUnique({
      where: { id: dto.eventId },
      select: {
        id: true,
        title: true,
        startTimeRegister: true,
        endTimeRegister: true,
        status: true,
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
    });

    if (!seat) {
      throw new NotFoundException(`Seat with ID ${dto.seatId} not found`);
    }

    if (!seat.isActive) {
      throw new BadRequestException('Seat is not active');
    }

    // Check if seat is already booked for this event
    const existingSeatBooking = await this.prisma.ticket.findFirst({
      where: {
        eventId: dto.eventId,
        seatId: dto.seatId,
      },
    });

    if (existingSeatBooking) {
      throw new BadRequestException('Seat is already booked for this event');
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
              },
            },
            seat: {
              select: {
                id: true,
                rowLabel: true,
                colLabel: true,
                seatType: true,
              },
            },
          },
        });

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
            organizer: {
              select: {
                id: true,
                name: true,
                logoUrl: true,
              },
            },
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
          event: {
            select: {
              id: true,
              title: true,
              description: true,
              startTime: true,
              endTime: true,
              status: true,
              organizer: {
                select: {
                  id: true,
                  name: true,
                  logoUrl: true,
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
            organizer: {
              select: {
                id: true,
                name: true,
                logoUrl: true,
              },
            },
          },
        },
      },
    });

    if (!ticket) {
      throw new NotFoundException(`Ticket with QR code ${qrCode} not found`);
    }

    return ticket;
  }

  async update(id: string, dto: UpdateTicketDto) {
    // Check if ticket exists
    const existingTicket = await this.prisma.ticket.findUnique({
      where: { id },
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
}
