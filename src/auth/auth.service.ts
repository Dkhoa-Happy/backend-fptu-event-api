import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
  NotFoundException,
} from '@nestjs/common';
import { JwtService, JwtSignOptions } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as argon2 from 'argon2';
import * as crypto from 'crypto';
import { UserStatus } from '@prisma/client';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly emailService: EmailService,
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

    // Validate campusId exists
    const campus = await this.prisma.campus.findUnique({
      where: { id: campusId },
      select: { id: true, name: true },
    });

    if (!campus) {
      throw new BadRequestException(`Không tìm thấy campus với ID ${campusId}`);
    }

    // Bắt buộc cung cấp hình thẻ sinh viên cho mọi tài khoản đăng ký
    if (!studentCardImage) {
      throw new BadRequestException(
        'Ảnh thẻ sinh viên là bắt buộc để đăng ký tài khoản',
      );
    }

    try {
      const passwordHash = await argon2.hash(password);

      // Tất cả user đăng ký đều PENDING để chờ admin duyệt
      const status = UserStatus.PENDING;

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

      // Gửi email thông báo pending
      const fullName = `${firstName ?? ''} ${lastName ?? ''}`.trim();
      await this.emailService.sendUserPendingEmail({
        email,
        fullName: fullName || userName || 'user',
      });

      // Luôn yêu cầu chờ admin duyệt, không cấp token
      return {
        message:
          'Registration submitted successfully. Your account is pending approval. Please wait for admin review.',
        status: 'PENDING',
        userId: user.id,
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
          'Email, username hoặc mã sinh viên đã được sử dụng',
        );
      }
      throw error;
    }
  }

  async login({ email, password }: LoginDto) {
    const user = await this.prisma.user.findUnique({ where: { email } });

    if (!user) {
      throw new UnauthorizedException('Email hoặc mật khẩu không đúng');
    }

    // Kiểm tra status - chỉ cho phép APPROVED users đăng nhập
    if (user.status !== UserStatus.APPROVED) {
      if (user.status === UserStatus.PENDING) {
        throw new UnauthorizedException(
          'Tài khoản của bạn đang chờ phê duyệt. Vui lòng đợi admin xem xét.',
        );
      } else if (user.status === UserStatus.REJECTED) {
        throw new UnauthorizedException(
          'Tài khoản của bạn đã bị từ chối. Vui lòng liên hệ quản trị viên.',
        );
      }
    }

    // User đăng nhập bằng Google không có passwordHash
    if (!user.passwordHash) {
      throw new UnauthorizedException(
        'Tài khoản này sử dụng đăng nhập Google. Vui lòng sử dụng Google để đăng nhập.',
      );
    }

    try {
      const isValidPassword = await argon2.verify(user.passwordHash, password);
      if (!isValidPassword) {
        throw new UnauthorizedException('Email hoặc mật khẩu không đúng');
      }
    } catch {
      // Trường hợp password trong DB không phải hash Argon2 (user cũ)
      throw new UnauthorizedException('Email hoặc mật khẩu không đúng');
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
          'Không tìm thấy campus đang hoạt động. Vui lòng liên hệ quản trị viên.',
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

      // Tất cả user mới đều PENDING, chờ admin duyệt
      const status = UserStatus.PENDING;

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

      // Thông báo chờ duyệt cho tất cả tài khoản mới
      const fullName = `${firstName || ''} ${lastName || ''}`.trim();
      await this.emailService.sendUserPendingEmail({
        email,
        fullName: fullName || userName || 'user',
      });

      throw new UnauthorizedException(
        'Tài khoản của bạn đã được tạo nhưng đang chờ phê duyệt. Vui lòng đợi admin xem xét.',
      );
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
        throw new UnauthorizedException('Refresh token không hợp lệ');
      }

      const isValid = await argon2.verify(user.refreshTokenHash, refreshToken);

      if (!isValid) {
        throw new UnauthorizedException('Refresh token không hợp lệ');
      }

      // Chỉ cho phép APPROVED user
      if (user.status !== UserStatus.APPROVED) {
        throw new UnauthorizedException('User chưa được phê duyệt');
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

  async changePassword(userId: number, dto: ChangePasswordDto) {
    const { currentPassword, newPassword } = dto;

    // Validate userId
    if (!userId || typeof userId !== 'number') {
      throw new UnauthorizedException('User ID is required');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        passwordHash: true,
        email: true,
        firstName: true,
        lastName: true,
        userName: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Kiểm tra user có passwordHash không (không phải Google login)
    if (!user.passwordHash) {
      throw new BadRequestException(
        'Tài khoản này sử dụng đăng nhập Google. Không thể đổi mật khẩu.',
      );
    }

    // Xác thực mật khẩu hiện tại
    try {
      const isValidPassword = await argon2.verify(
        user.passwordHash,
        currentPassword,
      );
      if (!isValidPassword) {
        throw new UnauthorizedException('Mật khẩu hiện tại không đúng');
      }
    } catch {
      throw new UnauthorizedException('Mật khẩu hiện tại không đúng');
    }

    // Kiểm tra mật khẩu mới khác mật khẩu cũ
    const isSamePassword = await argon2.verify(
      user.passwordHash,
      newPassword,
    );
    if (isSamePassword) {
      throw new BadRequestException(
        'Mật khẩu mới phải khác mật khẩu hiện tại',
      );
    }

    // Cập nhật mật khẩu mới
    const newPasswordHash = await argon2.hash(newPassword);
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: newPasswordHash },
    });

    return {
      message: 'Đổi mật khẩu thành công',
    };
  }

  async forgotPassword(dto: ForgotPasswordDto) {
    const { email } = dto;

    const user = await this.prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        userName: true,
        passwordHash: true,
        status: true,
      },
    });

    // Không tiết lộ thông tin nếu email không tồn tại (security best practice)
    if (!user) {
      return {
        message:
          'Nếu email tồn tại trong hệ thống, bạn sẽ nhận được mã OTP để đặt lại mật khẩu.',
      };
    }

    // Kiểm tra user có passwordHash không (không phải Google login)
    if (!user.passwordHash) {
      return {
        message:
          'Nếu email tồn tại trong hệ thống, bạn sẽ nhận được mã OTP để đặt lại mật khẩu.',
      };
    }

    // Chỉ cho phép user đã được APPROVED
    if (user.status !== UserStatus.APPROVED) {
      return {
        message:
          'Nếu email tồn tại trong hệ thống, bạn sẽ nhận được mã OTP để đặt lại mật khẩu.',
      };
    }

    // Tạo OTP 6 chữ số
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpHash = await argon2.hash(otp);
    const otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 phút

    // Lưu OTP vào database
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetOtp: otpHash,
        passwordResetOtpExpires: otpExpires,
      },
    });

    // Gửi email với OTP
    const fullName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.userName;
    await this.emailService.sendPasswordResetOtp({
      email: user.email,
      fullName,
      otp,
    });

    return {
      message:
        'Nếu email tồn tại trong hệ thống, bạn sẽ nhận được mã OTP để đặt lại mật khẩu.',
    };
  }

  async verifyOtp(dto: VerifyOtpDto) {
    const { email, otp } = dto;

    const user = await this.prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        passwordResetOtp: true,
        passwordResetOtpExpires: true,
        status: true,
      },
    });

    if (!user) {
      throw new BadRequestException('Email hoặc OTP không hợp lệ.');
    }

    // Kiểm tra user status
    if (user.status !== UserStatus.APPROVED) {
      throw new BadRequestException(
        'Tài khoản chưa được phê duyệt. Không thể đặt lại mật khẩu.',
      );
    }

    // Kiểm tra OTP có tồn tại và chưa hết hạn
    if (!user.passwordResetOtp || !user.passwordResetOtpExpires) {
      throw new BadRequestException('OTP không hợp lệ hoặc đã hết hạn. Vui lòng yêu cầu OTP mới.');
    }

    if (user.passwordResetOtpExpires < new Date()) {
      throw new BadRequestException('OTP đã hết hạn. Vui lòng yêu cầu OTP mới.');
    }

    // Verify OTP
    try {
      const isValid = await argon2.verify(user.passwordResetOtp, otp);
      if (!isValid) {
        throw new BadRequestException('OTP không đúng. Vui lòng kiểm tra lại.');
      }
    } catch {
      throw new BadRequestException('OTP không đúng. Vui lòng kiểm tra lại.');
    }

    return {
      message: 'OTP hợp lệ. Bạn có thể đặt lại mật khẩu.',
      verified: true,
    };
  }

  async resetPassword(dto: ResetPasswordDto) {
    const { email, otp, newPassword } = dto;

    const user = await this.prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        passwordResetOtp: true,
        passwordResetOtpExpires: true,
        status: true,
      },
    });

    if (!user) {
      throw new BadRequestException('Email hoặc OTP không hợp lệ.');
    }

    // Kiểm tra user status
    if (user.status !== UserStatus.APPROVED) {
      throw new BadRequestException(
        'Tài khoản chưa được phê duyệt. Không thể đặt lại mật khẩu.',
      );
    }

    // Kiểm tra OTP có tồn tại và chưa hết hạn
    if (!user.passwordResetOtp || !user.passwordResetOtpExpires) {
      throw new BadRequestException('OTP không hợp lệ hoặc đã hết hạn. Vui lòng yêu cầu OTP mới.');
    }

    if (user.passwordResetOtpExpires < new Date()) {
      throw new BadRequestException('OTP đã hết hạn. Vui lòng yêu cầu OTP mới.');
    }

    // Verify OTP
    try {
      const isValid = await argon2.verify(user.passwordResetOtp, otp);
      if (!isValid) {
        throw new BadRequestException('OTP không đúng. Vui lòng kiểm tra lại.');
      }
    } catch {
      throw new BadRequestException('OTP không đúng. Vui lòng kiểm tra lại.');
    }

    // Cập nhật mật khẩu mới và xóa OTP
    const newPasswordHash = await argon2.hash(newPassword);
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: newPasswordHash,
        passwordResetOtp: null,
        passwordResetOtpExpires: null,
      },
    });

    return {
      message: 'Đặt lại mật khẩu thành công. Bạn có thể đăng nhập với mật khẩu mới.',
    };
  }
}
