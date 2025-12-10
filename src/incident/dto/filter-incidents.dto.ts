import { ApiProperty } from '@nestjs/swagger';
import { IncidentStatus, IncidentSeverity } from '@prisma/client';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { Type } from 'class-transformer';

export class FilterIncidentsDto {
  @ApiProperty({
    description: 'Lọc theo trạng thái sự cố',
    enum: IncidentStatus,
    required: false,
  })
  @IsOptional()
  @IsEnum(IncidentStatus)
  status?: IncidentStatus;

  @ApiProperty({
    description: 'Lọc theo mức độ nghiêm trọng',
    enum: IncidentSeverity,
    required: false,
  })
  @IsOptional()
  @IsEnum(IncidentSeverity)
  severity?: IncidentSeverity;

  @ApiProperty({
    description: 'Lọc theo ID sự kiện',
    required: false,
  })
  @IsOptional()
  @IsUUID('4')
  eventId?: string;

  @ApiProperty({
    description: 'Lọc theo ID người báo cáo',
    required: false,
  })
  @IsOptional()
  @Type(() => Number)
  reporterId?: number;
}

