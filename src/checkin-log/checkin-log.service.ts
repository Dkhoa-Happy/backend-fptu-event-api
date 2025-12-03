import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateCheckinLogDto,
  UpdateCheckinLogDto,
  QueryCheckinLogDto,
} from './dto';

@Injectable()
export class CheckinLogService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateCheckinLogDto) {
    // Validate that ticket exists
    const ticket = await this.prisma.ticket.findUnique({
      where: { id: dto.ticketId },
    });

    if (!ticket) {
      throw new NotFoundException(`Ticket with ID ${dto.ticketId} not found`);
    }

    // Validate that staff exists
    const staff = await this.prisma.user.findUnique({
      where: { id: dto.staffId },
    });

    if (!staff) {
      throw new NotFoundException(`Staff with ID ${dto.staffId} not found`);
    }

    // If result is FAIL, message should be provided
    if (dto.result === 'FAIL' && !dto.message) {
      throw new BadRequestException(
        'Message is required when result is FAIL',
      );
    }

    try {
      const checkinLog = await this.prisma.checkinLog.create({
        data: {
          result: dto.result,
          message: dto.message,
          ticketId: dto.ticketId,
          staffId: dto.staffId,
        },
        include: {
          ticket: {
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
          },
          staff: {
            select: {
              id: true,
              userName: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      });

      return checkinLog;
    } catch (error: unknown) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        (error as { code: string }).code === 'P2003'
      ) {
        throw new NotFoundException('Ticket or Staff not found');
      }

      throw error;
    }
  }

  async findAll(query: QueryCheckinLogDto) {
    const { page = 1, limit = 10, result, ticketId, staffId } = query;

    const where: Prisma.CheckinLogWhereInput = {};

    if (result) {
      where.result = result;
    }

    if (ticketId) {
      where.ticketId = ticketId;
    }

    if (staffId) {
      where.staffId = staffId;
    }

    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      this.prisma.checkinLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { checkinTime: 'desc' },
        include: {
          ticket: {
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
          },
          staff: {
            select: {
              id: true,
              userName: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      }),
      this.prisma.checkinLog.count({ where }),
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

  async findOne(id: number) {
    const checkinLog = await this.prisma.checkinLog.findUnique({
      where: { id },
      include: {
        ticket: {
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
                organizer: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
          },
        },
        staff: {
          select: {
            id: true,
            userName: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    if (!checkinLog) {
      throw new NotFoundException(`CheckinLog with ID ${id} not found`);
    }

    return checkinLog;
  }

  async update(id: number, dto: UpdateCheckinLogDto) {
    // Check if checkinLog exists
    const existingCheckinLog = await this.prisma.checkinLog.findUnique({
      where: { id },
    });

    if (!existingCheckinLog) {
      throw new NotFoundException(`CheckinLog with ID ${id} not found`);
    }

    // If result is being changed to FAIL, message should be provided
    if (dto.result === 'FAIL' && !dto.message) {
      throw new BadRequestException(
        'Message is required when result is FAIL',
      );
    }

    try {
      const updateData: Prisma.CheckinLogUncheckedUpdateInput = {};

      if (dto.result !== undefined) updateData.result = dto.result;
      if (dto.message !== undefined) updateData.message = dto.message;

      const checkinLog = await this.prisma.checkinLog.update({
        where: { id },
        data: updateData,
        include: {
          ticket: {
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
          },
          staff: {
            select: {
              id: true,
              userName: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      });

      return checkinLog;
    } catch (error: unknown) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        (error as { code: string }).code === 'P2025'
      ) {
        throw new NotFoundException(`CheckinLog with ID ${id} not found`);
      }

      throw error;
    }
  }

  async remove(id: number) {
    // Check if checkinLog exists
    const checkinLog = await this.prisma.checkinLog.findUnique({
      where: { id },
    });

    if (!checkinLog) {
      throw new NotFoundException(`CheckinLog with ID ${id} not found`);
    }

    try {
      await this.prisma.checkinLog.delete({
        where: { id },
      });

      return {
        message: `CheckinLog with ID ${id} has been deleted successfully`,
      };
    } catch (error: unknown) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        (error as { code: string }).code === 'P2025'
      ) {
        throw new NotFoundException(`CheckinLog with ID ${id} not found`);
      }

      throw error;
    }
  }
}

