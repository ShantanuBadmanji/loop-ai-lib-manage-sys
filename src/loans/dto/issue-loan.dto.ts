import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsMongoId, IsOptional } from 'class-validator';

export class IssueLoanDto {
  @ApiProperty({ description: 'Book catalogue id' })
  @IsMongoId()
  bookId: string;

  @ApiProperty({ description: 'Physical copy id to issue' })
  @IsMongoId()
  copyId: string;

  @ApiPropertyOptional({
    description:
      'Borrower id. Librarians must supply it; students may omit it (defaults to self) and cannot issue to anyone else.',
  })
  @IsOptional()
  @IsMongoId()
  borrowerId?: string;
}
