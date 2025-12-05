import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService, JwtSignOptions } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as argon2 from 'argon2';
import { UserStatus } from '@prisma/client';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
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
      studentCardImage,
    } = dto;

    // Kiểm tra email domain
    const isFptEmail = email.toLowerCase().endsWith('@fpt.edu.vn');

    // Nếu không phải email FPT, yêu cầu studentCardImage
    if (!isFptEmail && !studentCardImage) {
      throw new BadRequestException(
        'Student card image is required for non-FPT email addresses',
      );
    }

    try {
      const passwordHash = await argon2.hash(password);

      // Xác định status: APPROVED nếu là email FPT, PENDING nếu không
      const status = isFptEmail ? UserStatus.APPROVED : UserStatus.PENDING;

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
          studentCardImage: studentCardImage || null,
          status,
        },
      });

      // Nếu là email FPT, trả về token ngay. Nếu không, thông báo chờ duyệt
      if (isFptEmail) {
        const tokens = await this.getTokens(user.id, user.email, user.roleName);
        await this.updateRefreshToken(user.id, tokens.refreshToken);
        return {
          message: 'Register successfully',
          ...tokens,
        };
      } else {
        return {
          message:
            'Registration submitted successfully. Your account is pending approval. Please wait for admin review.',
          status: 'PENDING',
          userId: user.id,
        };
      }
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

    // Kiểm tra status - chỉ cho phép APPROVED users đăng nhập
    if (user.status !== UserStatus.APPROVED) {
      if (user.status === UserStatus.PENDING) {
        throw new UnauthorizedException(
          'Your account is pending approval. Please wait for admin review.',
        );
      } else if (user.status === UserStatus.REJECTED) {
        throw new UnauthorizedException(
          'Your account has been rejected. Please contact administrator.',
        );
      }
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

    const tokens = await this.getTokens(user.id, user.email, user.roleName);
    await this.updateRefreshToken(user.id, tokens.refreshToken);

    return {
      message: 'Login successfully',
      ...tokens,
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

    // Kiểm tra email domain
    const isFptEmail = email.toLowerCase().endsWith('@fpt.edu.vn');

    // Tìm user theo googleId hoặc email
    let user = await this.prisma.user.findFirst({
      where: {
        OR: [{ googleId }, { email }],
      },
    });

    if (user) {
      // Kiểm tra status - chỉ cho phép APPROVED users đăng nhập
      if (user.status !== UserStatus.APPROVED) {
        if (user.status === UserStatus.PENDING) {
          throw new UnauthorizedException(
            'Your account is pending approval. Please wait for admin review.',
          );
        } else if (user.status === UserStatus.REJECTED) {
          throw new UnauthorizedException(
            'Your account has been rejected. Please contact administrator.',
          );
        }
      }

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

      // Xác định status: APPROVED nếu là email FPT, PENDING nếu không
      const status = isFptEmail ? UserStatus.APPROVED : UserStatus.PENDING;

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
          status,
        },
      });

      // Nếu không phải email FPT, thông báo chờ duyệt
      if (!isFptEmail) {
        throw new UnauthorizedException(
          'Your account has been created but is pending approval. Please wait for admin review.',
        );
      }
    }

    const tokens = await this.getTokens(user.id, user.email, user.roleName);
    await this.updateRefreshToken(user.id, tokens.refreshToken);

    return {
      message: 'Google login successfully',
      ...tokens,
    };
  }

  private async getTokens(userId: number, email: string, roleName: string) {
    const payload = {
      sub: userId,
      email,
      roleName,
      jti: `${userId}-${Date.now()}-${Math.random().toString(36).slice(2, 15)}`,
    };

    const accessExpiresIn = this.config.get<string>('JWT_EXPIRES_IN') ?? '1d';
    const refreshExpiresIn =
      this.config.get<string>('JWT_REFRESH_EXPIRES_IN') ?? '7d';

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        expiresIn: accessExpiresIn as JwtSignOptions['expiresIn'],
      }),
      this.jwtService.signAsync(payload, {
        expiresIn: refreshExpiresIn as JwtSignOptions['expiresIn'],
      }),
    ]);

    return {
      accessToken,
      refreshToken,
    };
  }

  private async updateRefreshToken(userId: number, refreshToken: string) {
    const refreshTokenHash = await argon2.hash(refreshToken);
    await this.prisma.user.update({
      where: { id: userId },
      data: { refreshTokenHash },
    });
  }

  async refreshTokens(refreshToken: string) {
    try {
      const payload = this.jwtService.verify(refreshToken) as {
        sub: number;
        email: string;
        roleName: string;
      };

      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
      });

      if (!user || !user.refreshTokenHash) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      const isValid = await argon2.verify(user.refreshTokenHash, refreshToken);

      if (!isValid) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      // Chỉ cho phép APPROVED user
      if (user.status !== UserStatus.APPROVED) {
        throw new UnauthorizedException('User is not approved');
      }

      const tokens = await this.getTokens(user.id, user.email, user.roleName);
      await this.updateRefreshToken(user.id, tokens.refreshToken);

      return {
        message: 'Refresh token successfully',
        ...tokens,
      };
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  private excludePassword<T extends { passwordHash?: string | null }>(user: T) {
    const { passwordHash: _password, ...rest } = user;
    return rest;
  }
}
