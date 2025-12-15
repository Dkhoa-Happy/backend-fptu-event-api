import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as argon2 from 'argon2';
import type { Prisma } from '@prisma/client';
import { UserRole, UserStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import {
  ApproveUserDto,
  CreateUserDto,
  QueryUserDto,
  QueryStaffDto,
  UpdateProfileDto,
  UpdateUserDto,
} from './dto';

@Injectable()
export class UserService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
  ) {}

  async getMe(userId: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        userName: true,
        email: true,
        firstName: true,
        lastName: true,
        avatar: true,
        phoneNumber: true,
        gender: true,
        address: true,
        roleName: true,
        isActive: true,
        createdAt: true,
        campus: {
          select: {
            id: true,
            name: true,
            code: true,
            address: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('Không tìm thấy user');
    }

    return {
      ...user,
    };
  }

  async createUser(dto: CreateUserDto) {
    const {
      password,
      userName,
      email,
      campusId,
      roleName,
      firstName,
      lastName,
      studentCode,
      phoneNumber,
      gender,
      address,
      avatar,
    } = dto;

    try {
      const passwordHash = await argon2.hash(password);

      // Tài khoản tạo qua API này luôn được APPROVED (admin/organizer tạo cho staff)
      const status = UserStatus.APPROVED;

      const user = await this.prisma.user.create({
        data: {
          userName,
          email,
          campusId,
          roleName,
          passwordHash,
          firstName: firstName ?? '',
          lastName: lastName ?? '',
          studentCode,
          phoneNumber,
          gender,
          address,
          avatar,
          status,
          isActive: true, // APPROVED users luôn active
        },
      });

      // Gửi email thông tin tài khoản cho mọi user khi được tạo bởi admin/organizer
      if (password) {
        this.emailService
          .sendAccountCreatedEmail({
            email: user.email,
            password: password, // Gửi password gốc trước khi hash
            roleName: roleName,
            fullName:
              `${user.firstName} ${user.lastName}`.trim() || user.userName,
          })
          .catch((error) => {
            console.error(
              `Failed to send account email to ${user.email}:`,
              error,
            );
          });
      }

      return this.excludePassword(user);
    } catch (error: unknown) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        (error as { code: string }).code === 'P2002'
      ) {
        throw new ConflictException(
          'Email, username hoặc mã sinh viên đã được sử dụng',
        );
      }
      throw error;
    }
  }

  async getUsers(query: QueryUserDto) {
    const {
      page = 1,
      limit = 10,
      search,
      roleName,
      isActive,
      campusId,
    } = query;

    const where: Prisma.UserWhereInput = {};

    if (search) {
      where.OR = [
        { userName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (roleName) {
      where.roleName = roleName;
    }

    if (typeof isActive === 'string') {
      where.isActive = isActive === 'true';
    }

    if (typeof campusId === 'number') {
      where.campusId = campusId;
    }

    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          userName: true,
          email: true,
          firstName: true,
          lastName: true,
          avatar: true,
          phoneNumber: true,
          gender: true,
          address: true,
          roleName: true,
          status: true,
          isActive: true,
          studentCardImage: true,
          createdAt: true,
          campus: {
            select: {
              id: true,
              name: true,
              code: true,
            },
          },
        },
      }),
      this.prisma.user.count({ where }),
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

  async getStaffs(query: QueryStaffDto) {
    // API này chỉ lấy staff, không cần filter roleName
    return this.getUsers({
      ...query,
      roleName: UserRole.staff, // Force roleName = staff
    });
  }

  async getById(id: number) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        userName: true,
        email: true,
        firstName: true,
        lastName: true,
        avatar: true,
        studentCardImage: true,
        phoneNumber: true,
        gender: true,
        address: true,
        roleName: true,
        isActive: true,
        createdAt: true,
        campus: {
          select: {
            id: true,
            name: true,
            code: true,
            address: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('Không tìm thấy user');
    }

    return user;
  }

  async updateUser(id: number, dto: UpdateUserDto) {
    const data: Record<string, unknown> = { ...dto };

    if (dto.password) {
      data.passwordHash = await argon2.hash(dto.password);
      delete data.password;
    }

    // Đảm bảo nếu status = PENDING thì isActive = false
    // (status có thể được truyền vào data object nếu cần)
    if (data.status === UserStatus.PENDING) {
      data.isActive = false;
    }

    try {
      const user = await this.prisma.user.update({
        where: { id },
        data,
      });

      return this.excludePassword(user);
    } catch (error: unknown) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        (error as { code: string }).code === 'P2025'
      ) {
        throw new NotFoundException('Không tìm thấy user');
      }

      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        (error as { code: string }).code === 'P2002'
      ) {
        throw new ConflictException(
          'Email, username hoặc mã sinh viên đã được sử dụng',
        );
      }

      throw error;
    }
  }

  async deactivateUser(id: number) {
    try {
      const user = await this.prisma.user.update({
        where: { id },
        data: { isActive: false },
      });

      return this.excludePassword(user);
    } catch (error: unknown) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        (error as { code: string }).code === 'P2025'
      ) {
        throw new NotFoundException('Không tìm thấy user');
      }

      throw error;
    }
  }

  async activateUser(id: number) {
    try {
      const user = await this.prisma.user.update({
        where: { id },
        data: { isActive: true },
      });

      return this.excludePassword(user);
    } catch (error: unknown) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        (error as { code: string }).code === 'P2025'
      ) {
        throw new NotFoundException('Không tìm thấy user');
      }

      throw error;
    }
  }

  async updateMe(userId: number, dto: UpdateProfileDto) {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        userName: dto.userName,
        firstName: dto.firstName,
        lastName: dto.lastName,
        phoneNumber: dto.phoneNumber,
        gender: dto.gender,
        address: dto.address,
        avatar: dto.avatar,
      },
    });

    return this.excludePassword(user);
  }

  async getPendingUsers(query: QueryUserDto) {
    const { page = 1, limit = 10, search, campusId } = query;

    const where: Prisma.UserWhereInput = {
      status: UserStatus.PENDING,
    };

    if (search) {
      where.OR = [
        { userName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { studentCode: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (typeof campusId === 'number') {
      where.campusId = campusId;
    }

    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          userName: true,
          email: true,
          firstName: true,
          lastName: true,
          avatar: true,
          phoneNumber: true,
          gender: true,
          address: true,
          studentCode: true,
          studentCardImage: true,
          status: true,
          roleName: true,
          isActive: true,
          createdAt: true,
          campus: {
            select: {
              id: true,
              name: true,
              code: true,
              address: true,
            },
          },
        },
      }),
      this.prisma.user.count({ where }),
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

  async approveUser(id: number, dto: ApproveUserDto) {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id },
      });

      if (!user) {
        throw new NotFoundException('Không tìm thấy user');
      }

      if (user.status !== UserStatus.PENDING) {
        throw new ConflictException(
          `Trạng thái user là ${user.status}, chỉ user PENDING mới có thể được phê duyệt/từ chối`,
        );
      }

      const reason = dto.reason?.trim();
      if (dto.status === UserStatus.REJECTED && !reason) {
        throw new ConflictException(
          'Lý do là bắt buộc khi từ chối tài khoản user',
        );
      }

      const updatedUser = await this.prisma.user.update({
        where: { id },
        data: {
          status: dto.status,
          // Nếu approve, kích hoạt tài khoản; nếu pending, deactivate
          isActive:
            dto.status === UserStatus.APPROVED
              ? true
              : dto.status === UserStatus.PENDING
                ? false
                : user.isActive,
        },
      });

      // Send notification email (best-effort, non-blocking errors propagate)
      const fullName = `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim();
      await this.emailService.sendUserApprovalEmail({
        email: user.email,
        fullName: fullName || user.userName || 'user',
        status: dto.status,
        reason,
      });

      return {
        message:
          dto.status === UserStatus.APPROVED
            ? 'User approved successfully'
            : 'User rejected successfully',
        ...(reason ? { reason } : {}),
        user: this.excludePassword(updatedUser),
      };
    } catch (error: unknown) {
      if (
        error instanceof NotFoundException ||
        error instanceof ConflictException
      ) {
        throw error;
      }

      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        (error as { code: string }).code === 'P2025'
      ) {
        throw new NotFoundException('Không tìm thấy user');
      }

      throw error;
    }
  }

  private excludePassword<T extends { passwordHash?: string | null }>(user: T) {
    const { passwordHash: _password, ...rest } = user;
    return rest;
  }
}
