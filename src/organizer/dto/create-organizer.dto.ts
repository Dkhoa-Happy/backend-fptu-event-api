import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
} from 'class-validator';

export class CreateOrganizerDto {
  @ApiProperty({ example: 'FPT Event Club' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ example: 'Official event organizing club of FPT University' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ example: 'contact@fptevent.com' })
  @IsEmail()
  contactEmail: string;

  @ApiProperty({ example: 'https://example.com/logo.png' })
  @IsUrl()
  logoUrl: string;

  @ApiProperty({ example: 1, description: 'ID of the user who owns this organizer' })
  @IsInt()
  ownerId: number;

  @ApiProperty({ example: 1, description: 'ID of the campus this organizer belongs to' })
  @IsInt()
  campusId: number;
}

