import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as argon2 from 'argon2';
import type { Prisma } from '@prisma/client';
import { UserRole, UserStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  ApproveUserDto,
  CreateUserDto,
  QueryUserDto,
  UpdateProfileDto,
  UpdateUserDto,
} from './dto';

@Injectable()
export class UserService {
  constructor(private readonly prisma: PrismaService) {}

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
      throw new NotFoundException('User not found');
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
        },
      });

      return this.excludePassword(user);
    } catch (error: unknown) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        (error as { code: string }).code === 'P2002'
      ) {
        throw new ConflictException(
          'Email, username or student code already in use',
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
          isActive: true,
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

  async getStaffs(query: QueryUserDto) {
    return this.getUsers({
      ...query,
      roleName: UserRole.staff,
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
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async updateUser(id: number, dto: UpdateUserDto) {
    const data: Record<string, unknown> = { ...dto };

    if (dto.password) {
      data.passwordHash = await argon2.hash(dto.password);
      delete data.password;
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
        throw new NotFoundException('User not found');
      }

      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        (error as { code: string }).code === 'P2002'
      ) {
        throw new ConflictException(
          'Email, username or student code already in use',
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
        throw new NotFoundException('User not found');
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
        throw new NotFoundException('User not found');
      }

      if (user.status !== UserStatus.PENDING) {
        throw new ConflictException(
          `User status is ${user.status}, only PENDING users can be approved/rejected`,
        );
      }

      const updatedUser = await this.prisma.user.update({
        where: { id },
        data: {
          status: dto.status,
          // Nếu approve, kích hoạt tài khoản
          isActive: dto.status === UserStatus.APPROVED ? true : user.isActive,
        },
      });

      return {
        message:
          dto.status === UserStatus.APPROVED
            ? 'User approved successfully'
            : 'User rejected successfully',
        user: this.excludePassword(updatedUser),
      };
    } catch (error: unknown) {
      if (error instanceof NotFoundException || error instanceof ConflictException) {
        throw error;
      }

      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        (error as { code: string }).code === 'P2025'
      ) {
        throw new NotFoundException('User not found');
      }

      throw error;
    }
  }

  private excludePassword<T extends { passwordHash?: string | null }>(user: T) {
    const { passwordHash: _password, ...rest } = user;
    return rest;
  }
}
