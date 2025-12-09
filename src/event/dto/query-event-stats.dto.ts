import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Min, Max } from 'class-validator';

export class QueryEventStatsDto {
  @ApiPropertyOptional({
    example: 2024,
    default: new Date().getFullYear(),
    description: 'Năm để thống kê (mặc định là năm hiện tại)',
  })
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(2100)
  @IsOptional()
  year?: number;
}

