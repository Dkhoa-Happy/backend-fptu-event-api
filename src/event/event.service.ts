import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { EventStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EventSummaryService } from './event-summary.service';
import {
  CreateEventDto,
  UpdateEventDto,
  UpdateEventStatusDto,
  QueryEventDto,
  AssignStaffDto,
  QueryEventStatsDto,
} from './dto';

@Injectable()
export class EventService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventSummaryService: EventSummaryService,
  ) {}

  async create(
    dto: CreateEventDto,
    currentUser?: { id?: number; roleName?: string },
  ) {
    // Validate organizer exists and check permissions
    const organizer = await this.prisma.organizer.findUnique({
      where: { id: dto.organizerId },
      select: { id: true, ownerId: true },
    });

    if (!organizer) {
      throw new NotFoundException(
        `Organizer with ID ${dto.organizerId} not found`,
      );
    }

    // Nếu là event_organizer, kiểm tra xem họ có phải owner của organizer không
    if (currentUser?.roleName === 'event_organizer' && currentUser.id) {
      // Kiểm tra user có phải là owner của ít nhất 1 organizer không
      const userOrganizers = await this.prisma.organizer.findMany({
        where: {
          ownerId: currentUser.id,
        },
        select: { id: true },
      });

      if (userOrganizers.length === 0) {
        throw new ForbiddenException(
          'You cannot create events. You are not the owner of any organizer. Only organizer owners can create events.',
        );
      }

      if (!organizer.ownerId || organizer.ownerId !== currentUser.id) {
        throw new ForbiddenException(
          'You do not have permission to create events for this organizer. You are not the owner of this organizer.',
        );
      }
    }

    // Validate venue exists if provided
    if (dto.venueId) {
      const venue = await this.prisma.venue.findUnique({
        where: { id: dto.venueId },
        select: { id: true, status: true },
      });

      if (!venue) {
        throw new NotFoundException(`Venue with ID ${dto.venueId} not found`);
      }

      // Check venue status (case-insensitive)
      if (venue.status.toUpperCase() !== 'ACTIVE') {
        throw new BadRequestException(
          `Venue with ID ${dto.venueId} is not active`,
        );
      }

      // Check for venue time conflict with existing events
      // Only check PUBLISHED and PENDING events (ignore CANCELED)
      const conflictingEvent = await this.prisma.event.findFirst({
        where: {
          venueId: dto.venueId,
          status: {
            in: [EventStatus.PUBLISHED, EventStatus.PENDING],
          },
          // Check if time ranges overlap
          OR: [
            // New event starts during existing event
            {
              AND: [
                { startTime: { lte: new Date(dto.startTime) } },
                { endTime: { gt: new Date(dto.startTime) } },
              ],
            },
            // New event ends during existing event
            {
              AND: [
                { startTime: { lt: new Date(dto.endTime) } },
                { endTime: { gte: new Date(dto.endTime) } },
              ],
            },
            // New event completely contains existing event
            {
              AND: [
                { startTime: { gte: new Date(dto.startTime) } },
                { endTime: { lte: new Date(dto.endTime) } },
              ],
            },
            // Existing event completely contains new event
            {
              AND: [
                { startTime: { lte: new Date(dto.startTime) } },
                { endTime: { gte: new Date(dto.endTime) } },
              ],
            },
          ],
        },
        select: {
          id: true,
          title: true,
          startTime: true,
          endTime: true,
          status: true,
        },
      });

      if (conflictingEvent) {
        throw new BadRequestException(
          `Venue đã được đặt cho sự kiện "${conflictingEvent.title}" từ ${new Date(conflictingEvent.startTime).toLocaleString('vi-VN')} đến ${new Date(conflictingEvent.endTime).toLocaleString('vi-VN')}. Vui lòng chọn thời gian khác hoặc venue khác.`,
        );
      }
    }

    // Validate time relationships
    const startTime = new Date(dto.startTime);
    const endTime = new Date(dto.endTime);
    const startTimeRegister = new Date(dto.startTimeRegister);
    const endTimeRegister = new Date(dto.endTimeRegister);
    const now = new Date();

    // Check if startTime is before endTime
    if (startTime >= endTime) {
      throw new BadRequestException(
        'Event start time must be before event end time',
      );
    }

    // Check if startTimeRegister is before endTimeRegister
    if (startTimeRegister >= endTimeRegister) {
      throw new BadRequestException(
        'Registration start time must be before registration end time',
      );
    }

    // Check if registration ends before event starts
    if (endTimeRegister >= startTime) {
      throw new BadRequestException(
        'Registration must end before the event starts',
      );
    }

    // Check if registration start is before event start
    if (startTimeRegister >= startTime) {
      throw new BadRequestException(
        'Registration start time must be before event start time',
      );
    }

    // Optional: Check if event is in the past (you may want to allow this for testing)
    // if (startTime < now) {
    //   throw new BadRequestException('Event start time cannot be in the past');
    // }

    // Validate title is not just whitespace
    if (!dto.title.trim()) {
      throw new BadRequestException(
        'Event title cannot be empty or whitespace',
      );
    }

    try {
      const event = await this.prisma.event.create({
        data: {
          title: dto.title,
          description: dto.description,
          category: dto.category,
          bannerUrl: dto.bannerUrl,
          startTime: new Date(dto.startTime),
          endTime: new Date(dto.endTime),
          startTimeRegister: new Date(dto.startTimeRegister),
          endTimeRegister: new Date(dto.endTimeRegister),
          status: 'PENDING',
          maxCapacity: dto.maxCapacity,
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
      category,
    } = query;

    const where: Prisma.EventWhereInput = {};

    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Nếu là student: chỉ được thấy event PUBLISHED (override status từ query nếu có)
    if (currentUser?.roleName === 'student') {
      // Student chỉ thấy event PUBLISHED, không thể filter status khác
      where.status = EventStatus.PUBLISHED;
    } else if (status) {
      // Các role khác có thể filter theo status
      where.status = status;
    }

    if (organizerId) {
      where.organizerId = organizerId;
    }

    if (venueId) {
      where.venueId = venueId;
    }

    if (category) {
      where.category = { contains: category, mode: 'insensitive' };
    }

    // Nếu là student: filter theo campus visibility
    if (currentUser?.roleName === 'student') {
      // Nếu có campusId, filter theo campus
      if (currentUser.campusId) {
        const visibilityCondition: Prisma.EventWhereInput = {
          OR: [
            { isGlobal: true },
            { venue: { campusId: currentUser.campusId } },
          ],
        };

        if (where.AND) {
          where.AND = Array.isArray(where.AND)
            ? [...where.AND, visibilityCondition]
            : [where.AND, visibilityCondition];
        } else {
          where.AND = [visibilityCondition];
        }
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

    // Student không được xem thông tin nội bộ như eventStaffs
    const isStudent = currentUser?.roleName === 'student';

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
          eventSpeakers: {
            select: {
              id: true,
              topic: true,
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
            },
          },
          // Chỉ include eventStaffs nếu không phải student
          ...(isStudent
            ? {}
            : {
                eventStaffs: {
                  include: {
                    user: {
                      select: {
                        id: true,
                        userName: true,
                        email: true,
                        firstName: true,
                        lastName: true,
                        avatar: true,
                        roleName: true,
                      },
                    },
                  },
                },
              }),
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
    // Student không được xem thông tin nội bộ như eventStaffs
    const isStudent = currentUser?.roleName === 'student';

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
        eventSpeakers: {
          select: {
            id: true,
            topic: true,
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
          },
        },
        // Chỉ include eventStaffs nếu không phải student
        ...(isStudent
          ? {}
          : {
              eventStaffs: {
                include: {
                  user: {
                    select: {
                      id: true,
                      userName: true,
                      email: true,
                      firstName: true,
                      lastName: true,
                      avatar: true,
                      roleName: true,
                    },
                  },
                },
              },
            }),
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

  async update(
    id: string,
    dto: UpdateEventDto,
    currentUser?: { id?: number; roleName?: string },
  ) {
    // Check if event exists
    const existingEvent = await this.prisma.event.findUnique({
      where: { id },
      include: {
        organizer: {
          select: {
            ownerId: true,
          },
        },
      },
    });

    if (!existingEvent) {
      throw new NotFoundException(`Event with ID ${id} not found`);
    }

    // Nếu là event_organizer, kiểm tra quyền và không cho phép update status
    if (currentUser?.roleName === 'event_organizer' && currentUser.id) {
      // Kiểm tra user có phải owner của organizer không
      if (
        !existingEvent.organizer.ownerId ||
        existingEvent.organizer.ownerId !== currentUser.id
      ) {
        throw new ForbiddenException(
          'You do not have permission to update this event. You are not the owner of this organizer.',
        );
      }
    }

    // Validate venue time conflict if venue or time is being updated
    const finalVenueId = dto.venueId ?? existingEvent.venueId;
    const finalStartTime = dto.startTime
      ? new Date(dto.startTime)
      : existingEvent.startTime;
    const finalEndTime = dto.endTime
      ? new Date(dto.endTime)
      : existingEvent.endTime;

    if (finalVenueId) {
      // Check for venue time conflict with other events (exclude current event)
      const conflictingEvent = await this.prisma.event.findFirst({
        where: {
          venueId: finalVenueId,
          id: { not: id }, // Exclude current event
          status: {
            in: [EventStatus.PUBLISHED, EventStatus.PENDING],
          },
          // Check if time ranges overlap
          OR: [
            // New event starts during existing event
            {
              AND: [
                { startTime: { lte: finalStartTime } },
                { endTime: { gt: finalStartTime } },
              ],
            },
            // New event ends during existing event
            {
              AND: [
                { startTime: { lt: finalEndTime } },
                { endTime: { gte: finalEndTime } },
              ],
            },
            // New event completely contains existing event
            {
              AND: [
                { startTime: { gte: finalStartTime } },
                { endTime: { lte: finalEndTime } },
              ],
            },
            // Existing event completely contains new event
            {
              AND: [
                { startTime: { lte: finalStartTime } },
                { endTime: { gte: finalEndTime } },
              ],
            },
          ],
        },
        select: {
          id: true,
          title: true,
          startTime: true,
          endTime: true,
          status: true,
        },
      });

      if (conflictingEvent) {
        throw new BadRequestException(
          `Venue đã được đặt cho sự kiện "${conflictingEvent.title}" từ ${new Date(conflictingEvent.startTime).toLocaleString('vi-VN')} đến ${new Date(conflictingEvent.endTime).toLocaleString('vi-VN')}. Vui lòng chọn thời gian khác hoặc venue khác.`,
        );
      }
    }

    try {
      const updateData: Prisma.EventUncheckedUpdateInput = {};

      if (dto.title !== undefined) updateData.title = dto.title;
      if (dto.description !== undefined)
        updateData.description = dto.description;
      if (dto.category !== undefined) updateData.category = dto.category;
      if (dto.bannerUrl !== undefined) updateData.bannerUrl = dto.bannerUrl;
      if (dto.startTime !== undefined)
        updateData.startTime = new Date(dto.startTime);
      if (dto.endTime !== undefined) updateData.endTime = new Date(dto.endTime);
      if (dto.startTimeRegister !== undefined)
        updateData.startTimeRegister = new Date(dto.startTimeRegister);
      if (dto.endTimeRegister !== undefined)
        updateData.endTimeRegister = new Date(dto.endTimeRegister);
      if (dto.maxCapacity !== undefined)
        updateData.maxCapacity = dto.maxCapacity;
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

  async updateEventStatus(id: string, dto: UpdateEventStatusDto) {
    try {
      const event = await this.prisma.event.findUnique({
        where: { id },
      });

      if (!event) {
        throw new NotFoundException(`Event with ID ${id} not found`);
      }

      // Chỉ cho phép thay đổi status từ PENDING sang PUBLISHED hoặc CANCELED
      if (event.status !== EventStatus.PENDING) {
        throw new BadRequestException(
          `Event status is ${event.status}. Only PENDING events can be approved or canceled.`,
        );
      }

      const updatedEvent = await this.prisma.event.update({
        where: { id },
        data: {
          status: dto.status,
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
          eventSpeakers: {
            select: {
              id: true,
              topic: true,
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
            },
          },
        },
      });

      return {
        ...updatedEvent,
        message:
          dto.status === EventStatus.PUBLISHED
            ? 'Event approved and published successfully'
            : 'Event canceled successfully',
      };
    } catch (error: unknown) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        (error as { code: string }).code === 'P2025'
      ) {
        throw new NotFoundException(`Event with ID ${id} not found`);
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

  async findAssignedEvents(staffId: number, query: QueryEventDto) {
    const {
      page = 1,
      limit = 10,
      search,
      status,
      organizerId,
      venueId,
      category,
    } = query;

    const where: Prisma.EventWhereInput = {
      eventStaffs: {
        some: {
          userId: staffId,
        },
      },
    };

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

    if (category) {
      where.category = { contains: category, mode: 'insensitive' };
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
          eventSpeakers: {
            select: {
              id: true,
              topic: true,
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
            },
          },
          eventStaffs: {
            include: {
              user: {
                select: {
                  id: true,
                  userName: true,
                  email: true,
                  firstName: true,
                  lastName: true,
                  avatar: true,
                  roleName: true,
                },
              },
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

  async assignStaff(
    eventId: string,
    dto: AssignStaffDto,
    currentUser?: { userId?: number; roleName?: string },
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
    if (currentUser?.roleName === 'event_organizer' && currentUser.userId) {
      // Kiểm tra xem user có phải là owner của organizer không
      if (!event.organizer.ownerId) {
        throw new ForbiddenException(
          'This organizer does not have an owner. You cannot assign staff to events of this organizer.',
        );
      }

      if (event.organizer.ownerId !== currentUser.userId) {
        throw new ForbiddenException(
          'You do not have permission to assign staff to this event. You are not the owner of this organizer.',
        );
      }
    }
    // Admin can assign to any event, so no check needed

    // Check if user exists
    const user = await this.prisma.user.findUnique({
      where: { id: dto.userId },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${dto.userId} not found`);
    }

    // Validate role: only staff can be assigned, not student or other roles
    if (user.roleName === 'student') {
      throw new BadRequestException(
        'Cannot assign student to event. Only staff members can be assigned.',
      );
    }

    if (user.roleName !== 'staff') {
      throw new BadRequestException(
        `User with ID ${dto.userId} is not a staff member. Only staff can be assigned to events.`,
      );
    }

    try {
      const eventStaff = await this.prisma.eventStaff.create({
        data: {
          eventId: eventId,
          userId: dto.userId,
        },
        include: {
          user: {
            select: {
              id: true,
              userName: true,
              email: true,
              firstName: true,
              lastName: true,
              roleName: true,
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

      return eventStaff;
    } catch (error: unknown) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        (error as { code: string }).code === 'P2002'
      ) {
        throw new BadRequestException(
          'This staff member is already assigned to this event',
        );
      }

      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        (error as { code: string }).code === 'P2003'
      ) {
        throw new NotFoundException('Event or User not found');
      }

      throw error;
    }
  }

  async findMyEvents(organizerUserId: number, query: QueryEventDto) {
    // Find organizers owned by this user
    const organizers = await this.prisma.organizer.findMany({
      where: {
        ownerId: organizerUserId,
      },
      select: {
        id: true,
      },
    });

    const organizerIds = organizers.map((org) => org.id);

    if (organizerIds.length === 0) {
      return {
        data: [],
        meta: {
          total: 0,
          page: query.page || 1,
          limit: query.limit || 10,
          totalPages: 0,
        },
      };
    }

    const { page = 1, limit = 10, search, status, venueId, category } = query;

    const where: Prisma.EventWhereInput = {
      organizerId: {
        in: organizerIds,
      },
    };

    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (status) {
      where.status = status;
    }

    if (venueId) {
      where.venueId = venueId;
    }

    if (category) {
      where.category = { contains: category, mode: 'insensitive' };
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
          eventSpeakers: {
            select: {
              id: true,
              topic: true,
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
            },
          },
          eventStaffs: {
            include: {
              user: {
                select: {
                  id: true,
                  userName: true,
                  email: true,
                  firstName: true,
                  lastName: true,
                  avatar: true,
                  roleName: true,
                },
              },
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

  async getSummary(eventId: string, user: { id?: number; roleName?: string }) {
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      select: {
        id: true,
        endTime: true,
        organizer: { select: { ownerId: true } },
      },
    });

    if (!event) {
      throw new NotFoundException('Event not found');
    }

    const isAdmin = user.roleName === 'admin';
    const isOrganizerOwner =
      user.roleName === 'event_organizer' &&
      !!event.organizer?.ownerId &&
      event.organizer.ownerId === user.id;
    const isAssignedStaff =
      user.roleName === 'staff' &&
      !!(await this.prisma.eventStaff.findUnique({
        where: {
          eventId_userId: {
            eventId,
            userId: user.id ?? 0,
          },
        },
      }));

    if (!isAdmin && !isOrganizerOwner && !isAssignedStaff) {
      throw new ForbiddenException('You are not allowed to view this summary');
    }

    // Ensure event ended
    const now = new Date();
    if (now < new Date(event.endTime)) {
      throw new BadRequestException('Event has not ended yet');
    }

    return this.eventSummaryService.getSummary(eventId);
  }

  async getEventStatsByMonth(query: QueryEventStatsDto) {
    const year = query.year ?? new Date().getFullYear();

    // Tạo mảng 12 tháng với giá trị mặc định là 0
    const monthlyStats = Array.from({ length: 12 }, (_, index) => ({
      month: index + 1,
      monthLabel: `T${index + 1}`,
      count: 0,
    }));

    // Lấy tất cả events trong năm, group by tháng
    // Sử dụng Prisma raw query để group by tháng từ createdAt
    const events = await this.prisma.$queryRaw<
      Array<{ month: number; count: bigint }>
    >`
      SELECT 
        EXTRACT(MONTH FROM created_at)::int as month,
        COUNT(*)::bigint as count
      FROM events
      WHERE EXTRACT(YEAR FROM created_at) = ${year}
      GROUP BY EXTRACT(MONTH FROM created_at)
      ORDER BY month ASC
    `;

    // Cập nhật số lượng sự kiện cho từng tháng
    events.forEach((item) => {
      const monthIndex = item.month - 1;
      if (monthIndex >= 0 && monthIndex < 12) {
        monthlyStats[monthIndex].count = Number(item.count);
      }
    });

    return {
      year,
      data: monthlyStats,
      total: monthlyStats.reduce((sum, item) => sum + item.count, 0),
    };
  }
}
