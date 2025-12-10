import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { UserStatus } from '@prisma/client';

export class ApproveUserDto {
  @ApiProperty({
    enum: UserStatus,
    example: 'APPROVED',
    description:
      'Trạng thái mới: APPROVED hoặc REJECTED (REJECTED phải kèm reason)',
  })
  @IsEnum(UserStatus, {
    message: 'Status must be either APPROVED or REJECTED',
  })
  @IsNotEmpty({ message: 'Status is required' })
  status: UserStatus;

  @ApiPropertyOptional({
    example: 'Ảnh thẻ sinh viên không hợp lệ',
    description: 'Lý do từ chối (bắt buộc khi status = REJECTED)',
    maxLength: 500,
    required: false,
  })
  @ValidateIf((o) => o.status === UserStatus.REJECTED)
  @IsString()
  @MinLength(3, { message: 'Reason must be at least 3 characters' })
  @MaxLength(500, { message: 'Reason must not exceed 500 characters' })
  @IsOptional()
  reason?: string;
}
