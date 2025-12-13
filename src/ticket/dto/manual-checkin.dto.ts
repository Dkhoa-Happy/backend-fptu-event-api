import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class ManualCheckinDto {
  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'Ticket ID to check-in (optional if studentCode and eventId are provided)',
    required: false,
  })
  @IsOptional()
  @IsString()
  ticketId?: string;

  @ApiProperty({
    example: 'SE123456',
    description: 'Student code to check-in (required if ticketId is not provided)',
    required: false,
  })
  @IsOptional()
  @IsString()
  studentCode?: string;

  @ApiProperty({
    example: 'ef483e52-e2de-4d84-90c0-845e72788535',
    description: 'Event ID (required if ticketId is not provided)',
    required: false,
  })
  @IsOptional()
  @IsString()
  eventId?: string;

  @ApiProperty({
    example: 1,
    description: 'ID of the staff member performing the check-in',
  })
  @Type(() => Number)
  @IsInt()
  @IsNotEmpty()
  staffId: number;
}

