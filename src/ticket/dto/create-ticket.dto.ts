import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt } from 'class-validator';

export class CreateTicketDto {
  @ApiProperty({ example: 1, description: 'ID of the user booking the ticket' })
  @Type(() => Number)
  @IsInt()
  userId: number;

  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'ID of the event (UUID)',
  })
  eventId: string;
}

