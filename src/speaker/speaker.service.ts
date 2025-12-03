import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateSpeakerDto,
  UpdateSpeakerDto,
  QuerySpeakerDto,
  AssignSpeakerDto,
} from './dto';

@Injectable()
export class SpeakerService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateSpeakerDto) {
    try {
      const speaker = await this.prisma.speaker.create({
        data: {
          name: dto.name,
          bio: dto.bio,
          avatar: dto.avatar,
          type: dto.type,
          company: dto.company,
        },
      });

      return speaker;
    } catch (error: unknown) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        (error as { code: string }).code === 'P2002'
      ) {
        throw new BadRequestException('Speaker with this name already exists');
      }
      throw error;
    }
  }

  async findAll(query: QuerySpeakerDto) {
    const { page = 1, limit = 10, search, type } = query;

    const where: Prisma.SpeakerWhereInput = {};

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { company: { contains: search, mode: 'insensitive' } },
        { bio: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (type) {
      where.type = type;
    }

    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      this.prisma.speaker.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.speaker.count({ where }),
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
    const speaker = await this.prisma.speaker.findUnique({
      where: { id },
      include: {
        eventSpeakers: {
          include: {
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
      },
    });

    if (!speaker) {
      throw new NotFoundException(`Speaker with ID ${id} not found`);
    }

    return speaker;
  }

  async update(id: number, dto: UpdateSpeakerDto) {
    const existingSpeaker = await this.prisma.speaker.findUnique({
      where: { id },
    });

    if (!existingSpeaker) {
      throw new NotFoundException(`Speaker with ID ${id} not found`);
    }

    try {
      const updateData: Prisma.SpeakerUncheckedUpdateInput = {};

      if (dto.name !== undefined) updateData.name = dto.name;
      if (dto.bio !== undefined) updateData.bio = dto.bio;
      if (dto.avatar !== undefined) updateData.avatar = dto.avatar;
      if (dto.type !== undefined) updateData.type = dto.type;
      if (dto.company !== undefined) updateData.company = dto.company;

      const speaker = await this.prisma.speaker.update({
        where: { id },
        data: updateData,
      });

      return speaker;
    } catch (error: unknown) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        (error as { code: string }).code === 'P2025'
      ) {
        throw new NotFoundException(`Speaker with ID ${id} not found`);
      }

      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        (error as { code: string }).code === 'P2002'
      ) {
        throw new BadRequestException('Speaker with this name already exists');
      }

      throw error;
    }
  }

  async remove(id: number) {
    const speaker = await this.prisma.speaker.findUnique({
      where: { id },
    });

    if (!speaker) {
      throw new NotFoundException(`Speaker with ID ${id} not found`);
    }

    try {
      await this.prisma.speaker.delete({
        where: { id },
      });

      return { message: `Speaker with ID ${id} has been deleted successfully` };
    } catch (error: unknown) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        (error as { code: string }).code === 'P2025'
      ) {
        throw new NotFoundException(`Speaker with ID ${id} not found`);
      }

      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        (error as { code: string }).code === 'P2003'
      ) {
        throw new BadRequestException(
          'Cannot delete speaker because it is referenced by events',
        );
      }

      throw error;
    }
  }

  // EventSpeaker Management
  async assignSpeakerToEvent(
    eventId: string,
    dto: AssignSpeakerDto,
    organizerUserId?: number,
  ) {
    // Check if event exists
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      include: {
        organizer: {
          select: {
            id: true,
            ownerId: true,
          },
        },
      },
    });

    if (!event) {
      throw new NotFoundException(`Event with ID ${eventId} not found`);
    }

    // Check permission: admin can assign to any event, event_organizer only to their own events
    if (organizerUserId) {
      if (
        !event.organizer.ownerId ||
        event.organizer.ownerId !== organizerUserId
      ) {
        throw new ForbiddenException(
          'You do not have permission to assign speaker to this event',
        );
      }
    }

    // Check if speaker exists
    const speaker = await this.prisma.speaker.findUnique({
      where: { id: dto.speakerId },
    });

    if (!speaker) {
      throw new NotFoundException(`Speaker with ID ${dto.speakerId} not found`);
    }

    // Check if speaker is already assigned to this event
    const existingAssignment = await this.prisma.eventSpeaker.findFirst({
      where: {
        eventId: eventId,
        speakerId: dto.speakerId,
      },
    });

    if (existingAssignment) {
      throw new BadRequestException(
        'This speaker is already assigned to this event',
      );
    }

    try {
      const eventSpeaker = await this.prisma.eventSpeaker.create({
        data: {
          eventId: eventId,
          speakerId: dto.speakerId,
          topic: dto.topic,
        },
        include: {
          speaker: {
            select: {
              id: true,
              name: true,
              bio: true,
              avatar: true,
              type: true,
              company: true,
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

      return eventSpeaker;
    } catch (error: unknown) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        (error as { code: string }).code === 'P2002'
      ) {
        throw new BadRequestException(
          'This speaker is already assigned to this event',
        );
      }

      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        (error as { code: string }).code === 'P2003'
      ) {
        throw new NotFoundException('Event or Speaker not found');
      }

      throw error;
    }
  }

  async removeSpeakerFromEvent(
    eventId: string,
    speakerId: number,
    organizerUserId?: number,
  ) {
    // Check if event exists
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      include: {
        organizer: {
          select: {
            id: true,
            ownerId: true,
          },
        },
      },
    });

    if (!event) {
      throw new NotFoundException(`Event with ID ${eventId} not found`);
    }

    // Check permission: admin can remove from any event, event_organizer only from their own events
    if (organizerUserId) {
      if (
        !event.organizer.ownerId ||
        event.organizer.ownerId !== organizerUserId
      ) {
        throw new ForbiddenException(
          'You do not have permission to remove speaker from this event',
        );
      }
    }

    // Check if EventSpeaker exists
    const eventSpeaker = await this.prisma.eventSpeaker.findFirst({
      where: {
        eventId: eventId,
        speakerId: speakerId,
      },
    });

    if (!eventSpeaker) {
      throw new NotFoundException(
        `Speaker with ID ${speakerId} is not assigned to event ${eventId}`,
      );
    }

    try {
      await this.prisma.eventSpeaker.delete({
        where: { id: eventSpeaker.id },
      });

      return {
        message: `Speaker ${speakerId} has been removed from event ${eventId}`,
      };
    } catch (error: unknown) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        (error as { code: string }).code === 'P2025'
      ) {
        throw new NotFoundException('EventSpeaker not found');
      }

      throw error;
    }
  }

  async findEventSpeakers(eventId: string) {
    // Check if event exists
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
    });

    if (!event) {
      throw new NotFoundException(`Event with ID ${eventId} not found`);
    }

    const eventSpeakers = await this.prisma.eventSpeaker.findMany({
      where: {
        eventId: eventId,
      },
      include: {
        speaker: {
          select: {
            id: true,
            name: true,
            bio: true,
            avatar: true,
            type: true,
            company: true,
            createdAt: true,
          },
        },
      },
      orderBy: {
        id: 'asc',
      },
    });

    return eventSpeakers;
  }
}

