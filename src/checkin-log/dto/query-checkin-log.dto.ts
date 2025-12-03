import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { CheckinResult } from '@prisma/client';

export class QueryCheckinLogDto {
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
    example: CheckinResult.SUCCESS,
    enum: CheckinResult,
    description: 'Filter by check-in result',
  })
  @IsOptional()
  @IsEnum(CheckinResult)
  result?: CheckinResult;

  @ApiPropertyOptional({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'Filter by ticket ID (UUID)',
  })
  @IsOptional()
  @IsString()
  ticketId?: string;

  @ApiPropertyOptional({
    example: 1,
    description: 'Filter by staff ID',
  })
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  staffId?: number;
}

