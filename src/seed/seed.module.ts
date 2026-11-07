import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import configuration from '../config/configuration';
import { envValidationSchema } from '../config/env.validation';
import {
  BookCopy,
  BookCopySchema,
} from '../book-copies/schemas/book-copy.schema';
import { Book, BookSchema } from '../books/schemas/book.schema';
import { CommonModule } from '../common/common.module';
import { DatabaseModule } from '../database/database.module';
import { User, UserSchema } from '../users/schemas/user.schema';
import { SeedService } from './seed.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validationSchema: envValidationSchema,
    }),
    DatabaseModule,
    CommonModule,
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Book.name, schema: BookSchema },
      { name: BookCopy.name, schema: BookCopySchema },
    ]),
  ],
  providers: [SeedService],
})
export class SeedModule {}
