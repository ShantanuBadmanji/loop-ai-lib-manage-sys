import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class MarkLostDto {
  @ApiPropertyOptional({ example: 'Borrower reported the copy as lost' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
