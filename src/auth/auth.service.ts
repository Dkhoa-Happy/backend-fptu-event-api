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

  private signToken(userId: number, email: string, roleName: string) {
    const payload = {
      sub: userId,
      email,
      roleName,
      jti: `${userId}-${Date.now()}-${Math.random().toString(36).slice(2, 15)}`,
    };
    return this.jwtService.sign(payload);
  }

  private excludePassword<T extends { passwordHash?: string }>(user: T) {
    const { passwordHash: _password, ...rest } = user;
    return rest;
  }
}
