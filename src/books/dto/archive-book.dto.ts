import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class ArchiveBookDto {
  @ApiPropertyOptional({ example: 'Superseded by a newer edition' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
