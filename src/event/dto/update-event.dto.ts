import { ApiPropertyOptional } from '@nestjs/swagger';
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
  startTime?: string;

  @ApiPropertyOptional({
    example: '2025-01-15T17:00:00Z',
    description: 'Event end time (ISO 8601 format)',
  })
  @IsOptional()
  @IsDateString()
  endTime?: string;

  @ApiPropertyOptional({
    example: '2025-01-01T00:00:00Z',
    description: 'Registration start time (ISO 8601 format)',
  })
  @IsOptional()
  @IsDateString()
  startTimeRegister?: string;

  @ApiPropertyOptional({
    example: '2025-01-10T23:59:59Z',
    description: 'Registration end time (ISO 8601 format)',
  })
  @IsOptional()
  @IsDateString()
  endTimeRegister?: string;

  @ApiPropertyOptional({
    example: EventStatus.PUBLISHED,
    enum: EventStatus,
    description: 'Event status',
  })
  @IsOptional()
  @IsEnum(EventStatus)
  status?: EventStatus;

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
    description: 'Whether check-in is allowed for this event',
  })
  @IsOptional()
  @IsBoolean()
  allowCheckIn?: boolean;

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
}

