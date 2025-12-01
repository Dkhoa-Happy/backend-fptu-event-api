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

  async register({ email, password, fullName }: RegisterDto) {
    try {
      const passwordHash = await argon2.hash(password);
      const user = await this.prisma.user.create({
        data: { email, password: passwordHash, fullName },
      });

      return {
        message: 'Register successfully',
        accessToken: this.signToken(user.id, user.email),
      };
    } catch (error: unknown) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        (error as { code: string }).code === 'P2002'
      ) {
        throw new ConflictException('Email already in use');
      }
      throw error;
    }
  }

  async login({ email, password }: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    try {
      const isValidPassword = await argon2.verify(user.password, password);
      if (!isValidPassword) {
        throw new UnauthorizedException('Invalid email or password');
      }
    } catch {
      // Trường hợp password trong DB không phải hash Argon2 (user cũ)
      throw new UnauthorizedException('Invalid email or password');
    }

    return {
      message: 'Login successfully',
      accessToken: this.signToken(user.id, user.email),
    };
  }

  private signToken(userId: number, email: string) {
    const payload = {
      sub: userId,
      email,
      jti: `${userId}-${Date.now()}-${Math.random().toString(36).slice(2, 15)}`,
    };
    return this.jwtService.sign(payload);
  }

  private excludePassword<T extends { password?: string }>(user: T) {
    const { password: _password, ...rest } = user;
    return rest;
  }
}
