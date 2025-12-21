import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as argon2 from 'argon2';
import * as crypto from 'crypto';
import { OrganizerRequestStatus, UserRole, UserStatus } from '@prisma/client';
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
        memberEmails: dto.memberEmails ?? [],
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
            campusId: true,
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

    const createdStaffAccounts: {
      email: string;
      password: string;
      fullName: string;
    }[] = [];

    const upgradedStaffAccounts: {
      email: string;
      fullName: string;
    }[] = [];

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

        // Tạo/nâng cấp tài khoản staff cho các email thành viên CLB
        const memberEmails = request.memberEmails ?? [];
        const campusIdForStaff = request.campusId ?? request.user.campusId;

        if (!campusIdForStaff && memberEmails.length > 0) {
          throw new BadRequestException(
            'Không xác định được campus cho staff của organizer này',
          );
        }

        for (const rawEmail of memberEmails) {
          const email = rawEmail?.trim().toLowerCase();
          if (!email) continue;

          const existingUser = await tx.user.findUnique({
            where: { email },
          });

          if (existingUser) {
            // Nếu user đang là student thì nâng lên staff, các role khác giữ nguyên role
            if (existingUser.roleName === UserRole.student) {
              const updated = await tx.user.update({
                where: { id: existingUser.id },
                data: {
                  roleName: UserRole.staff,
                },
              });

              upgradedStaffAccounts.push({
                email: updated.email,
                fullName:
                  `${updated.firstName} ${updated.lastName}`.trim() ||
                  updated.userName,
              });
            } else {
              // Không đổi role nhưng vẫn gửi mail thông báo
              upgradedStaffAccounts.push({
                email: existingUser.email,
                fullName:
                  `${existingUser.firstName} ${existingUser.lastName}`.trim() ||
                  existingUser.userName,
              });
            }

            continue;
          }

          // Tạo tài khoản staff mới với password ngẫu nhiên
          const randomPassword = generateRandomPassword();
          const passwordHash = await argon2.hash(randomPassword);

          const usernameBase = email.split('@')[0];
          let userName = usernameBase;

          // Đảm bảo username là unique, nếu trùng thì thêm số đuôi
          let counter = 1;

          while (true) {
            const conflict = await tx.user.findUnique({
              where: { userName },
            });
            if (!conflict) break;
            userName = `${usernameBase}${counter}`;
            counter += 1;
          }

          const createdUser = await tx.user.create({
            data: {
              userName,
              email,
              campusId: campusIdForStaff!,
              roleName: UserRole.staff,
              passwordHash,
              firstName: '',
              lastName: '',
              status: UserStatus.APPROVED,
              isActive: true,
            },
          });

          createdStaffAccounts.push({
            email: createdUser.email,
            password: randomPassword,
            fullName:
              `${createdUser.firstName} ${createdUser.lastName}`.trim() ||
              createdUser.userName,
          });
        }
      }
    });

    const fullName =
      `${request.user.firstName} ${request.user.lastName}`.trim() ||
      request.user.userName;

    if (dto.status === OrganizerRequestStatus.APPROVED) {
      const organizerNameForMail = organizerCreatedName ?? request.name;

      this.emailService
        .sendOrganizerRequestApproved({
          email: request.user.email,
          fullName,
          organizerName: organizerNameForMail,
        })
        .catch((error) =>
          console.error(
            `Failed to send organizer request approved email to ${request.user.email}:`,
            error,
          ),
        );

      // Gửi email cho các tài khoản staff mới được tạo (giống luồng createUser)
      for (const staff of createdStaffAccounts) {
        this.emailService
          .sendAccountCreatedEmail({
            email: staff.email,
            password: staff.password,
            roleName: UserRole.staff,
            fullName: staff.fullName,
          })
          .catch((error) =>
            console.error(
              `Failed to send staff account created email to ${staff.email}:`,
              error,
            ),
          );
      }

      // Gửi email thông báo nâng quyền staff cho các user đã tồn tại
      for (const staff of upgradedStaffAccounts) {
        this.emailService
          .sendStaffRoleUpgradedEmail({
            email: staff.email,
            fullName: staff.fullName,
            organizerName: organizerNameForMail,
          })
          .catch((error) =>
            console.error(
              `Failed to send staff role upgraded email to ${staff.email}:`,
              error,
            ),
          );
      }
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

function generateRandomPassword(length = 12) {
  // Sinh password ngẫu nhiên, loại ký tự đặc biệt để tránh gây nhầm lẫn
  const raw = crypto.randomBytes(16).toString('base64');
  const sanitized = raw.replace(/[^A-Za-z0-9]/g, '');
  const pwd = sanitized.slice(0, length);
  return pwd || 'Staff123';
}
