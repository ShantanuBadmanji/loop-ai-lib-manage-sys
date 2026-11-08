import { INestApplication, ValidationPipe } from '@nestjs/common';
import { getConnectionToken } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import { Connection } from 'mongoose';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { PasswordService } from '../../src/common/security/password.service';
import { Role, UserStatus } from '../../src/common/enums/role.enum';
import { User } from '../../src/users/schemas/user.schema';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { UserDocument } from '../../src/users/schemas/user.schema';

export interface TestContext {
  app: INestApplication;
  connection: Connection;
  http: () => ReturnType<typeof request>;
}

export async function createTestApp(): Promise<TestContext> {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleRef.createNestApplication();
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  await app.init();

  const connection = app.get<Connection>(getConnectionToken());
  // Ensure unique/partial indexes exist so concurrency invariants are enforced.
  await Promise.all(
    Object.values(connection.models).map((m) => m.createIndexes()),
  );

  return {
    app,
    connection,
    http: () => request(app.getHttpServer()),
  };
}

export async function clearDatabase(connection: Connection): Promise<void> {
  const collections = await connection.db!.collections();
  await Promise.all(collections.map((c) => c.deleteMany({})));
}

const PREFIX = '/api/v1';

export async function registerStudent(
  ctx: TestContext,
  overrides: Partial<{
    name: string;
    email: string;
    password: string;
    enrollmentNumber: string;
    department: string;
  }> = {},
) {
  const payload = {
    name: overrides.name ?? 'Test Student',
    email: overrides.email ?? `student-${Date.now()}-${Math.random()}@u.edu`,
    password: overrides.password ?? 'Student@123',
    enrollmentNumber:
      overrides.enrollmentNumber ?? `ENR-${Date.now()}-${Math.random()}`,
    department: overrides.department ?? 'CS',
  };
  const res = await ctx.http().post(`${PREFIX}/auth/register`).send(payload);
  return { payload, body: res.body, status: res.status };
}

export async function login(ctx: TestContext, email: string, password: string) {
  const res = await ctx
    .http()
    .post(`${PREFIX}/auth/login`)
    .send({ email, password });
  return {
    token: res.body.accessToken as string,
    body: res.body,
    status: res.status,
  };
}

/** Inserts a librarian directly (bootstrap) and returns a valid access token. */
export async function createLibrarianAndLogin(ctx: TestContext) {
  const password = 'Librarian@123';
  const email = `lib-${Date.now()}-${Math.random()}@u.edu`;
  const passwordService = ctx.app.get(PasswordService);
  const userModel = ctx.app.get<Model<UserDocument>>(getModelToken(User.name));
  await userModel.create({
    name: 'Boot Librarian',
    email,
    passwordHash: await passwordService.hash(password),
    role: Role.LIBRARIAN,
    status: UserStatus.ACTIVE,
    librarianProfile: { employeeNumber: `EMP-${Date.now()}-${Math.random()}` },
  });
  const { token } = await login(ctx, email, password);
  return { token, email, password };
}

export function auth(token: string) {
  return { Authorization: `Bearer ${token}` };
}

export async function createBook(
  ctx: TestContext,
  token: string,
  overrides: Record<string, unknown> = {},
) {
  const res = await ctx
    .http()
    .post(`${PREFIX}/books`)
    .set(auth(token))
    .send({
      title: 'Test Book',
      authors: ['Author One'],
      isbn: `978${Math.floor(Math.random() * 1e10)}`,
      category: 'CS',
      edition: '1st',
      ...overrides,
    });
  return res.body;
}

export async function addCopies(
  ctx: TestContext,
  token: string,
  bookId: string,
  barcodes: string[],
) {
  const res = await ctx
    .http()
    .post(`${PREFIX}/books/${bookId}/copies`)
    .set(auth(token))
    .send({ copies: barcodes.map((barcode) => ({ barcode })) });
  return res.body as Array<{ _id: string; barcode: string; status: string }>;
}

export const API_PREFIX = PREFIX;
