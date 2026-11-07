import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayNotEmpty,
  IsArray,
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';

export class CopyItemDto {
  @ApiProperty({ example: 'BC-000001' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  barcode: string;

  @ApiPropertyOptional({ example: 'Floor 2, Shelf C3' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  location?: string;

  @ApiPropertyOptional({ example: 'New' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  condition?: string;

  @ApiPropertyOptional({ example: '2026-01-15T00:00:00.000Z' })
  @IsOptional()
  @IsISO8601()
  acquiredAt?: string;
}

export class AddCopiesDto {
  @ApiProperty({ type: [CopyItemDto] })
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => CopyItemDto)
  copies: CopyItemDto[];
}
