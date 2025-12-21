import { ApiProperty } from '@nestjs/swagger';
import { IncidentStatus } from '@prisma/client';
import { IsEnum } from 'class-validator';

export class UpdateIncidentStatusDto {
  @ApiProperty({
    description: 'Trạng thái mới của sự cố',
    enum: IncidentStatus,
    example: IncidentStatus.IN_PROGRESS,
  })
  @IsEnum(IncidentStatus)
  status: IncidentStatus;
}
