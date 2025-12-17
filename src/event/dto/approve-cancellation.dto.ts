import { IsEnum, IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { CancellationRequestStatus } from '@prisma/client';

export class ApproveCancellationDto {
  @ApiProperty({
    description: 'Trạng thái phê duyệt (APPROVED hoặc REJECTED)',
    enum: CancellationRequestStatus,
    example: CancellationRequestStatus.APPROVED,
  })
  @IsEnum(CancellationRequestStatus, {
    message: 'Status phải là APPROVED hoặc REJECTED',
  })
  status: CancellationRequestStatus;

  @ApiProperty({
    description: 'Ghi chú từ admin (tùy chọn)',
    example: 'Đã xem xét và chấp thuận yêu cầu hủy sự kiện',
    required: false,
  })
  @IsString()
  @IsOptional()
  adminNote?: string;
}

