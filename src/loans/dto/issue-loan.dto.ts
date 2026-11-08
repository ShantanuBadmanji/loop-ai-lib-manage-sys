import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsMongoId, IsOptional } from 'class-validator';

export class IssueLoanDto {
  @ApiPropertyOptional({
    description:
      'Book catalogue id. Required when copyId is omitted (the system auto-picks an ' +
      'available copy). When copyId is provided without bookId, the book is derived ' +
      'from the copy.',
  })
  @IsOptional()
  @IsMongoId()
  bookId?: string;

  @ApiPropertyOptional({
    description:
      'Physical copy id to issue. When omitted, the system picks any available ' +
      'copy of the given book — the student does not need to choose a specific ' +
      'copy. Useful for librarians who have a specific copy in hand.',
  })
  @IsOptional()
  @IsMongoId()
  copyId?: string;

  @ApiPropertyOptional({
    description:
      'Borrower id. Librarians must supply it; students may omit it (defaults to self) ' +
      'and cannot issue to anyone else.',
  })
  @IsOptional()
  @IsMongoId()
  borrowerId?: string;
}
