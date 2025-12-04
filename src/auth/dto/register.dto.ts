import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEmail,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export class RegisterDto {
  @ApiProperty({ example: 'newuser' })
  @IsString({ message: 'Username must be a string' })
  @IsNotEmpty({ message: 'Username is required' })
  userName: string;

  @ApiProperty({ example: 'newuser@example.com' })
  @IsEmail({}, { message: 'Email is invalid' })
  @IsNotEmpty({ message: 'Email is required' })
  email: string;

  @ApiProperty({ minLength: 6, example: 'secret123' })
  @IsString({ message: 'Password must be a string' })
  @IsNotEmpty({ message: 'Password is required' })
  @MinLength(6, { message: 'Password must be at least 6 characters' })
  password: string;

  @ApiPropertyOptional({ example: 'Nguyen' })
  @IsOptional()
  @IsString({ message: 'First name must be a string' })
  firstName?: string;

  @ApiPropertyOptional({ example: 'Van A' })
  @IsOptional()
  @IsString({ message: 'Last name must be a string' })
  lastName?: string;

  @ApiProperty({ example: 1, description: 'Campus id where user belongs to' })
  @IsInt({ message: 'CampusId must be an integer' })
  @IsNotEmpty({ message: 'CampusId is required' })
  campusId: number;

  @ApiPropertyOptional({ example: 'HE123456' })
  @IsOptional()
  @IsString({ message: 'Student code must be a string' })
  studentCode?: string;

  @ApiPropertyOptional({ example: '0123456789' })
  @IsOptional()
  @IsString({ message: 'Phone number must be a string' })
  phoneNumber?: string;

  @ApiPropertyOptional({
    example: true,
    description: 'Gender: true = male, false = female',
  })
  @IsOptional()
  @IsBoolean()
  gender?: boolean;

  @ApiPropertyOptional({ example: '342 Nguyen Xuyen, P06, Q9, TpHCM' })
  @IsOptional()
  @IsString({ message: 'Address must be a string' })
  address?: string;

  @ApiPropertyOptional({ example: 'https://example.com/avatar.png' })
  @IsOptional()
  @IsString({ message: 'Avatar URL must be a string' })
  avatar?: string;

  @ApiPropertyOptional({
    example: 'https://example.com/student-card.jpg',
    description:
      'Student card image URL (required for non-FPT email addresses)',
  })
  @IsOptional()
  @IsString({ message: 'Student card image URL must be a string' })
  studentCardImage?: string;
}
