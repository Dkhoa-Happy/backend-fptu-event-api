import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { IsFutureDate } from './validators/is-future-date.validator';

export class CreateEventSpeakerDto {
  @ApiProperty({ example: 1, description: 'ID của speaker' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  speakerId: number;

  @ApiPropertyOptional({
    example: 'Chủ đề chính của speaker',
    description: 'Topic cho speaker này trong sự kiện',
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  topic?: string;
}

export class CreateEventDto {
  @ApiProperty({ example: 'Tech Conference 2025' })
  @IsString()
  @MinLength(1, { message: 'Title cannot be empty' })
  @MaxLength(200, { message: 'Title must not exceed 200 characters' })
  title: string;

  @ApiPropertyOptional({
    example: 'A comprehensive technology conference covering latest trends',
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000, { message: 'Description must not exceed 2000 characters' })
  description?: string;

  @ApiPropertyOptional({
    example: 'Technology',
    description: 'Category/event category',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100, { message: 'Category must not exceed 100 characters' })
  category?: string;

  @ApiPropertyOptional({ example: 'https://example.com/banner.jpg' })
  @IsOptional()
  @IsUrl({}, { message: 'bannerUrl must be a valid URL' })
  bannerUrl?: string;

  @ApiProperty({
    example: '2025-12-16T09:00:00Z',
    description: 'Event start time (ISO 8601 format)',
  })
  @IsDateString()
  @IsFutureDate({ message: 'Thời gian bắt đầu sự kiện không được là ngày quá khứ' })
  startTime: string;

  @ApiProperty({
    example: '2025-12-16T17:00:00Z',
    description: 'Event end time (ISO 8601 format)',
  })
  @IsDateString()
  @IsFutureDate({ message: 'Thời gian kết thúc sự kiện không được là ngày quá khứ' })
  endTime: string;

  @ApiPropertyOptional({
    example: '2025-12-13T00:00:00Z',
    description:
      'Registration start time (ISO 8601 format). Không bắt buộc nếu sự kiện là online (isOnline = true).',
  })
  @IsOptional()
  @IsDateString()
  @IsFutureDate({ message: 'Thời gian bắt đầu đăng ký không được là ngày quá khứ' })
  startTimeRegister?: string;

  @ApiPropertyOptional({
    example: '2025-12-14T23:59:59Z',
    description:
      'Registration end time (ISO 8601 format). Không bắt buộc nếu sự kiện là online (isOnline = true).',
  })
  @IsOptional()
  @IsDateString()
  @IsFutureDate({ message: 'Thời gian kết thúc đăng ký không được là ngày quá khứ' })
  endTimeRegister?: string;

  @ApiPropertyOptional({
    example: 100,
    description:
      'Maximum capacity of the event. Không bắt buộc nếu sự kiện là online (isOnline = true).',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1, { message: 'Maximum capacity must be at least 1' })
  @Max(10000, { message: 'Maximum capacity cannot exceed 10000' })
  maxCapacity?: number;

  @ApiPropertyOptional({
    example: true,
    default: false,
    description:
      'If true, event is visible to students of all campuses. If false, only students from the event campus can see/register.',
  })
  @IsOptional()
  @IsBoolean()
  isGlobal?: boolean;

  @ApiProperty({ example: 1, description: 'ID of the organizer' })
  @Type(() => Number)
  @IsInt()
  organizerId: number;

  @ApiPropertyOptional({
    example: 1,
    description: 'ID of the venue (optional for online events)',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  venueId?: number;

  @ApiPropertyOptional({
    example: 5,
    description: 'User ID làm host cho sự kiện (mặc định là người tạo)',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  hostId?: number;

  @ApiPropertyOptional({
    type: [Number],
    description: 'Danh sách staffId được gán cho sự kiện ngay khi tạo',
    example: [2, 3, 4],
  })
  @IsOptional()
  @IsArray()
  @ArrayNotEmpty({ message: 'staffIds không được rỗng nếu truyền vào' })
  @Type(() => Number)
  @IsInt({ each: true })
  staffIds?: number[];

  @ApiPropertyOptional({
    type: [CreateEventSpeakerDto],
    description: 'Danh sách speaker (speakerId + topic) gán cho sự kiện khi tạo',
    required: false,
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateEventSpeakerDto)
  speakers?: CreateEventSpeakerDto[];

  @ApiPropertyOptional({
    example: true,
    description:
      'Đánh dấu sự kiện là online. Nếu true, có thể không cần venueId và nên truyền onlineMeetingUrl.',
  })
  @IsOptional()
  @IsBoolean()
  isOnline?: boolean;

  @ApiPropertyOptional({
    example: 'https://meet.google.com/abc-defg-hij',
    description: 'Link Google Meet/Zoom/Teams nếu sự kiện là online',
  })
  @IsOptional()
  @IsUrl()
  onlineMeetingUrl?: string;

  @ApiPropertyOptional({
    example: 'WEEKLY',
    description:
      'Kiểu lặp lại của sự kiện: WEEKLY | MONTHLY | YEARLY. Nếu không truyền thì là sự kiện một lần.',
    enum: ['NONE', 'WEEKLY', 'MONTHLY', 'YEARLY'],
  })
  @IsOptional()
  @IsString()
  recurrenceType?: 'NONE' | 'WEEKLY' | 'MONTHLY' | 'YEARLY';

  @ApiPropertyOptional({
    example: 1,
    description:
      'Khoảng lặp: ví dụ 1 = mỗi tuần/tháng, 2 = 2 tuần 1 lần,... Chỉ dùng khi có recurrenceType.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  recurrenceInterval?: number;

  @ApiPropertyOptional({
    example: '2026-01-01T00:00:00Z',
    description:
      'Ngày kết thúc pattern lặp lại (ISO 8601). Có thể dùng recurrenceEndDate hoặc recurrenceCount.',
  })
  @IsOptional()
  @IsDateString()
  recurrenceEndDate?: string;

  @ApiPropertyOptional({
    example: 10,
    description:
      'Số lần lặp tối đa. Nếu không truyền, có thể dùng recurrenceEndDate để giới hạn.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  recurrenceCount?: number;
}
