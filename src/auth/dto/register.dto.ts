import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEmail,
  IsInt,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export class RegisterDto {
  @ApiProperty({ example: 'newuser' })
  @IsString()
  userName: string;

  @ApiProperty({ example: 'newuser@example.com' })
  @IsEmail({}, { message: 'Email is invalid' })
  email: string;

  @ApiProperty({ minLength: 6, example: 'secret123' })
  @IsString()
  @MinLength(6, { message: 'Password must be at least 6 characters' })
  password: string;

  @ApiPropertyOptional({ example: 'Nguyen' })
  @IsOptional()
  @IsString()
  firstName?: string;

  @ApiPropertyOptional({ example: 'Van A' })
  @IsOptional()
  @IsString()
  lastName?: string;

  @ApiProperty({ example: 1, description: 'Campus id where user belongs to' })
  @IsInt()
  campusId: number;

  @ApiPropertyOptional({ example: 'HE123456' })
  @IsOptional()
  @IsString()
  studentCode?: string;

  @ApiPropertyOptional({ example: '0123456789' })
  @IsOptional()
  @IsString()
  phoneNumber?: string;

  @ApiPropertyOptional({
    example: true,
    description: 'Gender: true = male, false = female',
  })
  @IsOptional()
  @IsBoolean()
  gender?: boolean;

  @ApiPropertyOptional({ example: 'FPT University, Hoa Lac' })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({ example: 'https://example.com/avatar.png' })
  @IsOptional()
  @IsString()
  avatar?: string;
}
