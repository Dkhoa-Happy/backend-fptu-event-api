import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { IsFutureDate } from './validators/is-future-date.validator';
import { CreateEventSpeakerDto } from './create-event.dto';

export class UpdateEventDto {
  @ApiPropertyOptional({ example: 'Tech Conference 2025 Updated' })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({
    example: 'Updated description of the event',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    example: 'Technology',
    description: 'Category/event category',
  })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({ example: 'https://example.com/new-banner.jpg' })
  @IsOptional()
  @IsString()
  bannerUrl?: string;

  @ApiPropertyOptional({
    example: '2025-01-15T09:00:00Z',
    description: 'Event start time (ISO 8601 format)',
  })
  @IsOptional()
  @IsDateString()
  @IsFutureDate({
    message: 'Thời gian bắt đầu sự kiện không được là ngày quá khứ',
  })
  startTime?: string;

  @ApiPropertyOptional({
    example: '2025-01-15T17:00:00Z',
    description: 'Event end time (ISO 8601 format)',
  })
  @IsOptional()
  @IsDateString()
  @IsFutureDate({
    message: 'Thời gian kết thúc sự kiện không được là ngày quá khứ',
  })
  endTime?: string;

  @ApiPropertyOptional({
    example: '2025-01-01T00:00:00Z',
    description: 'Registration start time (ISO 8601 format)',
  })
  @IsOptional()
  @IsDateString()
  @IsFutureDate({
    message: 'Thời gian bắt đầu đăng ký không được là ngày quá khứ',
  })
  startTimeRegister?: string;

  @ApiPropertyOptional({
    example: '2025-01-10T23:59:59Z',
    description: 'Registration end time (ISO 8601 format)',
  })
  @IsOptional()
  @IsDateString()
  @IsFutureDate({
    message: 'Thời gian kết thúc đăng ký không được là ngày quá khứ',
  })
  endTimeRegister?: string;

  @ApiPropertyOptional({
    example: 150,
    description: 'Maximum capacity of the event',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  maxCapacity?: number;

  @ApiPropertyOptional({
    example: true,
    description:
      'If true, event is visible to students of all campuses. If false, only students from the event campus can see/register.',
  })
  @IsOptional()
  @IsBoolean()
  isGlobal?: boolean;

  @ApiPropertyOptional({
    example: 2,
    description: 'ID of the organizer',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  organizerId?: number;

  @ApiPropertyOptional({
    example: 2,
    description: 'ID of the venue (optional for online events)',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  venueId?: number;

  @ApiPropertyOptional({
    example: [1, 2, 3],
    description: 'Array of staff user IDs to assign to the event',
    type: [Number],
  })
  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  @Type(() => Number)
  staffIds?: number[];

  @ApiPropertyOptional({
    type: [CreateEventSpeakerDto],
    description:
      'Danh sách speaker (speakerId + topic) gán cho sự kiện khi cập nhật',
    required: false,
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateEventSpeakerDto)
  speakers?: CreateEventSpeakerDto[];
}
