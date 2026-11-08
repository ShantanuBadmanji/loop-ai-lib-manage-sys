import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes, Types } from 'mongoose';
import {
  AuditAction,
  AuditActorType,
  AuditEntityType,
} from '../enums/audit.enums';

export type AuditLogDocument = HydratedDocument<AuditLog>;

@Schema({ _id: false })
export class AuditChange {
  @Prop({ required: true, enum: AuditEntityType })
  entityType: AuditEntityType;

  @Prop({ type: SchemaTypes.ObjectId, required: true })
  entityId: Types.ObjectId;

  @Prop({ type: SchemaTypes.Mixed })
  before?: Record<string, unknown>;

  @Prop({ type: SchemaTypes.Mixed })
  after?: Record<string, unknown>;
}
export const AuditChangeSchema = SchemaFactory.createForClass(AuditChange);

@Schema({
  timestamps: { createdAt: true, updatedAt: false },
  collection: 'audit_logs',
})
export class AuditLog {
  @Prop({ type: SchemaTypes.ObjectId, default: null })
  actorId: Types.ObjectId | null;

  @Prop({ required: true, enum: AuditActorType })
  actorType: AuditActorType;

  @Prop({ required: true, enum: AuditAction })
  action: AuditAction;

  @Prop({ required: true, enum: AuditEntityType })
  entityType: AuditEntityType;

  @Prop({ type: SchemaTypes.ObjectId, required: true })
  entityId: Types.ObjectId;

  @Prop({ type: [AuditChangeSchema], default: [] })
  changes: AuditChange[];

  @Prop({ trim: true })
  reason?: string;

  @Prop({ required: true })
  correlationId: string;
}

export const AuditLogSchema = SchemaFactory.createForClass(AuditLog);

AuditLogSchema.index({ entityType: 1, entityId: 1, createdAt: -1 });
AuditLogSchema.index({ action: 1, createdAt: -1 });
AuditLogSchema.index({ actorId: 1, createdAt: -1 });
AuditLogSchema.index({ 'changes.entityType': 1, 'changes.entityId': 1 });
