import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { OrganizerRequestStatus, UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { NotificationService } from '../notification/notification.service';
import {
  QueryOrganizerRequestDto,
  ReviewOrganizerRequestDto,
  SubmitOrganizerRequestDto,
} from './dto';

@Injectable()
export class OrganizerRequestService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
    private readonly notificationService: NotificationService,
  ) {}

  async submit(userId: number, dto: SubmitOrganizerRequestDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        roleName: true,
        email: true,
        firstName: true,
        lastName: true,
        userName: true,
      },
    });

    if (!user) {
      throw new NotFoundException('Không tìm thấy user');
    }

    if (user.roleName !== UserRole.student) {
      throw new BadRequestException('Chỉ student mới được gửi yêu cầu');
    }

    const existingPending = await this.prisma.organizerRequest.findFirst({
      where: { userId, status: OrganizerRequestStatus.PENDING },
    });
    if (existingPending) {
      throw new ConflictException('Bạn đã có yêu cầu đang chờ duyệt');
    }

    // Validate campus
    const campus = await this.prisma.campus.findUnique({
      where: { id: dto.campusId },
    });
    if (!campus) {
      throw new NotFoundException('Không tìm thấy campus');
    }

    const request = await this.prisma.organizerRequest.create({
      data: {
        userId,
        name: dto.name,
        description: dto.description,
        contactEmail: dto.contactEmail ?? user.email,
        campusId: dto.campusId,
        logoUrl: dto.logoUrl,
        proofImageUrl: dto.proofImageUrl,
      },
      include: {
        campus: true,
      },
    });

    const fullName =
      `${user.firstName} ${user.lastName}`.trim() || user.userName;

    // Notify requester
    this.emailService
      .sendOrganizerRequestSubmittedUser({
        email: user.email,
        fullName,
        organizerName: dto.name,
      })
      .catch((error) =>
        console.error(
          `Failed to send organizer request submitted email to ${user.email}:`,
          error,
        ),
      );

    // Notify admins
    const admins = await this.prisma.user.findMany({
      where: { roleName: UserRole.admin, isActive: true },
      select: { email: true, firstName: true, lastName: true, userName: true },
    });
    const requesterName = fullName;
    // Push notifications
    this.notificationService
      .notifyOrganizerRequestSubmittedToAdmins({
        requestId: request.id,
        organizerName: dto.name,
        requesterName,
      })
      .catch((error) =>
        console.error(
          `Failed to send OneSignal organizer request to admins:`,
          error,
        ),
      );

    this.notificationService
      .notifyOrganizerRequestSubmittedToUser({
        userId,
        requestId: request.id,
        organizerName: dto.name,
      })
      .catch((error) =>
        console.error(
          `Failed to send OneSignal organizer request to user ${userId}:`,
          error,
        ),
      );

    return request;
  }

  async listForAdmin(query: QueryOrganizerRequestDto) {
    const { page = 1, limit = 10, status } = query;
    const where = status ? { status } : {};
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      this.prisma.organizerRequest.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              userName: true,
              roleName: true,
              campus: { select: { id: true, name: true, code: true } },
            },
          },
          campus: {
            select: { id: true, name: true, code: true },
          },
          adminReviewer: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              userName: true,
            },
          },
        },
      }),
      this.prisma.organizerRequest.count({ where }),
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

  async review(id: number, adminId: number, dto: ReviewOrganizerRequestDto) {
    const request = await this.prisma.organizerRequest.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            userName: true,
            roleName: true,
          },
        },
        campus: {
          select: { id: true, name: true, code: true },
        },
      },
    });

    if (!request) {
      throw new NotFoundException('Không tìm thấy yêu cầu');
    }

    if (request.status !== OrganizerRequestStatus.PENDING) {
      throw new BadRequestException('Yêu cầu đã được xử lý');
    }

    if (
      dto.status !== OrganizerRequestStatus.APPROVED &&
      dto.status !== OrganizerRequestStatus.REJECTED
    ) {
      throw new BadRequestException('Trạng thái không hợp lệ');
    }

    if (dto.status === OrganizerRequestStatus.REJECTED && !dto.reason) {
      throw new BadRequestException('Cần lý do khi từ chối');
    }

    let organizerCreated: { id: number; name: string } | null = null;
    let organizerCreatedName: string | null = null;

    await this.prisma.$transaction(async (tx) => {
      // Update request
      await tx.organizerRequest.update({
        where: { id },
        data: {
          status: dto.status,
          reason: dto.reason,
          adminReviewerId: adminId,
          reviewedAt: new Date(),
        },
      });

      if (dto.status === OrganizerRequestStatus.APPROVED) {
        // Update user role to event_organizer
        await tx.user.update({
          where: { id: request.userId },
          data: { roleName: UserRole.event_organizer },
        });

        // Create organizer
        const organizer = await tx.organizer.create({
          data: {
            name: request.name,
            description: request.description,
            contactEmail: request.contactEmail ?? request.user.email,
            campusId: request.campusId,
            ownerId: request.userId,
            logoUrl: request.logoUrl,
          },
        });
        organizerCreated = { id: organizer.id, name: organizer.name };
        organizerCreatedName = organizer.name;
      }
    });

    const fullName =
      `${request.user.firstName} ${request.user.lastName}`.trim() ||
      request.user.userName;

    if (dto.status === OrganizerRequestStatus.APPROVED) {
      this.emailService
        .sendOrganizerRequestApproved({
          email: request.user.email,
          fullName,
          organizerName: organizerCreatedName ?? request.name,
        })
        .catch((error) =>
          console.error(
            `Failed to send organizer request approved email to ${request.user.email}:`,
            error,
          ),
        );
    } else {
      this.emailService
        .sendOrganizerRequestRejected({
          email: request.user.email,
          fullName,
          organizerName: request.name,
          reason: dto.reason,
        })
        .catch((error) =>
          console.error(
            `Failed to send organizer request rejected email to ${request.user.email}:`,
            error,
          ),
        );
    }

    // Push notifications (OneSignal)
    if (dto.status === OrganizerRequestStatus.APPROVED) {
      this.notificationService
        .notifyOrganizerRequestApproved({
          userId: request.userId,
          requestId: request.id,
          organizerName: organizerCreatedName ?? request.name,
        })
        .catch((error) =>
          console.error(
            `Failed to send OneSignal organizer request approved to user ${request.userId}:`,
            error,
          ),
        );
    } else {
      this.notificationService
        .notifyOrganizerRequestRejected({
          userId: request.userId,
          requestId: request.id,
          organizerName: request.name,
          reason: dto.reason,
        })
        .catch((error) =>
          console.error(
            `Failed to send OneSignal organizer request rejected to user ${request.userId}:`,
            error,
          ),
        );
    }

    return { success: true, status: dto.status, organizer: organizerCreated };
  }
}
