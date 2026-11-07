import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayNotEmpty,
  IsArray,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateBookDto {
  @ApiProperty({ example: 'Introduction to Algorithms' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  title: string;

  @ApiProperty({ example: ['Cormen', 'Leiserson', 'Rivest', 'Stein'] })
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  authors: string[];

  @ApiPropertyOptional({ example: '9780262033848' })
  @IsOptional()
  @IsString()
  @Matches(/^[0-9Xx-]{10,17}$/, { message: 'isbn must be a valid ISBN-10/13' })
  isbn?: string;

  @ApiPropertyOptional({ example: 'MIT Press' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  publisher?: string;

  @ApiPropertyOptional({ example: '3rd' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  edition?: string;

  @ApiPropertyOptional({ example: 2009 })
  @IsOptional()
  @IsInt()
  @Min(1400)
  @Max(2100)
  publicationYear?: number;

  @ApiPropertyOptional({ example: 'Computer Science' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  category?: string;
}
