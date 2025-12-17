import { IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export enum CampusStatus {
  Active = 'Active',
  Inactive = 'Inactive',
}

export class UpdateCampusStatusDto {
  @ApiProperty({
    description: 'Trạng thái campus (Active hoặc Inactive)',
    enum: CampusStatus,
    example: 'Active',
  })
  @IsEnum(CampusStatus, {
    message: 'Status phải là Active hoặc Inactive',
  })
  status: CampusStatus;
}
