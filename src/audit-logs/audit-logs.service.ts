import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ClientSession, FilterQuery, Model, Types } from 'mongoose';
import {
  AuditAction,
  AuditActorType,
  AuditEntityType,
} from './enums/audit.enums';
import { AuditLog, AuditLogDocument } from './schemas/audit-log.schema';

export interface AuditChangeInput {
  entityType: AuditEntityType;
  entityId: Types.ObjectId;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
}

export interface AuditEntry {
  actorId: Types.ObjectId | null;
  actorType: AuditActorType;
  action: AuditAction;
  entityType: AuditEntityType;
  entityId: Types.ObjectId;
  changes: AuditChangeInput[];
  reason?: string;
  correlationId: string;
}

export interface AuditSearchQuery {
  entityType?: AuditEntityType;
  entityId?: string;
  actorId?: string;
  action?: AuditAction;
  from?: Date;
  to?: Date;
  page?: number;
  limit?: number;
}

@Injectable()
export class AuditLogsService {
  constructor(
    @InjectModel(AuditLog.name)
    private readonly auditModel: Model<AuditLogDocument>,
  ) {}

  /**
   * Appends one audit record inside the caller's transaction. The business
   * operation and its audit entry therefore commit or roll back together.
   */
  async record(session: ClientSession, entry: AuditEntry): Promise<void> {
    await this.auditModel.create([entry], { session });
  }

  async search(query: AuditSearchQuery) {
    const filter: FilterQuery<AuditLogDocument> = {};
    if (query.action) filter.action = query.action;
    if (query.actorId) filter.actorId = new Types.ObjectId(query.actorId);
    if (query.entityType || query.entityId) {
      // Match either the top-level entity or any correlated change entity.
      const entityMatch: FilterQuery<AuditLogDocument> = {};
      if (query.entityType) entityMatch.entityType = query.entityType;
      if (query.entityId)
        entityMatch.entityId = new Types.ObjectId(query.entityId);
      const changeMatch: FilterQuery<AuditLogDocument> = {};
      if (query.entityType)
        changeMatch['changes.entityType'] = query.entityType;
      if (query.entityId)
        changeMatch['changes.entityId'] = new Types.ObjectId(query.entityId);
      filter.$or = [entityMatch, changeMatch];
    }
    if (query.from || query.to) {
      filter.createdAt = {};
      if (query.from)
        (filter.createdAt as Record<string, Date>).$gte = query.from;
      if (query.to) (filter.createdAt as Record<string, Date>).$lte = query.to;
    }

    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, Math.max(1, query.limit ?? 20));
    const [items, total] = await Promise.all([
      this.auditModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      this.auditModel.countDocuments(filter),
    ]);
    return { items, total, page, limit };
  }

  async findByEntity(entityType: AuditEntityType, entityId: string) {
    const oid = new Types.ObjectId(entityId);
    return this.auditModel
      .find({
        $or: [
          { entityType, entityId: oid },
          { 'changes.entityType': entityType, 'changes.entityId': oid },
        ],
      })
      .sort({ createdAt: -1 })
      .lean();
  }
}
