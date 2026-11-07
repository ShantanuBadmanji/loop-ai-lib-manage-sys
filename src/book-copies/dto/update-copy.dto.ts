import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateCopyDto {
  @ApiPropertyOptional({ example: 'Floor 3, Shelf A1' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  location?: string;

  @ApiPropertyOptional({ example: 'Worn cover' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  condition?: string;
}

export class CopyReasonDto {
  @ApiPropertyOptional({ example: 'Spine re-glued and pages cleaned' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
