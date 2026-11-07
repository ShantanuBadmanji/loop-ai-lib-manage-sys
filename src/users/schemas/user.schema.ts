import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { Role, UserStatus } from '../../common/enums/role.enum';

export type UserDocument = HydratedDocument<User>;

@Schema({ _id: false })
export class StudentProfile {
  @Prop({ required: true, trim: true })
  enrollmentNumber: string;

  @Prop({ required: true, trim: true })
  department: string;
}
export const StudentProfileSchema = SchemaFactory.createForClass(StudentProfile);

@Schema({ _id: false })
export class LibrarianProfile {
  @Prop({ required: true, trim: true })
  employeeNumber: string;
}
export const LibrarianProfileSchema =
  SchemaFactory.createForClass(LibrarianProfile);

@Schema({ timestamps: true, collection: 'users' })
export class User {
  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ required: true, lowercase: true, trim: true })
  email: string;

  @Prop({ required: true })
  passwordHash: string;

  @Prop({ required: true, enum: Role })
  role: Role;

  @Prop({ required: true, enum: UserStatus, default: UserStatus.ACTIVE })
  status: UserStatus;

  @Prop({ type: StudentProfileSchema })
  studentProfile?: StudentProfile;

  @Prop({ type: LibrarianProfileSchema })
  librarianProfile?: LibrarianProfile;
}

export const UserSchema = SchemaFactory.createForClass(User);

UserSchema.index({ email: 1 }, { unique: true });
UserSchema.index(
  { 'studentProfile.enrollmentNumber': 1 },
  {
    unique: true,
    partialFilterExpression: {
      'studentProfile.enrollmentNumber': { $exists: true },
    },
  },
);
UserSchema.index(
  { 'librarianProfile.employeeNumber': 1 },
  {
    unique: true,
    partialFilterExpression: {
      'librarianProfile.employeeNumber': { $exists: true },
    },
  },
);
