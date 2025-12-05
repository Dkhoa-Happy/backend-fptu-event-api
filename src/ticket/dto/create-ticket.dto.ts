import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsUUID } from 'class-validator';

export class CreateTicketDto {
  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'ID of the event (UUID)',
  })
  @IsUUID('4', { message: 'eventId must be a valid UUID v4' })
  @IsNotEmpty({ message: 'eventId is required' })
  eventId: string;

  @ApiProperty({ example: '1', description: 'ID của ghế được chọn' })
  @IsNotEmpty({ message: 'Chọn ghế là bắt buộc' })
  seatId: number;
}
