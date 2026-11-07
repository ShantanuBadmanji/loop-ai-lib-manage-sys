import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { ClientSession, Connection, FilterQuery, Model, Types } from 'mongoose';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import {
  AuditAction,
  AuditActorType,
  AuditEntityType,
} from '../audit-logs/enums/audit.enums';
import { BookCopy, BookCopyDocument } from '../book-copies/schemas/book-copy.schema';
import { CopyStatus } from '../book-copies/enums/copy-status.enum';
import { Book, BookDocument } from '../books/schemas/book.schema';
import { BookStatus } from '../books/enums/book-status.enum';
import { Role, UserStatus } from '../common/enums/role.enum';
import { AuthenticatedUser } from '../common/types/authenticated-user';
import { withTransaction } from '../database/transaction.util';
import { User, UserDocument } from '../users/schemas/user.schema';
import { CorrectLoanDto } from './dto/correct-loan.dto';
import { DamageClaimDto } from './dto/damage-claim.dto';
import { IssueLoanDto } from './dto/issue-loan.dto';
import { MarkLostDto } from './dto/mark-lost.dto';
import { QueryLoansDto } from './dto/query-loans.dto';
import { ReturnLoanDto } from './dto/return-loan.dto';
import { VoidLoanDto } from './dto/void-loan.dto';
import { CorrectionType } from './enums/correction-type.enum';
import {
  LoanStatus,
  ReturnCondition,
  ReturnReportedBy,
} from './enums/loan.enums';
import { Loan, LoanDocument } from './schemas/loan.schema';

@Injectable()
export class LoansService {
  constructor(
    @InjectModel(Loan.name) private readonly loanModel: Model<LoanDocument>,
    @InjectModel(BookCopy.name)
    private readonly copyModel: Model<BookCopyDocument>,
    @InjectModel(Book.name) private readonly bookModel: Model<BookDocument>,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectConnection() private readonly connection: Connection,
    private readonly auditLogs: AuditLogsService,
    private readonly config: ConfigService,
  ) {}

  private get periodDays(): number {
    return this.config.get<number>('loan.periodDays', 14);
  }

  private get damageClaimWindowHours(): number {
    return this.config.get<number>('loan.damageClaimWindowHours', 48);
  }

  /** Derived overdue — never stored. */
  toView(loan: LoanDocument | (Loan & { _id: Types.ObjectId })) {
    const plain =
      'toObject' in loan && typeof loan.toObject === 'function'
        ? loan.toObject()
        : loan;
    const isOverdue =
      plain.status === LoanStatus.ACTIVE && plain.dueAt.getTime() < Date.now();
    const overdueDays = isOverdue
      ? Math.floor((Date.now() - plain.dueAt.getTime()) / 86_400_000)
      : 0;
    return { ...plain, isOverdue, overdueDays };
  }

  async issue(
    dto: IssueLoanDto,
    actor: AuthenticatedUser,
    correlationId: string,
  ) {
    const borrowerId = this.resolveBorrowerId(dto, actor);

    return withTransaction(this.connection, async (session) => {
      const borrower = await this.userModel.findById(borrowerId).session(session);
      if (!borrower || borrower.role !== Role.STUDENT) {
        throw new NotFoundException('Borrower (student) not found');
      }
      if (borrower.status === UserStatus.SUSPENDED) {
        throw new ForbiddenException('Suspended users cannot borrow');
      }

      const book = await this.bookModel.findById(dto.bookId).session(session);
      if (!book) {
        throw new NotFoundException('Book not found');
      }
      if (book.status !== BookStatus.ACTIVE) {
        throw new ConflictException('Book is archived; new issues are not allowed');
      }

      const copy = await this.copyModel.findById(dto.copyId).session(session);
      if (!copy) {
        throw new NotFoundException('Copy not found');
      }
      if (copy.bookId.toString() !== book._id.toString()) {
        throw new BadRequestException('Copy does not belong to the given book');
      }

      // Atomic conditional transition: only one concurrent issue can win.
      const claimed = await this.copyModel.updateOne(
        { _id: copy._id, status: CopyStatus.AVAILABLE },
        { $set: { status: CopyStatus.ON_LOAN } },
        { session },
      );
      if (claimed.modifiedCount !== 1) {
        throw new ConflictException('Copy is not available for loan');
      }

      const issuedAt = new Date();
      const dueAt = new Date(
        issuedAt.getTime() + this.periodDays * 86_400_000,
      );

      const [loan] = await this.loanModel.create(
        [
          {
            bookId: book._id,
            copyId: copy._id,
            borrowerId: borrower._id,
            issuedById: new Types.ObjectId(actor.id),
            issuedAt,
            dueAt,
            status: LoanStatus.ACTIVE,
            bookSnapshot: {
              title: book.title,
              authors: book.authors,
              isbn: book.isbn,
              edition: book.edition,
            },
          },
        ],
        { session },
      );

      await this.auditLogs.record(session, {
        actorId: new Types.ObjectId(actor.id),
        actorType: AuditActorType.USER,
        action: AuditAction.LOAN_ISSUED,
        entityType: AuditEntityType.LOAN,
        entityId: loan._id,
        changes: [
          {
            entityType: AuditEntityType.BOOK_COPY,
            entityId: copy._id,
            before: { status: CopyStatus.AVAILABLE },
            after: { status: CopyStatus.ON_LOAN },
          },
          {
            entityType: AuditEntityType.LOAN,
            entityId: loan._id,
            after: {
              borrowerId: borrower._id.toString(),
              dueAt,
              status: LoanStatus.ACTIVE,
            },
          },
        ],
        correlationId,
      });

      return this.toView(loan);
    });
  }

  async return(
    loanId: string,
    dto: ReturnLoanDto,
    actor: AuthenticatedUser,
    correlationId: string,
  ) {
    return withTransaction(this.connection, async (session) => {
      const loan = await this.loadLoan(loanId, session);
      this.assertCanAccessLoan(loan, actor);
      if (loan.status !== LoanStatus.ACTIVE) {
        throw new ConflictException('Loan is not active; it cannot be returned');
      }

      const isLibrarian = actor.role === Role.LIBRARIAN;
      // Students cannot assess damage; their self-returns are recorded GOOD.
      const condition = isLibrarian
        ? dto.condition ?? ReturnCondition.GOOD
        : ReturnCondition.GOOD;

      const copy = await this.copyModel.findById(loan.copyId).session(session);
      if (!copy) {
        throw new NotFoundException('Associated copy not found');
      }
      const book = await this.bookModel.findById(loan.bookId).session(session);
      const copyBefore = copy.status;

      let newCopyStatus: CopyStatus;
      if (book && book.status === BookStatus.ARCHIVED) {
        newCopyStatus = CopyStatus.RETIRED; // archived-book copies leave circulation
      } else if (condition === ReturnCondition.DAMAGED) {
        newCopyStatus = CopyStatus.DAMAGED;
      } else {
        newCopyStatus = CopyStatus.AVAILABLE;
      }

      const loanBefore = { status: loan.status };
      loan.status = LoanStatus.RETURNED;
      loan.returnedAt = new Date();
      loan.returnedById = new Types.ObjectId(actor.id);
      loan.returnReportedBy = isLibrarian
        ? ReturnReportedBy.LIBRARIAN
        : ReturnReportedBy.STUDENT;
      loan.returnCondition = condition;
      if (dto.conditionNotes) loan.conditionNotes = dto.conditionNotes;
      await loan.save({ session });

      copy.status = newCopyStatus;
      await copy.save({ session });

      await this.auditLogs.record(session, {
        actorId: new Types.ObjectId(actor.id),
        actorType: AuditActorType.USER,
        action: AuditAction.LOAN_RETURNED,
        entityType: AuditEntityType.LOAN,
        entityId: loan._id,
        changes: [
          {
            entityType: AuditEntityType.LOAN,
            entityId: loan._id,
            before: loanBefore,
            after: { status: LoanStatus.RETURNED, returnCondition: condition },
          },
          {
            entityType: AuditEntityType.BOOK_COPY,
            entityId: copy._id,
            before: { status: copyBefore },
            after: { status: newCopyStatus },
          },
        ],
        correlationId,
      });

      return this.toView(loan);
    });
  }

  async markLost(
    loanId: string,
    dto: MarkLostDto,
    actor: AuthenticatedUser,
    correlationId: string,
  ) {
    return withTransaction(this.connection, async (session) => {
      const loan = await this.loadLoan(loanId, session);
      if (loan.status !== LoanStatus.ACTIVE) {
        throw new ConflictException('Only an active loan can be marked lost');
      }
      const copy = await this.copyModel.findById(loan.copyId).session(session);
      if (!copy) {
        throw new NotFoundException('Associated copy not found');
      }
      const copyBefore = copy.status;

      loan.status = LoanStatus.LOST;
      await loan.save({ session });
      copy.status = CopyStatus.LOST;
      await copy.save({ session });

      await this.auditLogs.record(session, {
        actorId: new Types.ObjectId(actor.id),
        actorType: AuditActorType.USER,
        action: AuditAction.LOAN_MARKED_LOST,
        entityType: AuditEntityType.LOAN,
        entityId: loan._id,
        changes: [
          {
            entityType: AuditEntityType.LOAN,
            entityId: loan._id,
            before: { status: LoanStatus.ACTIVE },
            after: { status: LoanStatus.LOST },
          },
          {
            entityType: AuditEntityType.BOOK_COPY,
            entityId: copy._id,
            before: { status: copyBefore },
            after: { status: CopyStatus.LOST },
          },
        ],
        reason: dto.reason,
        correlationId,
      });

      return this.toView(loan);
    });
  }

  async correct(
    loanId: string,
    dto: CorrectLoanDto,
    actor: AuthenticatedUser,
    correlationId: string,
  ) {
    return withTransaction(this.connection, async (session) => {
      const loan = await this.loadLoan(loanId, session);
      if (
        loan.status === LoanStatus.VOIDED ||
        loan.status === LoanStatus.LOST
      ) {
        throw new ConflictException(
          `Cannot correct a ${loan.status} loan`,
        );
      }

      const before: Record<string, unknown> = {};
      const after: Record<string, unknown> = {};

      switch (dto.correctionType) {
        case CorrectionType.BORROWER: {
          if (!dto.newBorrowerId) {
            throw new BadRequestException('newBorrowerId is required');
          }
          const newBorrower = await this.userModel
            .findById(dto.newBorrowerId)
            .session(session);
          if (!newBorrower || newBorrower.role !== Role.STUDENT) {
            throw new BadRequestException('New borrower (student) not found');
          }
          before.borrowerId = loan.borrowerId.toString();
          loan.borrowerId = newBorrower._id;
          after.borrowerId = newBorrower._id.toString();
          break;
        }
        case CorrectionType.DUE_DATE: {
          if (!dto.newDueAt) {
            throw new BadRequestException('newDueAt is required');
          }
          const newDue = new Date(dto.newDueAt);
          if (newDue.getTime() <= loan.issuedAt.getTime()) {
            throw new BadRequestException('Due date must be after the issue date');
          }
          await this.assertNoCopyOverlap(session, loan, loan.issuedAt, newDue);
          before.dueAt = loan.dueAt;
          loan.dueAt = newDue;
          after.dueAt = newDue;
          break;
        }
        case CorrectionType.ISSUE_DATE: {
          if (!dto.newIssuedAt) {
            throw new BadRequestException('newIssuedAt is required');
          }
          const newIssued = new Date(dto.newIssuedAt);
          if (newIssued.getTime() >= loan.dueAt.getTime()) {
            throw new BadRequestException('Issue date must be before the due date');
          }
          await this.assertNoCopyOverlap(session, loan, newIssued, loan.dueAt);
          before.issuedAt = loan.issuedAt;
          loan.issuedAt = newIssued;
          after.issuedAt = newIssued;
          break;
        }
      }

      await loan.save({ session });

      await this.auditLogs.record(session, {
        actorId: new Types.ObjectId(actor.id),
        actorType: AuditActorType.USER,
        action: AuditAction.LOAN_CORRECTED,
        entityType: AuditEntityType.LOAN,
        entityId: loan._id,
        changes: [
          {
            entityType: AuditEntityType.LOAN,
            entityId: loan._id,
            before,
            after,
          },
        ],
        reason: dto.reason,
        correlationId,
      });

      return this.toView(loan);
    });
  }

  async voidLoan(
    loanId: string,
    dto: VoidLoanDto,
    actor: AuthenticatedUser,
    correlationId: string,
  ) {
    return withTransaction(this.connection, async (session) => {
      const loan = await this.loadLoan(loanId, session);
      if (loan.status !== LoanStatus.ACTIVE) {
        throw new ConflictException(
          'Only an active loan can be voided; use a correction for returned loans',
        );
      }
      const copy = await this.copyModel.findById(loan.copyId).session(session);
      if (!copy) {
        throw new NotFoundException('Associated copy not found');
      }
      const book = await this.bookModel.findById(loan.bookId).session(session);
      const copyBefore = copy.status;

      loan.status = LoanStatus.VOIDED;
      await loan.save({ session });

      // Free the copy the voided loan was holding (retire if the book is archived).
      let newCopyStatus = copy.status;
      if (copy.status === CopyStatus.ON_LOAN) {
        newCopyStatus =
          book && book.status === BookStatus.ARCHIVED
            ? CopyStatus.RETIRED
            : CopyStatus.AVAILABLE;
        copy.status = newCopyStatus;
        await copy.save({ session });
      }

      await this.auditLogs.record(session, {
        actorId: new Types.ObjectId(actor.id),
        actorType: AuditActorType.USER,
        action: AuditAction.LOAN_VOIDED,
        entityType: AuditEntityType.LOAN,
        entityId: loan._id,
        changes: [
          {
            entityType: AuditEntityType.LOAN,
            entityId: loan._id,
            before: { status: LoanStatus.ACTIVE },
            after: { status: LoanStatus.VOIDED },
          },
          {
            entityType: AuditEntityType.BOOK_COPY,
            entityId: copy._id,
            before: { status: copyBefore },
            after: { status: newCopyStatus },
          },
        ],
        reason: dto.reason,
        correlationId,
      });

      return this.toView(loan);
    });
  }

  async damageClaim(
    loanId: string,
    dto: DamageClaimDto,
    actor: AuthenticatedUser,
    correlationId: string,
  ) {
    return withTransaction(this.connection, async (session) => {
      const loan = await this.loadLoan(loanId, session);
      if (loan.status !== LoanStatus.RETURNED || !loan.returnedAt) {
        throw new ConflictException(
          'Damage claims apply only to returned loans',
        );
      }
      const windowMs = this.damageClaimWindowHours * 3_600_000;
      if (Date.now() - loan.returnedAt.getTime() > windowMs) {
        throw new ConflictException('The damage-claim window has closed');
      }

      const copy = await this.copyModel.findById(loan.copyId).session(session);
      if (!copy) {
        throw new NotFoundException('Associated copy not found');
      }
      // Reject if the copy was re-issued (or otherwise moved on) since this return.
      if (copy.status !== CopyStatus.AVAILABLE) {
        throw new ConflictException(
          'Copy is no longer available for a claim (it may have been re-issued)',
        );
      }
      const laterLoan = await this.loanModel
        .findOne({
          copyId: copy._id,
          _id: { $ne: loan._id },
          issuedAt: { $gt: loan.returnedAt },
        })
        .session(session);
      if (laterLoan) {
        throw new ConflictException(
          'Copy has been issued again since this return; claim cannot be filed',
        );
      }

      const copyBefore = copy.status;
      copy.status = CopyStatus.DAMAGED;
      await copy.save({ session });

      loan.returnCondition = ReturnCondition.DAMAGED;
      loan.damageClaim = {
        filedBy: new Types.ObjectId(actor.id),
        filedAt: new Date(),
        type: ReturnCondition.DAMAGED,
        notes: dto.notes,
      };
      await loan.save({ session });

      await this.auditLogs.record(session, {
        actorId: new Types.ObjectId(actor.id),
        actorType: AuditActorType.USER,
        action: AuditAction.COPY_DAMAGE_CLAIMED,
        entityType: AuditEntityType.LOAN,
        entityId: loan._id,
        changes: [
          {
            entityType: AuditEntityType.BOOK_COPY,
            entityId: copy._id,
            before: { status: copyBefore },
            after: { status: CopyStatus.DAMAGED },
          },
          {
            entityType: AuditEntityType.LOAN,
            entityId: loan._id,
            before: { returnCondition: ReturnCondition.GOOD },
            after: { returnCondition: ReturnCondition.DAMAGED },
          },
        ],
        reason: dto.reason,
        correlationId,
      });

      return this.toView(loan);
    });
  }

  async findOne(loanId: string, actor: AuthenticatedUser) {
    const loan = await this.loadLoan(loanId);
    this.assertCanAccessLoan(loan, actor);
    return this.toView(loan);
  }

  async listForBorrower(borrowerId: string, query: QueryLoansDto) {
    return this.list({ ...query, borrowerId }, false);
  }

  async list(query: QueryLoansDto, _isLibrarian = true) {
    const filter: FilterQuery<LoanDocument> = {};
    if (query.borrowerId)
      filter.borrowerId = new Types.ObjectId(query.borrowerId);
    if (query.bookId) filter.bookId = new Types.ObjectId(query.bookId);
    if (query.status) filter.status = query.status;
    if (query.overdue) {
      filter.status = LoanStatus.ACTIVE;
      filter.dueAt = { $lt: new Date() };
    }

    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, Math.max(1, query.limit ?? 20));
    const [items, total] = await Promise.all([
      this.loanModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      this.loanModel.countDocuments(filter),
    ]);
    return { items: items.map((l) => this.toView(l)), total, page, limit };
  }

  private resolveBorrowerId(
    dto: IssueLoanDto,
    actor: AuthenticatedUser,
  ): string {
    if (actor.role === Role.STUDENT) {
      if (dto.borrowerId && dto.borrowerId !== actor.id) {
        throw new ForbiddenException(
          'Students can only issue copies to themselves',
        );
      }
      if (actor.status === UserStatus.SUSPENDED) {
        throw new ForbiddenException('Suspended users cannot borrow');
      }
      return actor.id;
    }
    if (!dto.borrowerId) {
      throw new BadRequestException(
        'borrowerId is required when a librarian issues a copy',
      );
    }
    return dto.borrowerId;
  }

  private async loadLoan(
    loanId: string,
    session?: ClientSession,
  ): Promise<LoanDocument> {
    if (!Types.ObjectId.isValid(loanId)) {
      throw new NotFoundException('Loan not found');
    }
    const query = this.loanModel.findById(loanId);
    if (session) query.session(session);
    const loan = await query;
    if (!loan) {
      throw new NotFoundException('Loan not found');
    }
    return loan;
  }

  private assertCanAccessLoan(loan: LoanDocument, actor: AuthenticatedUser) {
    if (
      actor.role === Role.STUDENT &&
      loan.borrowerId.toString() !== actor.id
    ) {
      throw new ForbiddenException('You can only access your own loans');
    }
  }

  private async assertNoCopyOverlap(
    session: ClientSession,
    loan: LoanDocument,
    start: Date,
    end: Date,
  ) {
    // A corrected interval must not overlap another loan of the same copy.
    const others = await this.loanModel
      .find({
        copyId: loan.copyId,
        _id: { $ne: loan._id },
        status: { $in: [LoanStatus.ACTIVE, LoanStatus.RETURNED, LoanStatus.LOST] },
      })
      .session(session);
    for (const other of others) {
      const otherStart = other.issuedAt.getTime();
      const otherEnd = (other.returnedAt ?? other.dueAt).getTime();
      if (start.getTime() <= otherEnd && otherStart <= end.getTime()) {
        throw new ConflictException(
          'Correction would overlap another loan of the same copy',
        );
      }
    }
  }
}
