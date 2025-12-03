import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsOptional,
  IsString,
  IsUrl,
} from 'class-validator';

export class UpdateSpeakerDto {
  @ApiPropertyOptional({ example: 'John Doe' })
  @IsOptional()
  @IsString({ message: 'Name must be a string' })
  name?: string;

  @ApiPropertyOptional({
    example: 'Experienced software engineer with 10+ years in tech industry',
  })
  @IsOptional()
  @IsString({ message: 'Bio must be a string' })
  bio?: string;

  @ApiPropertyOptional({ example: 'https://example.com/avatar.jpg' })
  @IsOptional()
  @IsUrl({}, { message: 'Avatar URL must be a valid URL' })
  avatar?: string;

  @ApiPropertyOptional({
    example: 'external',
    description: "Speaker type: 'internal' or 'external'",
  })
  @IsOptional()
  @IsString({ message: 'Type must be a string' })
  type?: string;

  @ApiPropertyOptional({ example: 'Google' })
  @IsOptional()
  @IsString({ message: 'Company must be a string' })
  company?: string;
}

