import { ApiProperty } from '@nestjs/swagger';
import { IncidentSeverity } from '@prisma/client';
import { IsEnum, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class CreateIncidentDto {
  @ApiProperty({
    description: 'ID của sự kiện (UUID)',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsUUID('4')
  eventId: string;

  @ApiProperty({
    description: 'Tiêu đề ngắn gọn cho sự cố',
    example: 'Máy chiếu không hoạt động',
    minLength: 3,
    maxLength: 120,
  })
  @IsString()
  @MinLength(3)
  @MaxLength(120)
  title: string;

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
    default: IncidentSeverity.MEDIUM,
    required: false,
  })
  @IsOptional()
  @IsEnum(IncidentSeverity)
  severity?: IncidentSeverity;
}

