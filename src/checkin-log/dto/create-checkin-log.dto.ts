import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
} from 'class-validator';
import { CheckinResult } from '@prisma/client';

export class CreateCheckinLogDto {
  @ApiProperty({
    example: CheckinResult.SUCCESS,
    enum: CheckinResult,
    description: 'Check-in result',
  })
  @IsEnum(CheckinResult)
  result: CheckinResult;

  @ApiPropertyOptional({
    example: 'Ticket invalid',
    description: 'Reason for failure (required if result is FAIL)',
  })
  @IsOptional()
  @IsString()
  message?: string;

  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'ID of the ticket (UUID)',
  })
  @IsString()
  ticketId: string;

  @ApiProperty({
    example: 1,
    description: 'ID of the staff member who performed the check-in',
  })
  @Type(() => Number)
  @IsInt()
  staffId: number;
}

