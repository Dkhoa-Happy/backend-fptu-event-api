import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IncidentSeverity } from '@prisma/client';
import { IsEnum, IsOptional, IsString, IsUUID, IsUrl, MaxLength, MinLength } from 'class-validator';

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

  @ApiPropertyOptional({
    description: 'Mô tả chi tiết sự cố',
    example: 'Máy chiếu ở hội trường A không thể kết nối qua HDMI.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @ApiPropertyOptional({
    description: 'URL ảnh minh chứng cho sự cố',
    example: 'https://example.com/incident-image.jpg',
  })
  @IsOptional()
  @IsString()
  @IsUrl({}, { message: 'imageUrl must be a valid URL' })
  imageUrl?: string;

  @ApiPropertyOptional({
    description: 'Mức độ ưu tiên của sự cố',
    enum: IncidentSeverity,
    default: IncidentSeverity.MEDIUM,
  })
  @IsOptional()
  @IsEnum(IncidentSeverity)
  severity?: IncidentSeverity;
}

