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
import { PasswordService } from '../common/security/password.service';
import { Role, UserStatus } from '../common/enums/role.enum';
import { AuthenticatedUser } from '../common/types/authenticated-user';
import { withTransaction } from '../database/transaction.util';
import { CreateLibrarianDto } from './dto/create-librarian.dto';
import { RegisterStudentDto } from './dto/register-student.dto';
import { User, UserDocument } from './schemas/user.schema';

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: Role;
  status: UserStatus;
  studentProfile?: { enrollmentNumber: string; department: string };
  librarianProfile?: { employeeNumber: string };
  createdAt?: Date;
  updatedAt?: Date;
}

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectConnection() private readonly connection: Connection,
    private readonly passwordService: PasswordService,
    private readonly auditLogs: AuditLogsService,
  ) {}

  toProfile(user: UserDocument): UserProfile {
    return {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.status,
      studentProfile: user.studentProfile
        ? {
            enrollmentNumber: user.studentProfile.enrollmentNumber,
            department: user.studentProfile.department,
          }
        : undefined,
      librarianProfile: user.librarianProfile
        ? { employeeNumber: user.librarianProfile.employeeNumber }
        : undefined,
      createdAt: (user as UserDocument & { createdAt?: Date }).createdAt,
      updatedAt: (user as UserDocument & { updatedAt?: Date }).updatedAt,
    };
  }

  async findByEmail(email: string): Promise<UserDocument | null> {
    return this.userModel.findOne({ email: email.toLowerCase().trim() });
  }

  async findById(id: string): Promise<UserDocument | null> {
    if (!Types.ObjectId.isValid(id)) {
      return null;
    }
    return this.userModel.findById(id);
  }

  async registerStudent(dto: RegisterStudentDto): Promise<UserProfile> {
    await this.assertEmailFree(dto.email);
    const passwordHash = await this.passwordService.hash(dto.password);
    const created = await this.userModel.create({
      name: dto.name,
      email: dto.email,
      passwordHash,
      role: Role.STUDENT,
      status: UserStatus.ACTIVE,
      studentProfile: {
        enrollmentNumber: dto.enrollmentNumber,
        department: dto.department,
      },
    });
    return this.toProfile(created);
  }

  async createLibrarian(
    dto: CreateLibrarianDto,
    actor: AuthenticatedUser,
    correlationId: string,
  ): Promise<UserProfile> {
    await this.assertEmailFree(dto.email);
    const passwordHash = await this.passwordService.hash(dto.password);

    const profile = await withTransaction(this.connection, async (session) => {
      const [created] = await this.userModel.create(
        [
          {
            name: dto.name,
            email: dto.email,
            passwordHash,
            role: Role.LIBRARIAN,
            status: UserStatus.ACTIVE,
            librarianProfile: { employeeNumber: dto.employeeNumber },
          },
        ],
        { session },
      );

      await this.auditLogs.record(session, {
        actorId: new Types.ObjectId(actor.id),
        actorType: AuditActorType.USER,
        action: AuditAction.LIBRARIAN_CREATED,
        entityType: AuditEntityType.USER,
        entityId: created._id,
        changes: [
          {
            entityType: AuditEntityType.USER,
            entityId: created._id,
            after: {
              email: created.email,
              role: created.role,
              employeeNumber: dto.employeeNumber,
            },
          },
        ],
        correlationId,
      });

      return this.toProfile(created);
    });

    return profile;
  }

  async setStatus(
    id: string,
    status: UserStatus,
    actor: AuthenticatedUser,
    correlationId: string,
    reason?: string,
  ): Promise<UserProfile> {
    return withTransaction(this.connection, async (session) => {
      const user = await this.userModel.findById(id).session(session);
      if (!user) {
        throw new NotFoundException('User not found');
      }
      const before = user.status;
      if (before === status) {
        return this.toProfile(user);
      }
      user.status = status;
      await user.save({ session });

      await this.auditLogs.record(session, {
        actorId: new Types.ObjectId(actor.id),
        actorType: AuditActorType.USER,
        action:
          status === UserStatus.SUSPENDED
            ? AuditAction.USER_SUSPENDED
            : AuditAction.USER_REACTIVATED,
        entityType: AuditEntityType.USER,
        entityId: user._id,
        changes: [
          {
            entityType: AuditEntityType.USER,
            entityId: user._id,
            before: { status: before },
            after: { status },
          },
        ],
        reason,
        correlationId,
      });

      return this.toProfile(user);
    });
  }

  private async assertEmailFree(email: string): Promise<void> {
    const existing = await this.userModel
      .findOne({ email: email.toLowerCase().trim() })
      .lean();
    if (existing) {
      throw new ConflictException('Email already registered');
    }
  }
}
