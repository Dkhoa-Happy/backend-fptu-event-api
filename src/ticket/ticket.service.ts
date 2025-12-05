import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateTicketDto,
  UpdateTicketDto,
  QueryTicketDto,
  QueryMyTicketDto,
} from './dto';
import { CheckinResult } from '@prisma/client';

@Injectable()
export class TicketService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateTicketDto, userId: number) {
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
      const ticket = await this.prisma.ticket.create({
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

      return ticket;
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
      await this.prisma.ticket.delete({
        where: { id },
      });

      return { message: `Ticket with ID ${id} has been deleted successfully` };
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
          'Cannot delete ticket because it is referenced by other records (e.g., checkin logs)',
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
        // Ticket not found - cannot create checkin log without valid ticketId
        throw new NotFoundException(`Ticket with QR code ${qrCode} not found`);
      }

      // Check ticket status
      if (ticket.status === 'USED') {
        // Create FAIL checkin log
        await tx.checkinLog.create({
          data: {
            result: CheckinResult.FAIL,
            message: 'Ticket already used',
            ticketId: ticket.id,
            staffId: staffId,
          },
        });

        return {
          success: false,
          message: 'Ticket already used',
          ticket: null,
        };
      }

      if (ticket.status === 'CANCELLED') {
        // Create FAIL checkin log
        await tx.checkinLog.create({
          data: {
            result: CheckinResult.FAIL,
            message: 'Ticket cancelled',
            ticketId: ticket.id,
            staffId: staffId,
          },
        });

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

        // Create SUCCESS checkin log
        await tx.checkinLog.create({
          data: {
            result: CheckinResult.SUCCESS,
            message: null,
            ticketId: ticket.id,
            staffId: staffId,
          },
        });

        return {
          success: true,
          message: 'Check-in successful',
          ticket: updatedTicket,
          user: updatedTicket.user,
        };
      }

      // This should not happen, but handle unknown status
      await tx.checkinLog.create({
        data: {
          result: CheckinResult.FAIL,
          message: `Unknown ticket status: ${ticket.status}`,
          ticketId: ticket.id,
          staffId: staffId,
        },
      });

      return {
        success: false,
        message: `Unknown ticket status: ${ticket.status}`,
        ticket: null,
      };
    });
  }
}
