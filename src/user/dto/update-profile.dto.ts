import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString } from 'class-validator';

// Dùng cho user đang đăng nhập tự cập nhật thông tin của mình
export class UpdateProfileDto {
  @ApiPropertyOptional({ example: 'newusername' })
  @IsOptional()
  @IsString()
  userName?: string;

  @ApiPropertyOptional({ example: 'Nguyen' })
  @IsOptional()
  @IsString()
  firstName?: string;

  @ApiPropertyOptional({ example: 'Van A' })
  @IsOptional()
  @IsString()
  lastName?: string;

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

  @ApiPropertyOptional({ example: 'FPT University - Ho Chi Minh' })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({ example: 'https://example.com/avatar.png' })
  @IsOptional()
  @IsString()
  avatar?: string;
}
