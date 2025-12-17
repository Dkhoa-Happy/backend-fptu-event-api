import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateSeatTypeDto {
  @ApiProperty({
    description: 'Loại ghế (standard, vip, premium, ...)',
    example: 'vip',
  })
  @IsString()
  @IsNotEmpty()
  seatType: string;

  @ApiProperty({
    description: 'Event ID để set seatType cho event cụ thể',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsString()
  @IsNotEmpty()
  eventId: string;
}
