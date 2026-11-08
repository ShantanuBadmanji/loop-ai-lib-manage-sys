import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class DamageClaimDto {
  @ApiPropertyOptional({
    example: 'Cover torn, discovered during post-return inspection',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;

  @ApiPropertyOptional({ example: 'Found damaged within inspection window' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
