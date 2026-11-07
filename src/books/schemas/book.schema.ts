import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes, Types } from 'mongoose';
import { BookStatus } from '../enums/book-status.enum';

export type BookDocument = HydratedDocument<Book>;

@Schema({ timestamps: true, collection: 'books' })
export class Book {
  @Prop({ required: true, trim: true })
  title: string;

  @Prop({ type: [String], required: true, default: [] })
  authors: string[];

  @Prop({ trim: true })
  isbn?: string;

  @Prop({ trim: true })
  publisher?: string;

  @Prop({ trim: true })
  edition?: string;

  @Prop()
  publicationYear?: number;

  @Prop({ trim: true })
  category?: string;

  @Prop({ required: true, enum: BookStatus, default: BookStatus.ACTIVE })
  status: BookStatus;

  @Prop({ type: SchemaTypes.ObjectId, required: true })
  createdBy: Types.ObjectId;
}

export const BookSchema = SchemaFactory.createForClass(Book);

// ISBN is unique only when present (records without an ISBN are supported).
BookSchema.index(
  { isbn: 1 },
  {
    unique: true,
    partialFilterExpression: { isbn: { $type: 'string' } },
  },
);
BookSchema.index({ title: 'text', authors: 'text', category: 'text' });
BookSchema.index({ category: 1 });
BookSchema.index({ status: 1 });
