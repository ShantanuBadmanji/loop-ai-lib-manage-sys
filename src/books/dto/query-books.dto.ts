import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { BookStatus } from '../enums/book-status.enum';

export class QueryBooksDto {
  @ApiPropertyOptional({
    description:
      'Full-text search across title, authors, and category using MongoDB $text. ' +
      'Searches whole words and their stems (e.g. "algorithm" matches "algorithms"). ' +
      'Common English stop words (a, the, is, of, …) are ignored by the engine and return no results. ' +
      'For exact phrase matching wrap the term in double quotes: "clean code". ' +
      'Use the separate `author`, `category`, or `isbn` filters for precise field lookups.',
  })
  @IsOptional()
  @IsString()
  q?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  author?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  isbn?: string;

  @ApiPropertyOptional({ enum: BookStatus })
  @IsOptional()
  @IsEnum(BookStatus)
  status?: BookStatus;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
