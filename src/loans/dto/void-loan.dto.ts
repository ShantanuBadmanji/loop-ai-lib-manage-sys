import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class VoidLoanDto {
  @ApiProperty({
    example: 'Loan created by mistake; copy never physically left the desk',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason: string;
}
