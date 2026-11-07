import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model, Types } from 'mongoose';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import {
  AuditAction,
  AuditActorType,
  AuditEntityType,
} from '../audit-logs/enums/audit.enums';
import { AuthenticatedUser } from '../common/types/authenticated-user';
import { Book, BookDocument } from '../books/schemas/book.schema';
import { BookStatus } from '../books/enums/book-status.enum';
import { withTransaction } from '../database/transaction.util';
import { AddCopiesDto } from './dto/add-copies.dto';
import { UpdateCopyDto } from './dto/update-copy.dto';
import { CopyStatus } from './enums/copy-status.enum';
import { BookCopy, BookCopyDocument } from './schemas/book-copy.schema';

@Injectable()
export class BookCopiesService {
  constructor(
    @InjectModel(BookCopy.name)
    private readonly copyModel: Model<BookCopyDocument>,
    @InjectModel(Book.name) private readonly bookModel: Model<BookDocument>,
    @InjectConnection() private readonly connection: Connection,
    private readonly auditLogs: AuditLogsService,
  ) {}

  async addCopies(
    bookId: string,
    dto: AddCopiesDto,
    actor: AuthenticatedUser,
    correlationId: string,
  ): Promise<BookCopyDocument[]> {
    if (!Types.ObjectId.isValid(bookId)) {
      throw new NotFoundException('Book not found');
    }
    return withTransaction(this.connection, async (session) => {
      const book = await this.bookModel.findById(bookId).session(session);
      if (!book) {
        throw new NotFoundException('Book not found');
      }
      if (book.status === BookStatus.ARCHIVED) {
        throw new ConflictException('Cannot add copies to an archived book');
      }

      const docs = dto.copies.map((c) => ({
        bookId: book._id,
        barcode: c.barcode,
        status: CopyStatus.AVAILABLE,
        location: c.location,
        condition: c.condition,
        acquiredAt: c.acquiredAt ? new Date(c.acquiredAt) : undefined,
      }));
      const created = await this.copyModel.create(docs, {
        session,
        ordered: true,
      });

      await this.auditLogs.record(session, {
        actorId: new Types.ObjectId(actor.id),
        actorType: AuditActorType.USER,
        action: AuditAction.COPY_ADDED,
        entityType: AuditEntityType.BOOK,
        entityId: book._id,
        changes: created.map((copy) => ({
          entityType: AuditEntityType.BOOK_COPY,
          entityId: copy._id,
          after: { barcode: copy.barcode, status: copy.status },
        })),
        correlationId,
      });

      return created;
    });
  }

  async findByBook(bookId: string): Promise<BookCopyDocument[]> {
    if (!Types.ObjectId.isValid(bookId)) {
      throw new NotFoundException('Book not found');
    }
    return this.copyModel.find({ bookId: new Types.ObjectId(bookId) });
  }

  async findOne(id: string): Promise<BookCopyDocument> {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException('Copy not found');
    }
    const copy = await this.copyModel.findById(id);
    if (!copy) {
      throw new NotFoundException('Copy not found');
    }
    return copy;
  }

  async update(
    id: string,
    dto: UpdateCopyDto,
    actor: AuthenticatedUser,
    correlationId: string,
  ): Promise<BookCopyDocument> {
    return withTransaction(this.connection, async (session) => {
      const copy = await this.copyModel.findById(id).session(session);
      if (!copy) {
        throw new NotFoundException('Copy not found');
      }
      const before = { location: copy.location, condition: copy.condition };
      if (dto.location !== undefined) copy.location = dto.location;
      if (dto.condition !== undefined) copy.condition = dto.condition;
      await copy.save({ session });

      await this.auditLogs.record(session, {
        actorId: new Types.ObjectId(actor.id),
        actorType: AuditActorType.USER,
        action: AuditAction.COPY_UPDATED,
        entityType: AuditEntityType.BOOK_COPY,
        entityId: copy._id,
        changes: [
          {
            entityType: AuditEntityType.BOOK_COPY,
            entityId: copy._id,
            before,
            after: { location: copy.location, condition: copy.condition },
          },
        ],
        correlationId,
      });
      return copy;
    });
  }

  async repair(
    id: string,
    actor: AuthenticatedUser,
    correlationId: string,
    reason?: string,
  ): Promise<BookCopyDocument> {
    return withTransaction(this.connection, async (session) => {
      const copy = await this.copyModel.findById(id).session(session);
      if (!copy) {
        throw new NotFoundException('Copy not found');
      }
      if (copy.status !== CopyStatus.DAMAGED) {
        throw new ConflictException('Only a DAMAGED copy can be repaired');
      }
      const book = await this.bookModel.findById(copy.bookId).session(session);
      if (book?.status === BookStatus.ARCHIVED) {
        throw new ConflictException(
          'Parent book is archived; retire the copy instead of repairing it',
        );
      }
      copy.status = CopyStatus.AVAILABLE;
      await copy.save({ session });

      await this.auditLogs.record(session, {
        actorId: new Types.ObjectId(actor.id),
        actorType: AuditActorType.USER,
        action: AuditAction.COPY_REPAIRED,
        entityType: AuditEntityType.BOOK_COPY,
        entityId: copy._id,
        changes: [
          {
            entityType: AuditEntityType.BOOK_COPY,
            entityId: copy._id,
            before: { status: CopyStatus.DAMAGED },
            after: { status: CopyStatus.AVAILABLE },
          },
        ],
        reason,
        correlationId,
      });
      return copy;
    });
  }

  async retire(
    id: string,
    actor: AuthenticatedUser,
    correlationId: string,
    reason?: string,
  ): Promise<BookCopyDocument> {
    return withTransaction(this.connection, async (session) => {
      const copy = await this.copyModel.findById(id).session(session);
      if (!copy) {
        throw new NotFoundException('Copy not found');
      }
      if (copy.status === CopyStatus.ON_LOAN) {
        throw new ConflictException(
          'Cannot retire a copy that is currently on loan',
        );
      }
      if (copy.status === CopyStatus.RETIRED) {
        return copy;
      }
      const before = copy.status;
      copy.status = CopyStatus.RETIRED;
      await copy.save({ session });

      await this.auditLogs.record(session, {
        actorId: new Types.ObjectId(actor.id),
        actorType: AuditActorType.USER,
        action: AuditAction.COPY_RETIRED,
        entityType: AuditEntityType.BOOK_COPY,
        entityId: copy._id,
        changes: [
          {
            entityType: AuditEntityType.BOOK_COPY,
            entityId: copy._id,
            before: { status: before },
            after: { status: CopyStatus.RETIRED },
          },
        ],
        reason,
        correlationId,
      });
      return copy;
    });
  }
}
