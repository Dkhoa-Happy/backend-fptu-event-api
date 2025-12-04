import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    const {
      email,
      password,
      userName,
      firstName,
      lastName,
      campusId,
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
          email,
          userName,
          passwordHash,
          firstName: firstName ?? '',
          lastName: lastName ?? '',
          roleName: 'student',
          campusId,
          studentCode,
          phoneNumber,
          gender,
          address,
          avatar,
        },
      });

      return {
        message: 'Register successfully',
        accessToken: this.signToken(user.id, user.email, user.roleName),
      };
    } catch (error: unknown) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        (error as { code: string }).code === 'P2002'
      ) {
        // Prisma unique constraint violation (email, userName, studentCode, ...)
        throw new ConflictException(
          'Email, username or student code already in use',
        );
      }
      throw error;
    }
  }

  async login({ email, password }: LoginDto) {
    const user = await this.prisma.user.findUnique({ where: { email } });

    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    // User đăng nhập bằng Google không có passwordHash
    if (!user.passwordHash) {
      throw new UnauthorizedException(
        'This account uses Google login. Please use Google to sign in.',
      );
    }

    try {
      const isValidPassword = await argon2.verify(user.passwordHash, password);
      if (!isValidPassword) {
        throw new UnauthorizedException('Invalid email or password');
      }
    } catch {
      // Trường hợp password trong DB không phải hash Argon2 (user cũ)
      throw new UnauthorizedException('Invalid email or password');
    }

    return {
      message: 'Login successfully',
      accessToken: this.signToken(user.id, user.email, user.roleName),
    };
  }

  async validateGoogleUser(googleUser: {
    googleId: string;
    email: string;
    firstName: string;
    lastName: string;
    avatar: string | null;
  }) {
    const { googleId, email, firstName, lastName, avatar } = googleUser;

    // Tìm user theo googleId hoặc email
    let user = await this.prisma.user.findFirst({
      where: {
        OR: [{ googleId }, { email }],
      },
    });

    if (user) {
      // User đã tồn tại - cập nhật thông tin Google nếu cần
      if (!user.googleId) {
        user = await this.prisma.user.update({
          where: { id: user.id },
          data: {
            googleId,
            avatar: avatar || user.avatar,
            firstName: firstName || user.firstName,
            lastName: lastName || user.lastName,
          },
        });
      } else {
        // Cập nhật avatar nếu có
        if (avatar && avatar !== user.avatar) {
          user = await this.prisma.user.update({
            where: { id: user.id },
            data: { avatar },
          });
        }
      }
    } else {
      // User mới - tạo account mới
      // Lấy campus đầu tiên làm mặc định (hoặc bạn có thể yêu cầu user chọn)
      const defaultCampus = await this.prisma.campus.findFirst({
        where: { status: 'Active' },
        orderBy: { id: 'asc' },
      });

      if (!defaultCampus) {
        throw new UnauthorizedException(
          'No active campus found. Please contact administrator.',
        );
      }

      // Tạo userName từ email (phần trước @)
      const userNameBase = email.split('@')[0];
      let userName = userNameBase;
      let counter = 1;

      // Đảm bảo userName là unique
      while (await this.prisma.user.findUnique({ where: { userName } })) {
        userName = `${userNameBase}${counter}`;
        counter++;
      }

      user = await this.prisma.user.create({
        data: {
          email,
          googleId,
          userName,
          firstName: firstName || '',
          lastName: lastName || '',
          avatar,
          roleName: 'student',
          campusId: defaultCampus.id,
        },
      });
    }

    return {
      message: 'Google login successfully',
      accessToken: this.signToken(user.id, user.email, user.roleName),
    };
  }

  private signToken(userId: number, email: string, roleName: string) {
    const payload = {
      sub: userId,
      email,
      roleName,
      jti: `${userId}-${Date.now()}-${Math.random().toString(36).slice(2, 15)}`,
    };
    return this.jwtService.sign(payload);
  }

  private excludePassword<T extends { passwordHash?: string | null }>(user: T) {
    const { passwordHash: _password, ...rest } = user;
    return rest;
  }
}
