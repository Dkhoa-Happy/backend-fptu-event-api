import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBooleanString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { EventStatus } from '@prisma/client';

export class QueryEventDto {
  @ApiPropertyOptional({ example: 1, default: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number = 1;

  @ApiPropertyOptional({ example: 10, default: 10 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  limit?: number = 10;

  @ApiPropertyOptional({
    example: 'tech conference',
    description: 'Search by title or description',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    example: EventStatus.PUBLISHED,
    enum: EventStatus,
    description: 'Filter by event status',
  })
  @IsOptional()
  @IsEnum(EventStatus)
  status?: EventStatus;

  @ApiPropertyOptional({
    example: 1,
    description: 'Filter by organizer ID',
  })
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  organizerId?: number;

  @ApiPropertyOptional({
    example: 1,
    description: 'Filter by venue ID',
  })
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  venueId?: number;

  @ApiPropertyOptional({
    example: 'Technology',
    description: 'Filter by event category',
  })
  @IsOptional()
  @IsString()
  category?: string;
}
