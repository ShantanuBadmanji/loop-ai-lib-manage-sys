import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsISO8601,
  IsMongoId,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { CorrectionType } from '../enums/correction-type.enum';

export class CorrectLoanDto {
  @ApiProperty({ enum: CorrectionType })
  @IsEnum(CorrectionType)
  correctionType: CorrectionType;

  @ApiProperty({
    example: 'Issued to the wrong student due to a barcode scan error',
    description:
      'Required, non-empty justification; preserved in the audit log',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason: string;

  @ApiPropertyOptional({ description: 'Required when correctionType=BORROWER' })
  @IsOptional()
  @IsMongoId()
  newBorrowerId?: string;

  @ApiPropertyOptional({ description: 'Required when correctionType=DUE_DATE' })
  @IsOptional()
  @IsISO8601()
  newDueAt?: string;

  @ApiPropertyOptional({
    description: 'Required when correctionType=ISSUE_DATE',
  })
  @IsOptional()
  @IsISO8601()
  newIssuedAt?: string;
}
