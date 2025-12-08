import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class CreateEventDto {
  @ApiProperty({ example: 'Tech Conference 2025' })
  @IsString()
  title: string;

  @ApiPropertyOptional({
    example: 'A comprehensive technology conference covering latest trends',
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

  @ApiPropertyOptional({ example: 'https://example.com/banner.jpg' })
  @IsOptional()
  @IsString()
  bannerUrl?: string;

  @ApiProperty({
    example: '2025-12-16T09:00:00Z',
    description: 'Event start time (ISO 8601 format)',
  })
  @IsDateString()
  startTime: string;

  @ApiProperty({
    example: '2025-12-16T17:00:00Z',
    description: 'Event end time (ISO 8601 format)',
  })
  @IsDateString()
  endTime: string;

  @ApiProperty({
    example: '2025-12-13T00:00:00Z',
    description: 'Registration start time (ISO 8601 format)',
  })
  @IsDateString()
  startTimeRegister: string;

  @ApiProperty({
    example: '2025-12-14T23:59:59Z',
    description: 'Registration end time (ISO 8601 format)',
  })
  @IsDateString()
  endTimeRegister: string;

  @ApiProperty({ example: 100, description: 'Maximum capacity of the event' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  maxCapacity: number;

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
}
