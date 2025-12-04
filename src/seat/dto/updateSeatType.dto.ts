import { IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateSeatTypeDto {
  @ApiProperty({
    description: 'Loại ghế (standard, vip, premium, ...)',
    example: 'vip',
  })
  @IsString()
  seatType: string;
}
