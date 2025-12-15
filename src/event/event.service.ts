import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { EventStatus, TicketStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EventSummaryService } from './event-summary.service';
import { NotificationService } from '../notification/notification.service';
import { EmailService } from '../email/email.service';
import {
  CreateEventDto,
  UpdateEventDto,
  UpdateEventStatusDto,
  QueryEventDto,
  AssignStaffDto,
  QueryEventStatsDto,
  RequestCancellationDto,
  ApproveCancellationDto,
  QueryCancellationRequestsDto,
} from './dto';

@Injectable()
export class EventService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventSummaryService: EventSummaryService,
    private readonly notificationService: NotificationService,
    private readonly emailService: EmailService,
  ) {}

  async create(
    dto: CreateEventDto,
    currentUser?: { id?: number; roleName?: string },
  ) {
    // Validate organizer exists and check permissions
    const organizer = await this.prisma.organizer.findUnique({
      where: { id: dto.organizerId },
      select: { id: true, ownerId: true, campusId: true },
    });

    if (!organizer) {
      throw new NotFoundException(
        `Không tìm thấy organizer với ID ${dto.organizerId}`,
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
          'Bạn không thể tạo sự kiện. Bạn không phải là chủ sở hữu của bất kỳ organizer nào. Chỉ chủ sở hữu organizer mới có thể tạo sự kiện.',
        );
      }

      if (!organizer.ownerId || organizer.ownerId !== currentUser.id) {
        throw new ForbiddenException(
          'Bạn không có quyền tạo sự kiện cho organizer này. Bạn không phải là chủ sở hữu của organizer này.',
        );
      }
    }

    // Validate host (optional, default = người tạo)
    const hostId = dto.hostId ?? currentUser?.id;
    if (!hostId) {
      throw new BadRequestException('Host là bắt buộc');
    }

    const hostUser = await this.prisma.user.findUnique({
      where: { id: hostId },
      select: { id: true, roleName: true, isActive: true },
    });

    if (!hostUser) {
      throw new NotFoundException(`Không tìm thấy user host với ID ${hostId}`);
    }

    if (!hostUser.isActive) {
      throw new BadRequestException('User host không đang hoạt động');
    }

    if (hostUser.roleName === 'student') {
      throw new BadRequestException('Host không được là tài khoản sinh viên');
    }

    // Validate venue exists if provided
    if (dto.venueId) {
      const venue = await this.prisma.venue.findUnique({
        where: { id: dto.venueId },
        select: { id: true, status: true, campusId: true },
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

      // Check if organizer and venue are in the same campus
      // Nếu organizer có campusId, thì venue phải cùng campus
      if (
        organizer.campusId !== null &&
        organizer.campusId !== venue.campusId
      ) {
        throw new BadRequestException(
          `Organizer và venue phải cùng campus. Organizer thuộc campus ID ${organizer.campusId}, nhưng venue thuộc campus ID ${venue.campusId}.`,
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
        'Thời gian bắt đầu sự kiện phải trước thời gian kết thúc sự kiện',
      );
    }

    // Check if startTimeRegister is before endTimeRegister
    if (startTimeRegister >= endTimeRegister) {
      throw new BadRequestException(
        'Thời gian bắt đầu đăng ký phải trước thời gian kết thúc đăng ký',
      );
    }

    // Check if registration ends before event starts
    if (endTimeRegister >= startTime) {
      throw new BadRequestException(
        'Thời gian kết thúc đăng ký phải trước khi sự kiện bắt đầu',
      );
    }

    // Check if registration start is before event start
    if (startTimeRegister >= startTime) {
      throw new BadRequestException(
        'Thời gian bắt đầu đăng ký phải trước thời gian bắt đầu sự kiện',
      );
    }

    // Optional: Check if event is in the past (you may want to allow this for testing)
    // if (startTime < now) {
    //   throw new BadRequestException('Event start time cannot be in the past');
    // }

    // Validate title is not just whitespace
    if (!dto.title.trim()) {
      throw new BadRequestException(
        'Tiêu đề sự kiện không được để trống hoặc chỉ có khoảng trắng',
      );
    }

    // Deduplicate staffIds and speakers
    const staffIds =
      dto.staffIds && dto.staffIds.length > 0
        ? Array.from(new Set(dto.staffIds))
        : [];
    const speakers =
      dto.speakers && dto.speakers.length > 0
        ? dto.speakers.map((s) => ({
            speakerId: Number(s.speakerId),
            topic: s.topic,
          }))
        : [];

    // Validate staff if provided
    if (staffIds.length > 0) {
      const staffUsers = await this.prisma.user.findMany({
        where: { id: { in: staffIds } },
        select: { id: true, roleName: true, isActive: true },
      });

      if (staffUsers.length !== staffIds.length) {
        const foundIds = new Set(staffUsers.map((u) => u.id));
        const missing = staffIds.filter((id) => !foundIds.has(id));
        throw new NotFoundException(
          `Không tìm thấy staff với id: ${missing.join(', ')}`,
        );
      }

      const invalidStaff = staffUsers.find(
        (u) => u.roleName !== 'staff' || !u.isActive,
      );
      if (invalidStaff) {
        throw new BadRequestException(
          'Tất cả staff gán cho sự kiện phải là tài khoản staff đang hoạt động',
        );
      }

      // Check for staff time conflicts with existing events
      const startTime = new Date(dto.startTime);
      const endTime = new Date(dto.endTime);
      for (const staffId of staffIds) {
        const conflictingAssignments = await this.prisma.eventStaff.findMany({
          where: {
            userId: staffId,
            event: {
              status: {
                in: [EventStatus.PUBLISHED, EventStatus.PENDING],
              },
              // Check if time ranges overlap
              OR: [
                // New event starts during existing event
                {
                  AND: [
                    { startTime: { lte: startTime } },
                    { endTime: { gt: startTime } },
                  ],
                },
                // New event ends during existing event
                {
                  AND: [
                    { startTime: { lt: endTime } },
                    { endTime: { gte: endTime } },
                  ],
                },
                // New event completely contains existing event
                {
                  AND: [
                    { startTime: { gte: startTime } },
                    { endTime: { lte: endTime } },
                  ],
                },
                // Existing event completely contains new event
                {
                  AND: [
                    { startTime: { lte: startTime } },
                    { endTime: { gte: endTime } },
                  ],
                },
              ],
            },
          },
          include: {
            event: {
              select: {
                id: true,
                title: true,
                startTime: true,
                endTime: true,
                status: true,
              },
            },
            user: {
              select: {
                id: true,
                userName: true,
              },
            },
          },
        });

        if (conflictingAssignments.length > 0) {
          const conflictingEvent = conflictingAssignments[0].event;
          const staffUser = conflictingAssignments[0].user;
          throw new BadRequestException(
            `Staff ${staffUser.userName} (ID: ${staffId}) đã được phân công cho sự kiện "${conflictingEvent.title}" từ ${new Date(conflictingEvent.startTime).toLocaleString('vi-VN')} đến ${new Date(conflictingEvent.endTime).toLocaleString('vi-VN')}. Không thể phân công cùng lúc cho nhiều sự kiện trong cùng khoảng thời gian.`,
          );
        }
      }
    }

    // Validate speakers if provided
    if (speakers.length > 0) {
      const speakerIds = Array.from(new Set(speakers.map((s) => s.speakerId)));
      const speakerRecords = await this.prisma.speaker.findMany({
        where: { id: { in: speakerIds } },
        select: { id: true },
      });
      if (speakerRecords.length !== speakerIds.length) {
        const found = new Set(speakerRecords.map((s) => s.id));
        const missing = speakerIds.filter((id) => !found.has(id));
        throw new NotFoundException(
          `Không tìm thấy speaker với id: ${missing.join(', ')}`,
        );
      }

      // Check for speaker time conflicts with existing events
      const startTime = new Date(dto.startTime);
      const endTime = new Date(dto.endTime);
      for (const speakerId of speakerIds) {
        const conflictingAssignment = await this.prisma.eventSpeaker.findFirst({
          where: {
            speakerId: speakerId,
            event: {
              status: {
                in: [EventStatus.PUBLISHED, EventStatus.PENDING],
              },
              OR: [
                {
                  AND: [
                    { startTime: { lte: startTime } },
                    { endTime: { gt: startTime } },
                  ],
                },
                {
                  AND: [
                    { startTime: { lt: endTime } },
                    { endTime: { gte: endTime } },
                  ],
                },
                {
                  AND: [
                    { startTime: { gte: startTime } },
                    { endTime: { lte: endTime } },
                  ],
                },
                {
                  AND: [
                    { startTime: { lte: startTime } },
                    { endTime: { gte: endTime } },
                  ],
                },
              ],
            },
          },
          include: {
            event: {
              select: {
                id: true,
                title: true,
                startTime: true,
                endTime: true,
              },
            },
            speaker: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        });

        if (conflictingAssignment) {
          throw new BadRequestException(
            `Speaker ${conflictingAssignment.speaker.name} (ID: ${speakerId}) đã được phân công cho sự kiện "${conflictingAssignment.event.title}" từ ${new Date(conflictingAssignment.event.startTime).toLocaleString('vi-VN')} đến ${new Date(conflictingAssignment.event.endTime).toLocaleString('vi-VN')}. Không thể phân công trùng lịch.`,
          );
        }
      }
    }

    try {
      const event = await this.prisma.$transaction(async (tx) => {
        const createdEvent = await tx.event.create({
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
            hostId,
          },
        });

        if (staffIds.length > 0) {
          await tx.eventStaff.createMany({
            data: staffIds.map((userId) => ({
              eventId: createdEvent.id,
              userId,
            })),
            skipDuplicates: true,
          });
        }

        if (speakers.length > 0) {
          await tx.eventSpeaker.createMany({
            data: speakers.map((s) => ({
              eventId: createdEvent.id,
              speakerId: s.speakerId,
              topic: s.topic,
            })),
            skipDuplicates: true,
          });
        }

        const fullEvent = await tx.event.findUnique({
          where: { id: createdEvent.id },
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
        });

        return fullEvent;
      });

      // Gửi thông báo cho organizer khi tạo event thành công
      // Lấy ownerId từ organizer để gửi notification
      if (organizer.ownerId && event) {
        this.notificationService
          .notifyEventStatusChange(
            organizer.ownerId,
            {
              id: event.id,
              title: event.title,
              status: 'PENDING',
            },
            'PENDING',
          )
          .catch((error) => {
            console.error(
              `Failed to send notification to organizer ${organizer.ownerId}:`,
              error,
            );
          });
      }

      // Gửi thông báo cho admin khi có sự kiện mới ở trạng thái PENDING cần phê duyệt
      if (event && event.organizer) {
        this.notificationService
          .notifyAdminNewEventPending(
            {
              id: event.id,
              title: event.title,
              status: 'PENDING',
            },
            event.organizer.name,
          )
          .catch((error) => {
            console.error(
              `Failed to send notification to admin for new event ${event.id}:`,
              error,
            );
          });
      }

      return {
        ...event,
        checkinCount: 0, // mới tạo nên chưa có check-in
      };
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
              campusId: true,
              campus: {
                select: {
                  id: true,
                  name: true,
                  code: true,
                  address: true,
                },
              },
            },
          },
          host: {
            select: {
              id: true,
              userName: true,
              email: true,
              firstName: true,
              lastName: true,
              avatar: true,
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

    const checkinMap = await this.getCheckinCountByEventIds(
      items.map((e) => e.id),
    );

    // Tự động cập nhật status của các event đã kết thúc sang COMPLETED
    await this.checkAndUpdateMultipleEventStatuses(items.map((e) => e.id));

    return {
      data: items.map((e) => ({
        ...e,
        checkinCount: checkinMap[e.id] ?? 0,
      })),
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
            campus: {
              select: {
                id: true,
                name: true,
                code: true,
                address: true,
              },
            },
          },
        },
        host: {
          select: {
            id: true,
            userName: true,
            email: true,
            firstName: true,
            lastName: true,
            avatar: true,
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
                      isActive: true,
                      campus: {
                        select: {
                          id: true,
                          name: true,
                          code: true,
                          address: true,
                        },
                      },
                    },
                  },
                },
              },
            }),
      },
    });

    if (!event) {
      throw new NotFoundException(`Không tìm thấy sự kiện với ID ${id}`);
    }

    const checkinCountMap = await this.getCheckinCountByEventIds([event.id]);
    const checkinCount = checkinCountMap[event.id] ?? 0;

    // Nếu là student: kiểm tra quyền xem event
    if (currentUser?.roleName === 'student' && currentUser.campusId) {
      const isSameCampus =
        event.venue && event.venue.campusId === currentUser.campusId;
      if (!event.isGlobal && !isSameCampus) {
        throw new ForbiddenException('Bạn không có quyền truy cập sự kiện này');
      }
    }

    // Nếu là staff: kiểm tra quyền xem event theo campus
    if (currentUser?.roleName === 'staff' && currentUser.campusId) {
      const isSameCampus =
        event.venue && event.venue.campusId === currentUser.campusId;
      if (!event.isGlobal && !isSameCampus) {
        throw new ForbiddenException('Bạn không có quyền truy cập sự kiện này');
      }
    }

    // Tự động cập nhật status của event sang COMPLETED nếu đã kết thúc
    await this.checkAndUpdateEventStatus(id);

    // Reload event để lấy status mới nhất nếu đã được cập nhật
    const updatedEvent = await this.prisma.event.findUnique({
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
            campus: {
              select: {
                id: true,
                name: true,
                code: true,
                address: true,
              },
            },
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
                      isActive: true,
                      campus: {
                        select: {
                          id: true,
                          name: true,
                          code: true,
                          address: true,
                        },
                      },
                    },
                  },
                },
              },
            }),
      },
    });

    if (!updatedEvent) {
      throw new NotFoundException(`Không tìm thấy sự kiện với ID ${id}`);
    }

    const updatedCheckinCount = await this.getCheckinCountByEventIds([id]);

    return {
      ...updatedEvent,
      checkinCount: updatedCheckinCount[id] ?? 0,
    };
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
      throw new NotFoundException(`Không tìm thấy sự kiện với ID ${id}`);
    }

    // Nếu là event_organizer, kiểm tra quyền và không cho phép update status
    if (currentUser?.roleName === 'event_organizer' && currentUser.id) {
      // Kiểm tra user có phải owner của organizer không
      if (
        !existingEvent.organizer.ownerId ||
        existingEvent.organizer.ownerId !== currentUser.id
      ) {
        throw new ForbiddenException(
          'Bạn không có quyền cập nhật sự kiện này. Bạn không phải là chủ sở hữu của organizer này.',
        );
      }
    }

    // Get final organizer (new if updated, existing otherwise)
    const finalOrganizerId = dto.organizerId ?? existingEvent.organizerId;
    let finalOrganizerCampusId: number | null = null;

    // Validate organizer if being updated
    if (dto.organizerId !== undefined) {
      const organizer = await this.prisma.organizer.findUnique({
        where: { id: dto.organizerId },
        select: { id: true, ownerId: true, campusId: true },
      });

      if (!organizer) {
        throw new NotFoundException(
          `Không tìm thấy organizer với ID ${dto.organizerId}`,
        );
      }

      finalOrganizerCampusId = organizer.campusId;

      // If event_organizer, check permission for new organizer
      if (currentUser?.roleName === 'event_organizer' && currentUser.id) {
        if (!organizer.ownerId || organizer.ownerId !== currentUser.id) {
          throw new ForbiddenException(
            'Bạn không có quyền chuyển sự kiện sang organizer này. Bạn không phải là chủ sở hữu của organizer này.',
          );
        }
      }
    } else {
      // Get existing organizer's campusId
      const existingOrganizer = await this.prisma.organizer.findUnique({
        where: { id: existingEvent.organizerId },
        select: { campusId: true },
      });
      finalOrganizerCampusId = existingOrganizer?.campusId ?? null;
    }

    // Validate venue if being updated
    const finalVenueId = dto.venueId ?? existingEvent.venueId;
    if (dto.venueId !== undefined && dto.venueId !== null) {
      const venue = await this.prisma.venue.findUnique({
        where: { id: dto.venueId },
        select: { id: true, status: true, campusId: true },
      });

      if (!venue) {
        throw new NotFoundException(`Venue with ID ${dto.venueId} not found`);
      }

      if (venue.status.toUpperCase() !== 'ACTIVE') {
        throw new BadRequestException(
          `Venue with ID ${dto.venueId} is not active`,
        );
      }

      // Check if organizer and venue are in the same campus
      // Nếu organizer có campusId, thì venue phải cùng campus
      if (
        finalOrganizerCampusId !== null &&
        finalOrganizerCampusId !== venue.campusId
      ) {
        throw new BadRequestException(
          `Organizer và venue phải cùng campus. Organizer thuộc campus ID ${finalOrganizerCampusId}, nhưng venue thuộc campus ID ${venue.campusId}.`,
        );
      }
    } else if (finalVenueId && finalOrganizerCampusId !== null) {
      // If venue is not being updated but organizer is, check existing venue
      const existingVenue = await this.prisma.venue.findUnique({
        where: { id: finalVenueId },
        select: { campusId: true },
      });

      if (existingVenue && finalOrganizerCampusId !== existingVenue.campusId) {
        throw new BadRequestException(
          `Organizer và venue phải cùng campus. Organizer thuộc campus ID ${finalOrganizerCampusId}, nhưng venue thuộc campus ID ${existingVenue.campusId}.`,
        );
      }
    }

    // Validate time relationships if time fields are being updated
    const finalStartTime = dto.startTime
      ? new Date(dto.startTime)
      : existingEvent.startTime;
    const finalEndTime = dto.endTime
      ? new Date(dto.endTime)
      : existingEvent.endTime;
    const finalStartTimeRegister = dto.startTimeRegister
      ? new Date(dto.startTimeRegister)
      : existingEvent.startTimeRegister;
    const finalEndTimeRegister = dto.endTimeRegister
      ? new Date(dto.endTimeRegister)
      : existingEvent.endTimeRegister;

    // Validate time relationships
    if (dto.startTime !== undefined || dto.endTime !== undefined) {
      if (finalStartTime >= finalEndTime) {
        throw new BadRequestException(
          'Thời gian bắt đầu sự kiện phải trước thời gian kết thúc sự kiện',
        );
      }
    }

    if (
      dto.startTimeRegister !== undefined ||
      dto.endTimeRegister !== undefined
    ) {
      if (finalStartTimeRegister >= finalEndTimeRegister) {
        throw new BadRequestException(
          'Thời gian bắt đầu đăng ký phải trước thời gian kết thúc đăng ký',
        );
      }
    }

    // Check if registration ends before event starts
    if (dto.endTimeRegister !== undefined || dto.startTime !== undefined) {
      if (finalEndTimeRegister >= finalStartTime) {
        throw new BadRequestException(
          'Thời gian kết thúc đăng ký phải trước khi sự kiện bắt đầu',
        );
      }
    }

    // Check if registration start is before event start
    if (dto.startTimeRegister !== undefined || dto.startTime !== undefined) {
      if (finalStartTimeRegister >= finalStartTime) {
        throw new BadRequestException(
          'Thời gian bắt đầu đăng ký phải trước thời gian bắt đầu sự kiện',
        );
      }
    }

    // Validate title if being updated
    if (dto.title !== undefined) {
      if (!dto.title.trim()) {
        throw new BadRequestException(
          'Tiêu đề sự kiện không được để trống hoặc chỉ có khoảng trắng',
        );
      }
      if (dto.title.length > 200) {
        throw new BadRequestException(
          'Tiêu đề sự kiện không được vượt quá 200 ký tự',
        );
      }
    }

    // Validate maxCapacity if being updated
    if (dto.maxCapacity !== undefined) {
      if (dto.maxCapacity < 1) {
        throw new BadRequestException('Sức chứa tối đa phải ít nhất là 1');
      }
      if (dto.maxCapacity > 10000) {
        throw new BadRequestException(
          'Sức chứa tối đa không được vượt quá 10000',
        );
      }
    }

    // Validate venue time conflict if venue or time is being updated
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
      // Store old times to detect changes
      const oldStartTime = existingEvent.startTime;
      const oldEndTime = existingEvent.endTime;

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

      // Check if startTime or endTime changed and send notifications
      const newStartTime = event.startTime;
      const newEndTime = event.endTime;
      const hasStartTimeChange =
        dto.startTime !== undefined &&
        oldStartTime.getTime() !== newStartTime.getTime();
      const hasEndTimeChange =
        dto.endTime !== undefined &&
        oldEndTime.getTime() !== newEndTime.getTime();

      // Only send notifications if event is PUBLISHED and has registered users
      if (
        (hasStartTimeChange || hasEndTimeChange) &&
        event.status === EventStatus.PUBLISHED
      ) {
        // Get all registered users (only VALID tickets)
        const registeredUsers = await this.prisma.ticket.findMany({
          where: {
            eventId: id,
            status: TicketStatus.VALID,
          },
          select: {
            user: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        });

        if (registeredUsers.length > 0) {
          // Send push notification
          this.notificationService
            .notifyEventTimeChangedToAttendees(
              id,
              event.title,
              hasStartTimeChange,
              hasEndTimeChange,
            )
            .catch((error) => {
              console.error(
                `Failed to send time change notification to attendees for event ${id}:`,
                error,
              );
            });

          // Send email to all registered users
          const uniqueUsers = Array.from(
            new Map(registeredUsers.map((t) => [t.user.id, t.user])).values(),
          );

          for (const user of uniqueUsers) {
            this.emailService
              .sendEventTimeChangeEmail({
                email: user.email,
                fullName:
                  `${user.firstName || ''} ${user.lastName || ''}`.trim() ||
                  'Bạn',
                eventTitle: event.title,
                oldStartTime: hasStartTimeChange ? oldStartTime : undefined,
                newStartTime: hasStartTimeChange ? newStartTime : undefined,
                oldEndTime: hasEndTimeChange ? oldEndTime : undefined,
                newEndTime: hasEndTimeChange ? newEndTime : undefined,
              })
              .catch((error) => {
                console.error(
                  `Failed to send time change email to user ${user.id} (${user.email}):`,
                  error,
                );
              });
          }
        }
      }

      return event;
    } catch (error: unknown) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        (error as { code: string }).code === 'P2025'
      ) {
        throw new NotFoundException(`Không tìm thấy sự kiện với ID ${id}`);
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
        select: {
          id: true,
          status: true,
          venueId: true,
          title: true,
        },
      });

      if (!event) {
        throw new NotFoundException(`Không tìm thấy sự kiện với ID ${id}`);
      }

      // Chỉ cho phép thay đổi status từ PENDING sang PUBLISHED hoặc CANCELED
      if (event.status !== EventStatus.PENDING) {
        throw new BadRequestException(
          `Trạng thái sự kiện là ${event.status}. Chỉ sự kiện PENDING mới có thể được phê duyệt hoặc hủy.`,
        );
      }

      // Lấy organizer ownerId trước khi update để gửi notification
      const eventWithOrganizer = await this.prisma.event.findUnique({
        where: { id },
        select: {
          id: true,
          title: true,
          organizer: {
            select: {
              ownerId: true,
            },
          },
        },
      });

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
              campusId: true,
              campus: {
                select: {
                  id: true,
                  name: true,
                  code: true,
                  address: true,
                },
              },
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

      // Note: Không cần reset isBooked khi cancel event vì availability được tính động qua Ticket với eventId

      // Gửi thông báo cho organizer khi admin approve hoặc reject event
      if (eventWithOrganizer && eventWithOrganizer.organizer.ownerId) {
        this.notificationService
          .notifyEventStatusChange(
            eventWithOrganizer.organizer.ownerId,
            {
              id: updatedEvent.id,
              title: updatedEvent.title,
              status: dto.status,
            },
            dto.status,
          )
          .catch((error) => {
            console.error(
              `Failed to send notification to organizer ${eventWithOrganizer.organizer.ownerId}:`,
              error,
            );
          });
      }

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
        throw new NotFoundException(`Không tìm thấy sự kiện với ID ${id}`);
      }

      throw error;
    }
  }

  async cancelEvent(
    id: string,
    dto: RequestCancellationDto,
    currentUser: { userId: number; roleName: string },
  ) {
    try {
      // Get event with organizer info to check permissions
      const event = await this.prisma.event.findUnique({
        where: { id },
        select: {
          id: true,
          title: true,
          status: true,
          organizer: {
            select: {
              id: true,
              ownerId: true,
            },
          },
        },
      });

      if (!event) {
        throw new NotFoundException(`Không tìm thấy sự kiện với ID ${id}`);
      }

      // Check permissions - only organizer owner can request cancellation
      const isOrganizerOwner =
        currentUser.roleName === 'event_organizer' &&
        event.organizer.ownerId === currentUser.userId;

      if (!isOrganizerOwner) {
        throw new ForbiddenException(
          'Bạn không có quyền yêu cầu hủy sự kiện này. Chỉ chủ sở hữu organizer mới có thể yêu cầu hủy sự kiện.',
        );
      }

      // Only allow requesting cancellation for PUBLISHED events
      if (event.status !== EventStatus.PUBLISHED) {
        throw new BadRequestException(
          `Không thể yêu cầu hủy sự kiện này. Chỉ có thể yêu cầu hủy sự kiện đã được PUBLISHED. Trạng thái hiện tại: ${event.status}`,
        );
      }

      // Check if there's already a PENDING cancellation request
      const existingRequest =
        await this.prisma.eventCancellationRequest.findFirst({
          where: {
            eventId: id,
            status: 'PENDING',
          },
        });

      if (existingRequest) {
        throw new BadRequestException(
          'Đã có yêu cầu hủy sự kiện đang chờ phê duyệt. Vui lòng chờ admin xem xét.',
        );
      }

      // Create cancellation request
      const cancellationRequest =
        await this.prisma.eventCancellationRequest.create({
          data: {
            eventId: id,
            requestedBy: currentUser.userId,
            reason: dto.reason,
            status: 'PENDING',
          },
          include: {
            event: {
              select: {
                id: true,
                title: true,
              },
            },
            requester: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
        });

      // Send notification to all admins
      this.notificationService
        .notifyCancellationRequestToAdmins({
          eventId: id,
          eventTitle: event.title,
          organizerName:
            `${cancellationRequest.requester.firstName || ''} ${cancellationRequest.requester.lastName || ''}`.trim() ||
            'Organizer',
          reason: dto.reason,
          requestId: cancellationRequest.id,
        })
        .catch((error) => {
          console.error(
            `Failed to send cancellation request notification to admins for event ${id}:`,
            error,
          );
        });

      return {
        message:
          'Yêu cầu hủy sự kiện đã được gửi. Vui lòng chờ admin phê duyệt.',
        cancellationRequest: {
          id: cancellationRequest.id,
          eventId: cancellationRequest.eventId,
          reason: cancellationRequest.reason,
          status: cancellationRequest.status,
          createdAt: cancellationRequest.createdAt,
        },
      };
    } catch (error: unknown) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        (error as { code: string }).code === 'P2025'
      ) {
        throw new NotFoundException(`Không tìm thấy sự kiện với ID ${id}`);
      }

      throw error;
    }
  }

  /**
   * Admin phê duyệt hoặc từ chối yêu cầu hủy sự kiện
   */
  async approveCancellationRequest(
    requestId: number,
    dto: ApproveCancellationDto,
    currentUser: { userId: number; roleName: string },
  ) {
    if (currentUser.roleName !== 'admin') {
      throw new ForbiddenException(
        'Chỉ admin mới có quyền phê duyệt yêu cầu hủy sự kiện.',
      );
    }

    const cancellationRequest =
      await this.prisma.eventCancellationRequest.findUnique({
        where: { id: requestId },
        include: {
          event: {
            select: {
              id: true,
              title: true,
              status: true,
              startTime: true,
              endTime: true,
              organizer: {
                select: {
                  ownerId: true,
                },
              },
            },
          },
          requester: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
      });

    if (!cancellationRequest) {
      throw new NotFoundException(
        `Không tìm thấy yêu cầu hủy sự kiện với ID ${requestId}`,
      );
    }

    if (cancellationRequest.status !== 'PENDING') {
      throw new BadRequestException(
        `Yêu cầu hủy sự kiện này đã được xử lý. Trạng thái hiện tại: ${cancellationRequest.status}`,
      );
    }

    // Update cancellation request status
    const updatedRequest = await this.prisma.eventCancellationRequest.update({
      where: { id: requestId },
      data: {
        status: dto.status,
        reviewedBy: currentUser.userId,
        reviewedAt: new Date(),
      },
      include: {
        event: {
          select: {
            id: true,
            title: true,
            status: true,
            startTime: true,
            endTime: true,
            organizer: {
              select: {
                ownerId: true,
              },
            },
          },
        },
        requester: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    // If approved, actually cancel the event
    if (dto.status === 'APPROVED') {
      await this.processCancellation(
        cancellationRequest.event.id,
        cancellationRequest.reason,
      );
    } else {
      // If rejected, send notification and email to organizer
      const organizerOwnerId = cancellationRequest.event.organizer.ownerId;
      if (organizerOwnerId) {
        this.notificationService
          .notifyCancellationRequestRejected({
            organizerOwnerId,
            eventId: cancellationRequest.event.id,
            eventTitle: cancellationRequest.event.title,
            adminNote: dto.adminNote,
          })
          .catch((error) => {
            console.error(
              `Failed to send rejection notification to organizer ${organizerOwnerId}:`,
              error,
            );
          });

        // Get organizer owner email
        const organizerOwner = await this.prisma.user.findUnique({
          where: { id: organizerOwnerId },
          select: { email: true, firstName: true, lastName: true },
        });

        if (organizerOwner) {
          this.emailService
            .sendCancellationRequestRejectedEmail({
              email: organizerOwner.email,
              fullName:
                `${organizerOwner.firstName || ''} ${organizerOwner.lastName || ''}`.trim() ||
                'Bạn',
              eventTitle: cancellationRequest.event.title,
              reason: cancellationRequest.reason,
              adminNote: dto.adminNote,
            })
            .catch((error) => {
              console.error(
                `Failed to send rejection email to organizer ${organizerOwnerId}:`,
                error,
              );
            });
        }
      }
    }

    return {
      message:
        dto.status === 'APPROVED'
          ? 'Yêu cầu hủy sự kiện đã được phê duyệt. Sự kiện đã được hủy.'
          : 'Yêu cầu hủy sự kiện đã bị từ chối.',
      cancellationRequest: updatedRequest,
    };
  }

  /**
   * Thực hiện hủy sự kiện (internal method, được gọi khi admin approve cancellation request)
   */
  private async processCancellation(eventId: string, reason?: string) {
    // Use transaction to ensure data consistency
    return await this.prisma.$transaction(async (tx) => {
      // Get all users who registered for this event (BEFORE cancelling tickets)
      // to send notifications and emails
      const registeredUsers = await tx.ticket.findMany({
        where: {
          eventId: eventId,
          status: TicketStatus.VALID, // Only get valid tickets
        },
        select: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      });

      // Get event details for email/notification
      const eventDetails = await tx.event.findUnique({
        where: { id: eventId },
        select: {
          id: true,
          title: true,
          startTime: true,
          endTime: true,
        },
      });

      // Update event status to CANCELED
      const updatedEvent = await tx.event.update({
        where: { id: eventId },
        data: {
          status: EventStatus.CANCELED,
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
              campusId: true,
              campus: {
                select: {
                  id: true,
                  name: true,
                  code: true,
                  address: true,
                },
              },
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

      // Cancel all tickets for this event (only VALID tickets)
      const cancelledTickets = await tx.ticket.updateMany({
        where: {
          eventId: eventId,
          status: TicketStatus.VALID, // Only cancel valid tickets
        },
        data: {
          status: TicketStatus.CANCELLED,
        },
      });

      // Free all seats that were booked for this event
      // Get all tickets with seats for this event
      const ticketsWithSeats = await tx.ticket.findMany({
        where: {
          eventId: eventId,
          seatId: { not: null },
        },
        select: {
          seatId: true,
        },
      });

      // Get unique seat IDs
      const seatIds = [
        ...new Set(
          ticketsWithSeats
            .map((t) => t.seatId)
            .filter((id): id is number => id !== null),
        ),
      ];

      // Free all seats
      if (seatIds.length > 0) {
        await tx.seat.updateMany({
          where: {
            id: { in: seatIds },
          },
          data: {
            isBooked: false,
          },
        });
      }

      // Remove all staff assignments for this event
      const removedStaff = await tx.eventStaff.deleteMany({
        where: {
          eventId: eventId,
        },
      });

      // Remove all speaker assignments for this event
      const removedSpeakers = await tx.eventSpeaker.deleteMany({
        where: {
          eventId: eventId,
        },
      });

      // Note: registeredCount is not decremented because we want to keep the record
      // of how many people registered before cancellation

      // Get organizer owner ID
      const organizerOwnerId = await tx.event
        .findUnique({
          where: { id: eventId },
          select: {
            organizer: {
              select: {
                ownerId: true,
              },
            },
          },
        })
        .then((e) => e?.organizer.ownerId);

      // Send notification to organizer
      if (organizerOwnerId) {
        this.notificationService
          .notifyEventStatusChange(
            organizerOwnerId,
            {
              id: updatedEvent.id,
              title: updatedEvent.title,
              status: EventStatus.CANCELED,
            },
            EventStatus.CANCELED,
          )
          .catch((error) => {
            console.error(
              `Failed to send notification to organizer ${organizerOwnerId}:`,
              error,
            );
          });
      }

      // Send notification to all registered users via OneSignal
      this.notificationService
        .notifyEventCancelledToAttendees(eventId, updatedEvent.title)
        .catch((error) => {
          console.error(
            `Failed to send cancellation notification to attendees for event ${eventId}:`,
            error,
          );
        });

      // Send email to all registered users
      const uniqueUsers = Array.from(
        new Map(registeredUsers.map((t) => [t.user.id, t.user])).values(),
      );

      for (const user of uniqueUsers) {
        this.emailService
          .sendEventCancellationEmail({
            email: user.email,
            fullName:
              `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Bạn',
            eventTitle: eventDetails?.title || updatedEvent.title,
            eventStartTime: eventDetails?.startTime,
          })
          .catch((error) => {
            console.error(
              `Failed to send cancellation email to user ${user.id} (${user.email}):`,
              error,
            );
          });
      }

      // Send notification to organizer about cancellation approval
      if (organizerOwnerId) {
        this.notificationService
          .notifyCancellationRequestApproved({
            organizerOwnerId,
            eventId: eventId,
            eventTitle: updatedEvent.title,
          })
          .catch((error) => {
            console.error(
              `Failed to send approval notification to organizer ${organizerOwnerId}:`,
              error,
            );
          });

        // Get organizer owner email
        const organizerOwner = await tx.user.findUnique({
          where: { id: organizerOwnerId },
          select: { email: true, firstName: true, lastName: true },
        });

        if (organizerOwner) {
          this.emailService
            .sendCancellationRequestApprovedEmail({
              email: organizerOwner.email,
              fullName:
                `${organizerOwner.firstName || ''} ${organizerOwner.lastName || ''}`.trim() ||
                'Bạn',
              eventTitle: updatedEvent.title,
              reason: reason,
            })
            .catch((error) => {
              console.error(
                `Failed to send approval email to organizer ${organizerOwnerId}:`,
                error,
              );
            });
        }
      }

      return {
        ...updatedEvent,
        message: 'Sự kiện đã được hủy thành công',
        cancelledTicketsCount: cancelledTickets.count,
        freedSeatsCount: seatIds.length,
        removedStaffCount: removedStaff.count,
        removedSpeakersCount: removedSpeakers.count,
      };
    });
  }

  /**
   * Admin có thể hủy sự kiện trực tiếp (không cần approval)
   */
  async cancelEventByAdmin(
    id: string,
    currentUser: { userId: number; roleName: string },
  ) {
    if (currentUser.roleName !== 'admin') {
      throw new ForbiddenException(
        'Chỉ admin mới có quyền hủy sự kiện trực tiếp.',
      );
    }

    const event = await this.prisma.event.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        status: true,
      },
    });

    if (!event) {
      throw new NotFoundException(`Không tìm thấy sự kiện với ID ${id}`);
    }

    // Only allow canceling PUBLISHED events
    if (event.status !== EventStatus.PUBLISHED) {
      throw new BadRequestException(
        `Không thể hủy sự kiện này. Chỉ có thể hủy sự kiện đã được PUBLISHED. Trạng thái hiện tại: ${event.status}`,
      );
    }

    return await this.processCancellation(id, 'Admin đã hủy sự kiện trực tiếp');
  }

  /**
   * Admin lấy danh sách các yêu cầu hủy sự kiện
   */
  async getCancellationRequests(query: QueryCancellationRequestsDto) {
    const { page = 1, limit = 10, status, eventId, requestedBy } = query;

    const where: Prisma.EventCancellationRequestWhereInput = {};

    if (status) {
      where.status = status;
    }

    if (eventId) {
      where.eventId = eventId;
    }

    if (requestedBy) {
      where.requestedBy = requestedBy;
    }

    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      this.prisma.eventCancellationRequest.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          event: {
            select: {
              id: true,
              title: true,
              status: true,
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
          requester: {
            select: {
              id: true,
              userName: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
          reviewer: {
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
      this.prisma.eventCancellationRequest.count({ where }),
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
              campusId: true,
              campus: {
                select: {
                  id: true,
                  name: true,
                  code: true,
                  address: true,
                },
              },
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

    const checkinMap = await this.getCheckinCountByEventIds(
      items.map((e) => e.id),
    );

    return {
      data: items.map((e) => ({
        ...e,
        checkinCount: checkinMap[e.id] ?? 0,
      })),
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
        venue: {
          select: {
            id: true,
            campusId: true,
            campus: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    if (!event) {
      throw new NotFoundException(`Không tìm thấy sự kiện với ID ${eventId}`);
    }

    // Check permission: admin can assign to any event, event_organizer only to their own events
    if (currentUser?.roleName === 'event_organizer' && currentUser.userId) {
      // Kiểm tra xem user có phải là owner của organizer không
      if (!event.organizer.ownerId) {
        throw new ForbiddenException(
          'Organizer này không có chủ sở hữu. Bạn không thể phân công staff cho sự kiện của organizer này.',
        );
      }

      if (event.organizer.ownerId !== currentUser.userId) {
        throw new ForbiddenException(
          'Bạn không có quyền phân công staff cho sự kiện này. Bạn không phải là chủ sở hữu của organizer này.',
        );
      }
    }
    // Admin can assign to any event, so no check needed

    // Check if user exists
    const user = await this.prisma.user.findUnique({
      where: { id: dto.userId },
      include: {
        campus: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException(`Không tìm thấy user với ID ${dto.userId}`);
    }

    // Validate role: only staff can be assigned, not student or other roles
    if (user.roleName === 'student') {
      throw new BadRequestException(
        'Không thể phân công sinh viên cho sự kiện. Chỉ thành viên staff mới có thể được phân công.',
      );
    }

    if (user.roleName !== 'staff') {
      throw new BadRequestException(
        `User với ID ${dto.userId} không phải là staff. Chỉ staff mới có thể được phân công cho sự kiện.`,
      );
    }

    // Validate campus: staff phải cùng campus với event venue
    if (!event.venue) {
      throw new BadRequestException(
        'Sự kiện chưa có địa điểm (venue). Vui lòng chọn địa điểm trước khi phân công staff.',
      );
    }

    if (!event.venue.campusId) {
      throw new BadRequestException(
        'Địa điểm của sự kiện chưa có campus. Không thể phân công staff.',
      );
    }

    if (!user.campusId) {
      throw new BadRequestException(
        `Staff với ID ${dto.userId} chưa được gán vào campus. Không thể phân công cho sự kiện.`,
      );
    }

    if (event.venue.campusId !== user.campusId) {
      throw new BadRequestException(
        `Staff phải thuộc cùng campus với địa điểm của sự kiện. Sự kiện thuộc campus "${event.venue.campus?.name || event.venue.campusId}", nhưng staff thuộc campus "${user.campus?.name || user.campusId}".`,
      );
    }

    // Check if staff is already assigned to another event during the same time period
    const conflictingAssignments = await this.prisma.eventStaff.findMany({
      where: {
        userId: dto.userId,
        event: {
          status: {
            in: [EventStatus.PUBLISHED, EventStatus.PENDING],
          },
          // Check if time ranges overlap
          OR: [
            // New event starts during existing event
            {
              AND: [
                { startTime: { lte: event.startTime } },
                { endTime: { gt: event.startTime } },
              ],
            },
            // New event ends during existing event
            {
              AND: [
                { startTime: { lt: event.endTime } },
                { endTime: { gte: event.endTime } },
              ],
            },
            // New event completely contains existing event
            {
              AND: [
                { startTime: { gte: event.startTime } },
                { endTime: { lte: event.endTime } },
              ],
            },
            // Existing event completely contains new event
            {
              AND: [
                { startTime: { lte: event.startTime } },
                { endTime: { gte: event.endTime } },
              ],
            },
          ],
        },
      },
      include: {
        event: {
          select: {
            id: true,
            title: true,
            startTime: true,
            endTime: true,
            status: true,
          },
        },
      },
    });

    if (conflictingAssignments.length > 0) {
      const conflictingEvent = conflictingAssignments[0].event;
      throw new BadRequestException(
        `Staff đã được phân công cho sự kiện "${conflictingEvent.title}" từ ${new Date(conflictingEvent.startTime).toLocaleString('vi-VN')} đến ${new Date(conflictingEvent.endTime).toLocaleString('vi-VN')}. Không thể phân công cùng lúc cho nhiều sự kiện trong cùng khoảng thời gian.`,
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
              organizer: {
                select: {
                  name: true,
                },
              },
              venue: {
                select: {
                  name: true,
                  location: true,
                },
              },
            },
          },
        },
      });

      // Gửi thông báo cho staff khi được assign vào event
      // Gọi bất đồng bộ, không chờ kết quả để không làm chậm response
      this.notificationService
        .notifyStaffAssigned(dto.userId, {
          id: eventStaff.event.id,
          title: eventStaff.event.title,
          startTime: eventStaff.event.startTime,
          endTime: eventStaff.event.endTime,
          organizer: eventStaff.event.organizer,
        })
        .catch((error) => {
          // Log lỗi nhưng không throw để không ảnh hưởng đến response
          console.error(
            `Failed to send notification to staff ${dto.userId}:`,
            error,
          );
        });

      // Gửi email thông báo cho staff khi được assign vào event
      this.emailService
        .sendStaffAssignedEmail({
          email: eventStaff.user.email,
          fullName:
            `${eventStaff.user.firstName} ${eventStaff.user.lastName}`.trim() ||
            eventStaff.user.userName,
          eventTitle: eventStaff.event.title,
          eventStartTime: eventStaff.event.startTime,
          eventEndTime: eventStaff.event.endTime,
          organizerName: eventStaff.event.organizer?.name,
          venueName: eventStaff.event.venue?.name,
          venueLocation: eventStaff.event.venue?.location,
        })
        .catch((error) => {
          console.error(`Failed to send email to staff ${dto.userId}:`, error);
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
          'Staff này đã được phân công cho sự kiện này',
        );
      }

      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        (error as { code: string }).code === 'P2003'
      ) {
        throw new NotFoundException('Không tìm thấy sự kiện hoặc user');
      }

      throw error;
    }
  }

  async removeStaff(
    eventId: string,
    userId: number,
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
      throw new NotFoundException(`Không tìm thấy sự kiện với ID ${eventId}`);
    }

    // Check permission: admin can remove from any event, event_organizer only from their own events
    if (currentUser?.roleName === 'event_organizer' && currentUser.userId) {
      // Kiểm tra xem user có phải là owner của organizer không
      if (!event.organizer.ownerId) {
        throw new ForbiddenException(
          'Organizer này không có chủ sở hữu. Bạn không thể gỡ staff khỏi sự kiện của organizer này.',
        );
      }

      if (event.organizer.ownerId !== currentUser.userId) {
        throw new ForbiddenException(
          'Bạn không có quyền gỡ staff khỏi sự kiện này. Bạn không phải là chủ sở hữu của organizer này.',
        );
      }
    }
    // Admin can remove from any event, so no check needed

    // Check if EventStaff exists
    const eventStaff = await this.prisma.eventStaff.findFirst({
      where: {
        eventId: eventId,
        userId: userId,
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
      },
    });

    if (!eventStaff) {
      throw new NotFoundException(
        `Staff với ID ${userId} không được phân công cho sự kiện ${eventId}`,
      );
    }

    try {
      await this.prisma.eventStaff.delete({
        where: { id: eventStaff.id },
      });

      return {
        message: `Đã gỡ staff ${eventStaff.user.userName} (ID: ${userId}) khỏi sự kiện ${eventId}`,
      };
    } catch (error: unknown) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        (error as { code: string }).code === 'P2025'
      ) {
        throw new NotFoundException('Không tìm thấy EventStaff');
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
              campusId: true,
              campus: {
                select: {
                  id: true,
                  name: true,
                  code: true,
                  address: true,
                },
              },
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
                  isActive: true,
                  campus: {
                    select: {
                      id: true,
                      name: true,
                      code: true,
                      address: true,
                    },
                  },
                },
              },
            },
          },
        },
      }),
      this.prisma.event.count({ where }),
    ]);

    const checkinMap = await this.getCheckinCountByEventIds(
      items.map((e) => e.id),
    );

    return {
      data: items.map((e) => ({
        ...e,
        checkinCount: checkinMap[e.id] ?? 0,
      })),
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
      throw new NotFoundException('Không tìm thấy sự kiện');
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
      throw new ForbiddenException('Bạn không được phép xem tổng kết này');
    }

    // Ensure event ended
    const now = new Date();
    if (now < new Date(event.endTime)) {
      throw new BadRequestException('Sự kiện chưa kết thúc');
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
    // Sử dụng Prisma raw query để group by tháng từ startTime (ngày tổ chức sự kiện)
    const events = await this.prisma.$queryRaw<
      Array<{ month: number; count: bigint }>
    >`
      SELECT 
        EXTRACT(MONTH FROM start_time)::int as month,
        COUNT(*)::bigint as count
      FROM events
      WHERE EXTRACT(YEAR FROM start_time) = ${year}
      GROUP BY EXTRACT(MONTH FROM start_time)
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

  private async getCheckinCountByEventIds(
    eventIds: string[],
  ): Promise<Record<string, number>> {
    if (!eventIds || eventIds.length === 0) {
      return {};
    }

    const counts = await this.prisma.ticket.groupBy({
      by: ['eventId'],
      where: {
        eventId: { in: eventIds },
        status: TicketStatus.USED,
      },
      _count: { _all: true },
    });

    return counts.reduce<Record<string, number>>((acc, item) => {
      acc[item.eventId] = item._count._all;
      return acc;
    }, {});
  }

  /**
   * Kiểm tra và tự động cập nhật status của event sang COMPLETED nếu đã kết thúc
   * @param eventId - ID của event cần kiểm tra
   */
  private async checkAndUpdateEventStatus(eventId: string): Promise<void> {
    try {
      const now = new Date();
      await this.prisma.event.updateMany({
        where: {
          id: eventId,
          endTime: {
            lt: now, // endTime < now (đã kết thúc)
          },
          status: {
            in: [EventStatus.PENDING, EventStatus.PUBLISHED], // Chỉ update các event chưa completed hoặc canceled
          },
        },
        data: {
          status: EventStatus.COMPLETED,
        },
      });
    } catch (error) {
      // Log lỗi nhưng không throw để không ảnh hưởng đến flow chính
      console.error(`Error updating event status for event ${eventId}:`, error);
    }
  }

  /**
   * Kiểm tra và tự động cập nhật status của nhiều events sang COMPLETED nếu đã kết thúc
   * @param eventIds - Mảng ID của các events cần kiểm tra
   */
  private async checkAndUpdateMultipleEventStatuses(
    eventIds: string[],
  ): Promise<void> {
    if (eventIds.length === 0) return;

    try {
      const now = new Date();
      await this.prisma.event.updateMany({
        where: {
          id: {
            in: eventIds,
          },
          endTime: {
            lt: now, // endTime < now (đã kết thúc)
          },
          status: {
            in: [EventStatus.PENDING, EventStatus.PUBLISHED], // Chỉ update các event chưa completed hoặc canceled
          },
        },
        data: {
          status: EventStatus.COMPLETED,
        },
      });
    } catch (error) {
      // Log lỗi nhưng không throw để không ảnh hưởng đến flow chính
      console.error('Error updating multiple event statuses:', error);
    }
  }
}
