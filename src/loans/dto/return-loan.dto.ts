import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { ReturnCondition } from '../enums/loan.enums';

export class ReturnLoanDto {
  @ApiPropertyOptional({
    enum: ReturnCondition,
    description:
      'Physical condition at return. Honored only for librarian returns; student self-returns are always recorded as GOOD (condition is assessed later by a librarian).',
  })
  @IsOptional()
  @IsEnum(ReturnCondition)
  condition?: ReturnCondition;

  @ApiPropertyOptional({ example: 'Water damage on last 10 pages' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  conditionNotes?: string;
}
