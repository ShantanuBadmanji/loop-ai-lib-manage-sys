import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes, Types } from 'mongoose';
import { CopyStatus } from '../enums/copy-status.enum';

export type BookCopyDocument = HydratedDocument<BookCopy>;

@Schema({ timestamps: true, collection: 'book_copies' })
export class BookCopy {
  @Prop({ type: SchemaTypes.ObjectId, ref: 'Book', required: true, index: true })
  bookId: Types.ObjectId;

  @Prop({ required: true, trim: true })
  barcode: string;

  @Prop({ required: true, enum: CopyStatus, default: CopyStatus.AVAILABLE })
  status: CopyStatus;

  @Prop({ trim: true })
  location?: string;

  @Prop({ trim: true })
  condition?: string;

  @Prop()
  acquiredAt?: Date;
}

export const BookCopySchema = SchemaFactory.createForClass(BookCopy);

BookCopySchema.index({ barcode: 1 }, { unique: true });
BookCopySchema.index({ bookId: 1, status: 1 });
