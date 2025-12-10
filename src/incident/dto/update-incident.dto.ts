import { ApiProperty } from '@nestjs/swagger';
import { IncidentSeverity, IncidentStatus } from '@prisma/client';
import {
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class UpdateIncidentDto {
  @ApiProperty({
    description: 'Tiêu đề sự cố',
    example: 'Máy chiếu không hoạt động',
    minLength: 3,
    maxLength: 120,
    required: false,
  })
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(120)
  title?: string;

  @ApiProperty({
    description: 'Mô tả chi tiết sự cố',
    example: 'Máy chiếu ở hội trường A không thể kết nối qua HDMI.',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @ApiProperty({
    description: 'Mức độ ưu tiên của sự cố',
    enum: IncidentSeverity,
    required: false,
  })
  @IsOptional()
  @IsEnum(IncidentSeverity)
  severity?: IncidentSeverity;

  @ApiProperty({
    description: 'Trạng thái sự cố',
    enum: IncidentStatus,
    required: false,
  })
  @IsOptional()
  @IsEnum(IncidentStatus)
  status?: IncidentStatus;
}

