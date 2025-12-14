import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { CancellationRequestStatus } from '@prisma/client';

export class QueryCancellationRequestsDto {
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
    example: CancellationRequestStatus.PENDING,
    enum: CancellationRequestStatus,
    description: 'Filter by cancellation request status',
  })
  @IsOptional()
  @IsEnum(CancellationRequestStatus)
  status?: CancellationRequestStatus;

  @ApiPropertyOptional({
    example: 'event-uuid-here',
    description: 'Filter by event ID',
  })
  @IsOptional()
  @IsString()
  eventId?: string;

  @ApiPropertyOptional({
    example: 1,
    description: 'Filter by requester (organizer owner) ID',
  })
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  requestedBy?: number;
}

