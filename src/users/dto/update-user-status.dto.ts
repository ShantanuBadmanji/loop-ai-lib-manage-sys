import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateUserStatusDto {
  @ApiProperty({
    example: true,
    description: 'true suspends the user, false reactivates them',
  })
  @IsBoolean()
  suspended: boolean;

  @ApiPropertyOptional({ example: 'Repeated overdue violations' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
