import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, FilterQuery, Model, Types } from 'mongoose';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import {
  AuditAction,
  AuditActorType,
  AuditEntityType,
} from '../audit-logs/enums/audit.enums';
import { AuthenticatedUser } from '../common/types/authenticated-user';
import {
  BookCopy,
  BookCopyDocument,
} from '../book-copies/schemas/book-copy.schema';
import { CopyStatus } from '../book-copies/enums/copy-status.enum';
import { withTransaction } from '../database/transaction.util';
import { Loan, LoanDocument } from '../loans/schemas/loan.schema';
import { LoanStatus } from '../loans/enums/loan.enums';
import { CreateBookDto } from './dto/create-book.dto';
import { QueryBooksDto } from './dto/query-books.dto';
import { UpdateBookDto } from './dto/update-book.dto';
import { BookStatus } from './enums/book-status.enum';
import { Book, BookDocument } from './schemas/book.schema';

export interface BookAvailability {
  bookId: string;
  totalCopies: number;
  available: number;
  onLoan: number;
  damaged: number;
  lost: number;
  retired: number;
  earliestExpectedReturn: Date | null;
}

@Injectable()
export class BooksService {
  constructor(
    @InjectModel(Book.name) private readonly bookModel: Model<BookDocument>,
    @InjectModel(BookCopy.name)
    private readonly copyModel: Model<BookCopyDocument>,
    @InjectModel(Loan.name) private readonly loanModel: Model<LoanDocument>,
    @InjectConnection() private readonly connection: Connection,
    private readonly auditLogs: AuditLogsService,
  ) {}

  async create(
    dto: CreateBookDto,
    actor: AuthenticatedUser,
    correlationId: string,
  ): Promise<BookDocument> {
    return withTransaction(this.connection, async (session) => {
      const [book] = await this.bookModel.create(
        [{ ...dto, createdBy: new Types.ObjectId(actor.id) }],
        { session },
      );
      await this.auditLogs.record(session, {
        actorId: new Types.ObjectId(actor.id),
        actorType: AuditActorType.USER,
        action: AuditAction.BOOK_CREATED,
        entityType: AuditEntityType.BOOK,
        entityId: book._id,
        changes: [
          {
            entityType: AuditEntityType.BOOK,
            entityId: book._id,
            after: { title: book.title, isbn: book.isbn, status: book.status },
          },
        ],
        correlationId,
      });
      return book;
    });
  }

  async update(
    id: string,
    dto: UpdateBookDto,
    actor: AuthenticatedUser,
    correlationId: string,
  ): Promise<BookDocument> {
    return withTransaction(this.connection, async (session) => {
      const book = await this.bookModel.findById(id).session(session);
      if (!book) {
        throw new NotFoundException('Book not found');
      }
      const before = this.pickBookFields(
        book.toObject() as unknown as Record<string, unknown>,
      );
      Object.assign(book, dto);
      await book.save({ session });
      await this.auditLogs.record(session, {
        actorId: new Types.ObjectId(actor.id),
        actorType: AuditActorType.USER,
        action: AuditAction.BOOK_UPDATED,
        entityType: AuditEntityType.BOOK,
        entityId: book._id,
        changes: [
          {
            entityType: AuditEntityType.BOOK,
            entityId: book._id,
            before,
            after: this.pickBookFields(
              book.toObject() as unknown as Record<string, unknown>,
            ),
          },
        ],
        correlationId,
      });
      return book;
    });
  }

  async archive(
    id: string,
    actor: AuthenticatedUser,
    correlationId: string,
    reason?: string,
  ): Promise<BookDocument> {
    return withTransaction(this.connection, async (session) => {
      const book = await this.bookModel.findById(id).session(session);
      if (!book) {
        throw new NotFoundException('Book not found');
      }
      if (book.status === BookStatus.ARCHIVED) {
        return book;
      }
      book.status = BookStatus.ARCHIVED;
      await book.save({ session });
      await this.auditLogs.record(session, {
        actorId: new Types.ObjectId(actor.id),
        actorType: AuditActorType.USER,
        action: AuditAction.BOOK_ARCHIVED,
        entityType: AuditEntityType.BOOK,
        entityId: book._id,
        changes: [
          {
            entityType: AuditEntityType.BOOK,
            entityId: book._id,
            before: { status: BookStatus.ACTIVE },
            after: { status: BookStatus.ARCHIVED },
          },
        ],
        reason,
        correlationId,
      });
      return book;
    });
  }

  async findOne(id: string): Promise<BookDocument> {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException('Book not found');
    }
    const book = await this.bookModel.findById(id);
    if (!book) {
      throw new NotFoundException('Book not found');
    }
    return book;
  }

  async search(query: QueryBooksDto) {
    const filter: FilterQuery<BookDocument> = {};
    if (query.q) filter.$text = { $search: query.q };
    if (query.category) filter.category = query.category;
    if (query.author) filter.authors = { $regex: query.author, $options: 'i' };
    if (query.isbn) filter.isbn = query.isbn;
    if (query.status) filter.status = query.status;

    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, Math.max(1, query.limit ?? 20));
    const [items, total] = await Promise.all([
      this.bookModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      this.bookModel.countDocuments(filter),
    ]);
    return { items, total, page, limit };
  }

  async availability(id: string): Promise<BookAvailability> {
    const book = await this.findOne(id);
    const bookId = book._id;

    const grouped = await this.copyModel.aggregate<{
      _id: CopyStatus;
      count: number;
    }>([
      { $match: { bookId } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);

    const counts: Record<CopyStatus, number> = {
      [CopyStatus.AVAILABLE]: 0,
      [CopyStatus.ON_LOAN]: 0,
      [CopyStatus.DAMAGED]: 0,
      [CopyStatus.LOST]: 0,
      [CopyStatus.RETIRED]: 0,
    };
    for (const row of grouped) {
      counts[row._id] = row.count;
    }

    const earliest = await this.loanModel
      .find({ bookId, status: LoanStatus.ACTIVE })
      .sort({ dueAt: 1 })
      .limit(1)
      .lean();

    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    return {
      bookId: bookId.toString(),
      totalCopies: total,
      available: counts[CopyStatus.AVAILABLE],
      onLoan: counts[CopyStatus.ON_LOAN],
      damaged: counts[CopyStatus.DAMAGED],
      lost: counts[CopyStatus.LOST],
      retired: counts[CopyStatus.RETIRED],
      // An estimate: a due date is not a guaranteed return date.
      earliestExpectedReturn: earliest.length ? earliest[0].dueAt : null,
    };
  }

  private pickBookFields(book: Record<string, unknown>) {
    return {
      title: book.title,
      authors: book.authors,
      isbn: book.isbn,
      publisher: book.publisher,
      edition: book.edition,
      publicationYear: book.publicationYear,
      category: book.category,
      status: book.status,
    };
  }
}
