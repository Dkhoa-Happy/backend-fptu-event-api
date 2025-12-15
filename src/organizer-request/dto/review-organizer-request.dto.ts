import { ApiProperty } from '@nestjs/swagger';
import { OrganizerRequestStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class ReviewOrganizerRequestDto {
  @ApiProperty({
    enum: OrganizerRequestStatus,
    description: 'Chỉ chấp nhận APPROVED hoặc REJECTED',
    examples: [OrganizerRequestStatus.APPROVED, OrganizerRequestStatus.REJECTED],
  })
  @IsEnum(OrganizerRequestStatus)
  status: OrganizerRequestStatus;

  @ApiProperty({
    required: false,
    example: 'Hồ sơ chưa đủ minh chứng',
    description: 'Lý do (bắt buộc khi từ chối)',
  })
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason?: string;
}

