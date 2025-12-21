import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsNotEmpty, Min } from 'class-validator';

export class AssignStaffDto {
  @ApiProperty({
    example: 1,
    description: 'ID of the staff user to assign to the event',
  })
  @Type(() => Number)
  @IsInt({ message: 'userId must be an integer' })
  @Min(1, { message: 'userId must be greater than 0' })
  @IsNotEmpty({ message: 'userId is required' })
  userId: number;
}
