import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

export class RegisterDto {
  @ApiProperty({ example: 'newuser@example.com' })
  @IsEmail({}, { message: 'Email is invalid' })
  email: string;

  @ApiProperty({ minLength: 6, example: 'secret123' })
  @IsString()
  @MinLength(6, { message: 'Password must be at least 6 characters' })
  password: string;

  @ApiPropertyOptional({ example: 'FPT Student' })
  @IsOptional()
  @IsString()
  fullName?: string;
}
