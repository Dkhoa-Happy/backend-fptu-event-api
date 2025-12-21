import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsString } from 'class-validator';

export class ScanTicketDto {
  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'QR code of the ticket to scan',
  })
  @IsString()
  qrCode: string;

  @ApiProperty({
    example: 1,
    description: 'ID of the staff member performing the scan',
  })
  @Type(() => Number)
  @IsInt()
  staffId: number;
}
