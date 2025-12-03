import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsOptional,
  IsString,
} from 'class-validator';
import { CheckinResult } from '@prisma/client';

export class UpdateCheckinLogDto {
  @ApiPropertyOptional({
    example: CheckinResult.FAIL,
    enum: CheckinResult,
    description: 'Check-in result',
  })
  @IsOptional()
  @IsEnum(CheckinResult)
  result?: CheckinResult;

  @ApiPropertyOptional({
    example: 'Ticket already used',
    description: 'Reason for failure',
  })
  @IsOptional()
  @IsString()
  message?: string;
}

