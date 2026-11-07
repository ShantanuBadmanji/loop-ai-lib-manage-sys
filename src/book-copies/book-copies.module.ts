import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { Book, BookSchema } from '../books/schemas/book.schema';
import { BookCopiesController } from './book-copies.controller';
import { BookCopiesService } from './book-copies.service';
import { BookCopy, BookCopySchema } from './schemas/book-copy.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: BookCopy.name, schema: BookCopySchema },
      { name: Book.name, schema: BookSchema },
    ]),
    AuditLogsModule,
  ],
  controllers: [BookCopiesController],
  providers: [BookCopiesService],
  exports: [BookCopiesService],
})
export class BookCopiesModule {}
