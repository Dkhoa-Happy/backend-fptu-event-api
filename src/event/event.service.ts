import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEventDto, UpdateEventDto, QueryEventDto } from './dto';

@Injectable()
export class EventService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateEventDto) {
    try {
      const event = await this.prisma.event.create({
        data: {
          title: dto.title,
          description: dto.description,
          bannerUrl: dto.bannerUrl,
          startTime: new Date(dto.startTime),
          endTime: new Date(dto.endTime),
          startTimeRegister: new Date(dto.startTimeRegister),
          endTimeRegister: new Date(dto.endTimeRegister),
          status: dto.status || 'DRAFT',
          maxCapacity: dto.maxCapacity,
          allowCheckIn: dto.allowCheckIn ?? false,
          isGlobal: dto.isGlobal ?? false,
          organizerId: dto.organizerId,
          venueId: dto.venueId,
          // Note: hostId is required in schema but not in DTO - you may want to add it
          // For now, using organizerId as a placeholder - adjust as needed
          hostId: dto.organizerId, // You may want to add hostId to DTO
        },
        include: {
          organizer: {
            select: {
              id: true,
              name: true,
              description: true,
              contactEmail: true,
              logoUrl: true,
            },
          },
          venue: {
            select: {
              id: true,
              name: true,
              location: true,
              capacity: true,
              hasSeats: true,
            },
          },
          host: {
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

      return event;
    } catch (error: unknown) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        (error as { code: string }).code === 'P2002'
      ) {
        throw new BadRequestException('Event with this title already exists');
      }
      throw error;
    }
  }

  async findAll(
    query: QueryEventDto,
    currentUser?: { roleName?: string; campusId?: number },
  ) {
    const {
      page = 1,
      limit = 10,
      search,
      status,
      organizerId,
      venueId,
    } = query;

    const where: Prisma.EventWhereInput = {};

    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (status) {
      where.status = status;
    }

    if (organizerId) {
      where.organizerId = organizerId;
    }

    if (venueId) {
      where.venueId = venueId;
    }

    // Nếu là student: chỉ được thấy event global hoặc event thuộc campus của mình
    if (currentUser?.roleName === 'student' && currentUser.campusId) {
      const visibilityCondition: Prisma.EventWhereInput = {
        OR: [{ isGlobal: true }, { venue: { campusId: currentUser.campusId } }],
      };

      if (where.AND) {
        where.AND = Array.isArray(where.AND)
          ? [...where.AND, visibilityCondition]
          : [where.AND, visibilityCondition];
      } else {
        where.AND = [visibilityCondition];
      }
    }

    // Nếu là staff: cũng chỉ thấy event global hoặc event thuộc campus của mình
    if (currentUser?.roleName === 'staff' && currentUser.campusId) {
      const visibilityCondition: Prisma.EventWhereInput = {
        OR: [{ isGlobal: true }, { venue: { campusId: currentUser.campusId } }],
      };

      if (where.AND) {
        where.AND = Array.isArray(where.AND)
          ? [...where.AND, visibilityCondition]
          : [where.AND, visibilityCondition];
      } else {
        where.AND = [visibilityCondition];
      }
    }

    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      this.prisma.event.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          organizer: {
            select: {
              id: true,
              name: true,
              description: true,
              contactEmail: true,
              logoUrl: true,
            },
          },
          venue: {
            select: {
              id: true,
              name: true,
              location: true,
              capacity: true,
              hasSeats: true,
            },
          },
          host: {
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
      this.prisma.event.count({ where }),
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

  async findOne(
    id: string,
    currentUser?: { roleName?: string; campusId?: number },
  ) {
    const event = await this.prisma.event.findUnique({
      where: { id },
      include: {
        organizer: {
          select: {
            id: true,
            name: true,
            description: true,
            contactEmail: true,
            logoUrl: true,
          },
        },
        venue: {
          select: {
            id: true,
            name: true,
            location: true,
            capacity: true,
            hasSeats: true,
            campusId: true,
          },
        },
        host: {
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

    if (!event) {
      throw new NotFoundException(`Event with ID ${id} not found`);
    }

    // Nếu là student: kiểm tra quyền xem event
    if (currentUser?.roleName === 'student' && currentUser.campusId) {
      const isSameCampus =
        event.venue && event.venue.campusId === currentUser.campusId;
      if (!event.isGlobal && !isSameCampus) {
        throw new ForbiddenException(
          'You do not have permission to access this event',
        );
      }
    }

    // Nếu là staff: kiểm tra quyền xem event theo campus
    if (currentUser?.roleName === 'staff' && currentUser.campusId) {
      const isSameCampus =
        event.venue && event.venue.campusId === currentUser.campusId;
      if (!event.isGlobal && !isSameCampus) {
        throw new ForbiddenException(
          'You do not have permission to access this event',
        );
      }
    }

    return event;
  }

  async update(id: string, dto: UpdateEventDto) {
    // Check if event exists
    const existingEvent = await this.prisma.event.findUnique({
      where: { id },
    });

    if (!existingEvent) {
      throw new NotFoundException(`Event with ID ${id} not found`);
    }

    try {
      const updateData: Prisma.EventUncheckedUpdateInput = {};

      if (dto.title !== undefined) updateData.title = dto.title;
      if (dto.description !== undefined)
        updateData.description = dto.description;
      if (dto.bannerUrl !== undefined) updateData.bannerUrl = dto.bannerUrl;
      if (dto.startTime !== undefined)
        updateData.startTime = new Date(dto.startTime);
      if (dto.endTime !== undefined) updateData.endTime = new Date(dto.endTime);
      if (dto.startTimeRegister !== undefined)
        updateData.startTimeRegister = new Date(dto.startTimeRegister);
      if (dto.endTimeRegister !== undefined)
        updateData.endTimeRegister = new Date(dto.endTimeRegister);
      if (dto.status !== undefined) updateData.status = dto.status;
      if (dto.maxCapacity !== undefined)
        updateData.maxCapacity = dto.maxCapacity;
      if (dto.allowCheckIn !== undefined)
        updateData.allowCheckIn = dto.allowCheckIn;
      if (dto.organizerId !== undefined)
        updateData.organizerId = dto.organizerId;
      if (dto.venueId !== undefined) updateData.venueId = dto.venueId;

      const event = await this.prisma.event.update({
        where: { id },
        data: updateData,
        include: {
          organizer: {
            select: {
              id: true,
              name: true,
              description: true,
              contactEmail: true,
              logoUrl: true,
            },
          },
          venue: {
            select: {
              id: true,
              name: true,
              location: true,
              capacity: true,
              hasSeats: true,
            },
          },
          host: {
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

      return event;
    } catch (error: unknown) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        (error as { code: string }).code === 'P2025'
      ) {
        throw new NotFoundException(`Event with ID ${id} not found`);
      }

      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        (error as { code: string }).code === 'P2002'
      ) {
        throw new BadRequestException('Event with this title already exists');
      }

      throw error;
    }
  }

  async remove(id: string) {
    // Check if event exists
    const event = await this.prisma.event.findUnique({
      where: { id },
    });

    if (!event) {
      throw new NotFoundException(`Event with ID ${id} not found`);
    }

    try {
      await this.prisma.event.delete({
        where: { id },
      });

      return { message: `Event with ID ${id} has been deleted successfully` };
    } catch (error: unknown) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        (error as { code: string }).code === 'P2025'
      ) {
        throw new NotFoundException(`Event with ID ${id} not found`);
      }

      // Handle foreign key constraint errors
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        (error as { code: string }).code === 'P2003'
      ) {
        throw new BadRequestException(
          'Cannot delete event because it is referenced by other records (e.g., tickets, feedbacks)',
        );
      }

      throw error;
    }
  }
}
