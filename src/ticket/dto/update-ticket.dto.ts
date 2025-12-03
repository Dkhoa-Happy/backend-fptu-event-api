import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { TicketStatus } from '@prisma/client';

export class UpdateTicketDto {
  @ApiPropertyOptional({
    example: TicketStatus.USED,
    enum: TicketStatus,
    description: 'Ticket status',
  })
  @IsOptional()
  @IsEnum(TicketStatus)
  status?: TicketStatus;
}

