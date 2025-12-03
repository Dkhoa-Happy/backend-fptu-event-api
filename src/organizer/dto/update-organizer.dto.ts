import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
} from 'class-validator';

export class UpdateOrganizerDto {
  @ApiPropertyOptional({ example: 'FPT Event Club Updated' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ example: 'Updated description of the organizer' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: 'newcontact@fptevent.com' })
  @IsOptional()
  @IsEmail()
  contactEmail?: string;

  @ApiPropertyOptional({ example: 'https://example.com/new-logo.png' })
  @IsOptional()
  @IsUrl()
  logoUrl?: string;

  @ApiPropertyOptional({ example: 2, description: 'ID of the user who owns this organizer' })
  @IsOptional()
  @IsInt()
  ownerId?: number;

  @ApiPropertyOptional({ example: 2, description: 'ID of the campus this organizer belongs to' })
  @IsOptional()
  @IsInt()
  campusId?: number;
}

