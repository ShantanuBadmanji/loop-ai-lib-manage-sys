import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CopyStatus } from '../book-copies/enums/copy-status.enum';
import {
  BookCopy,
  BookCopyDocument,
} from '../book-copies/schemas/book-copy.schema';
import { BookStatus } from '../books/enums/book-status.enum';
import { Book, BookDocument } from '../books/schemas/book.schema';
import { Role, UserStatus } from '../common/enums/role.enum';
import { PasswordService } from '../common/security/password.service';
import { User, UserDocument } from '../users/schemas/user.schema';

@Injectable()
export class SeedService {
  private readonly logger = new Logger(SeedService.name);

  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(Book.name) private readonly bookModel: Model<BookDocument>,
    @InjectModel(BookCopy.name)
    private readonly copyModel: Model<BookCopyDocument>,
    private readonly passwordService: PasswordService,
    private readonly config: ConfigService,
  ) {}

  /** Idempotent: safe to run repeatedly. Upserts by natural keys. */
  async run(): Promise<void> {
    const seed = this.config.get('seed') as {
      librarianEmail: string;
      librarianPassword: string;
      studentEmail: string;
      studentPassword: string;
    };

    const librarian = await this.upsertUser({
      name: 'Head Librarian',
      email: seed.librarianEmail,
      password: seed.librarianPassword,
      role: Role.LIBRARIAN,
      librarianProfile: { employeeNumber: 'EMP-0001' },
    });

    await this.upsertUser({
      name: 'Demo Student',
      email: seed.studentEmail,
      password: seed.studentPassword,
      role: Role.STUDENT,
      studentProfile: {
        enrollmentNumber: 'ENR-2026-0001',
        department: 'Computer Science',
      },
    });
    await this.upsertUser({
      name: 'Second Student',
      email: 'student2@university.edu',
      password: seed.studentPassword,
      role: Role.STUDENT,
      studentProfile: {
        enrollmentNumber: 'ENR-2026-0002',
        department: 'Mathematics',
      },
    });

    const books = [
      {
        title: 'Introduction to Algorithms',
        authors: ['Cormen', 'Leiserson', 'Rivest', 'Stein'],
        isbn: '9780262033848',
        category: 'Computer Science',
        edition: '3rd',
        copies: 3,
      },
      {
        title: 'Clean Code',
        authors: ['Robert C. Martin'],
        isbn: '9780132350884',
        category: 'Software Engineering',
        edition: '1st',
        copies: 2,
      },
      {
        title: 'The Pragmatic Programmer',
        authors: ['Andrew Hunt', 'David Thomas'],
        isbn: '9780135957059',
        category: 'Software Engineering',
        edition: '2nd',
        copies: 1,
      },
    ];

    for (const spec of books) {
      const book = await this.upsertBook(spec, librarian._id);
      for (let i = 1; i <= spec.copies; i++) {
        const barcode = `${spec.isbn}-C${i}`;
        await this.upsertCopy(book._id, barcode);
      }
    }

    this.logger.log('Seed complete.');
    this.logger.log(
      `Librarian: ${seed.librarianEmail} / ${seed.librarianPassword} (DEV ONLY)`,
    );
    this.logger.log(
      `Student:   ${seed.studentEmail} / ${seed.studentPassword} (DEV ONLY)`,
    );
  }

  private async upsertUser(input: {
    name: string;
    email: string;
    password: string;
    role: Role;
    studentProfile?: { enrollmentNumber: string; department: string };
    librarianProfile?: { employeeNumber: string };
  }): Promise<UserDocument> {
    const existing = await this.userModel.findOne({
      email: input.email.toLowerCase(),
    });
    if (existing) {
      return existing;
    }
    const passwordHash = await this.passwordService.hash(input.password);
    return this.userModel.create({
      name: input.name,
      email: input.email,
      passwordHash,
      role: input.role,
      status: UserStatus.ACTIVE,
      studentProfile: input.studentProfile,
      librarianProfile: input.librarianProfile,
    });
  }

  private async upsertBook(
    spec: {
      title: string;
      authors: string[];
      isbn: string;
      category: string;
      edition: string;
    },
    createdBy: Types.ObjectId,
  ): Promise<BookDocument> {
    const existing = await this.bookModel.findOne({ isbn: spec.isbn });
    if (existing) {
      return existing;
    }
    return this.bookModel.create({
      title: spec.title,
      authors: spec.authors,
      isbn: spec.isbn,
      category: spec.category,
      edition: spec.edition,
      status: BookStatus.ACTIVE,
      createdBy,
    });
  }

  private async upsertCopy(
    bookId: Types.ObjectId,
    barcode: string,
  ): Promise<BookCopyDocument> {
    const existing = await this.copyModel.findOne({ barcode });
    if (existing) {
      return existing;
    }
    return this.copyModel.create({
      bookId,
      barcode,
      status: CopyStatus.AVAILABLE,
    });
  }
}
