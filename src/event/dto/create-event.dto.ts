import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { EventStatus } from '@prisma/client';

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

  @ApiPropertyOptional({ example: 'https://example.com/banner.jpg' })
  @IsOptional()
  @IsString()
  bannerUrl?: string;

  @ApiProperty({
    example: '2025-01-15T09:00:00Z',
    description: 'Event start time (ISO 8601 format)',
  })
  @IsDateString()
  startTime: string;

  @ApiProperty({
    example: '2025-01-15T17:00:00Z',
    description: 'Event end time (ISO 8601 format)',
  })
  @IsDateString()
  endTime: string;

  @ApiProperty({
    example: '2025-01-01T00:00:00Z',
    description: 'Registration start time (ISO 8601 format)',
  })
  @IsDateString()
  startTimeRegister: string;

  @ApiProperty({
    example: '2025-01-10T23:59:59Z',
    description: 'Registration end time (ISO 8601 format)',
  })
  @IsDateString()
  endTimeRegister: string;

  @ApiPropertyOptional({
    example: EventStatus.DRAFT,
    enum: EventStatus,
    default: EventStatus.DRAFT,
    description: 'Event status',
  })
  @IsOptional()
  @IsEnum(EventStatus)
  status?: EventStatus;

  @ApiProperty({ example: 100, description: 'Maximum capacity of the event' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  maxCapacity: number;

  @ApiPropertyOptional({
    example: false,
    default: false,
    description: 'Whether check-in is allowed for this event',
  })
  @IsOptional()
  @IsBoolean()
  allowCheckIn?: boolean;

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

