import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';

export class AssignSpeakerDto {
  @ApiProperty({
    example: 1,
    description: 'ID of the speaker to assign to the event',
  })
  @Type(() => Number)
  @IsInt({ message: 'speakerId must be an integer' })
  @Min(1, { message: 'speakerId must be greater than 0' })
  @IsNotEmpty({ message: 'speakerId is required' })
  speakerId: number;

  @ApiPropertyOptional({
    example: 'Introduction to AI and Machine Learning',
    description: 'Topic or session title for this speaker in this event',
  })
  @IsOptional()
  @IsString({ message: 'Topic must be a string' })
  topic?: string;
}
