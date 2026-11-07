import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes, Types } from 'mongoose';
import {
  LoanStatus,
  ReturnCondition,
  ReturnReportedBy,
} from '../enums/loan.enums';

export type LoanDocument = HydratedDocument<Loan>;

@Schema({ _id: false })
export class BookSnapshot {
  @Prop({ required: true })
  title: string;

  @Prop({ type: [String], default: [] })
  authors: string[];

  @Prop()
  isbn?: string;

  @Prop()
  edition?: string;
}
export const BookSnapshotSchema = SchemaFactory.createForClass(BookSnapshot);

@Schema({ _id: false })
export class DamageClaim {
  @Prop({ type: SchemaTypes.ObjectId, required: true })
  filedBy: Types.ObjectId;

  @Prop({ required: true })
  filedAt: Date;

  @Prop({ required: true, enum: ReturnCondition })
  type: ReturnCondition;

  @Prop({ trim: true })
  notes?: string;
}
export const DamageClaimSchema = SchemaFactory.createForClass(DamageClaim);

@Schema({ timestamps: true, collection: 'loans' })
export class Loan {
  @Prop({ type: SchemaTypes.ObjectId, ref: 'Book', required: true })
  bookId: Types.ObjectId;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'BookCopy', required: true })
  copyId: Types.ObjectId;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'User', required: true })
  borrowerId: Types.ObjectId;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'User', required: true })
  issuedById: Types.ObjectId;

  @Prop({ required: true })
  issuedAt: Date;

  @Prop({ required: true })
  dueAt: Date;

  @Prop({ required: true, enum: LoanStatus, default: LoanStatus.ACTIVE })
  status: LoanStatus;

  @Prop()
  returnedAt?: Date;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'User' })
  returnedById?: Types.ObjectId;

  @Prop({ enum: ReturnReportedBy })
  returnReportedBy?: ReturnReportedBy;

  @Prop({ enum: ReturnCondition })
  returnCondition?: ReturnCondition;

  @Prop({ trim: true })
  conditionNotes?: string;

  @Prop({ type: BookSnapshotSchema, required: true })
  bookSnapshot: BookSnapshot;

  @Prop({ type: DamageClaimSchema })
  damageClaim?: DamageClaim;
}

export const LoanSchema = SchemaFactory.createForClass(Loan);

// Hard invariant: at most one ACTIVE loan may reference a given physical copy.
LoanSchema.index(
  { copyId: 1 },
  {
    unique: true,
    partialFilterExpression: { status: LoanStatus.ACTIVE },
  },
);
LoanSchema.index({ borrowerId: 1, status: 1, createdAt: -1 });
LoanSchema.index({ bookId: 1, status: 1 });
LoanSchema.index({ status: 1, dueAt: 1 });
