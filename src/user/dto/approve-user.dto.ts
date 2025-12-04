import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty } from 'class-validator';
import { UserStatus } from '@prisma/client';

export class ApproveUserDto {
  @ApiProperty({
    enum: UserStatus,
    example: 'APPROVED',
    description: 'New status for the user (APPROVED or REJECTED)',
  })
  @IsEnum(UserStatus, {
    message: 'Status must be either APPROVED or REJECTED',
  })
  @IsNotEmpty({ message: 'Status is required' })
  status: UserStatus;
}

