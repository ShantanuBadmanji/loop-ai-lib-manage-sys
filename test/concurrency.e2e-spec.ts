import { Types } from 'mongoose';
import {
  API_PREFIX,
  TestContext,
  addCopies,
  auth,
  clearDatabase,
  createBook,
  createLibrarianAndLogin,
  createTestApp,
  login,
  registerStudent,
} from './utils/test-app';

describe('Concurrency & consistency (e2e)', () => {
  let ctx: TestContext;
  let libToken: string;

  beforeAll(async () => {
    ctx = await createTestApp();
  });
  afterAll(async () => {
    await ctx.app.close();
  });
  beforeEach(async () => {
    ({ token: libToken } = await createLibrarianAndLogin(ctx));
  });
  afterEach(async () => {
    await clearDatabase(ctx.connection);
  });

  it('allows exactly one of two simultaneous issues of the last copy to succeed', async () => {
    const book = await createBook(ctx, libToken);
    const [copy] = await addCopies(ctx, libToken, book._id, [
      `LAST-${Date.now()}`,
    ]);

    // Two different students racing for the single copy.
    const s1 = await registerStudent(ctx);
    const l1 = await login(ctx, s1.payload.email, s1.payload.password);
    const s2 = await registerStudent(ctx);
    const l2 = await login(ctx, s2.payload.email, s2.payload.password);

    const issue = (token: string) =>
      ctx
        .http()
        .post(`${API_PREFIX}/loans/issue`)
        .set(auth(token))
        .send({ bookId: book._id, copyId: copy._id });

    const [r1, r2] = await Promise.all([issue(l1.token), issue(l2.token)]);
    const statuses = [r1.status, r2.status].sort();

    // Exactly one 201 (success) and one 409 (conflict).
    expect(statuses).toEqual([201, 409]);

    // Only one ACTIVE loan exists for the copy.
    const activeLoans = await ctx.connection
      .collection('loans')
      .countDocuments({ status: 'ACTIVE' });
    expect(activeLoans).toBe(1);

    // Copy is ON_LOAN.
    const copyDoc = await ctx
      .http()
      .get(`${API_PREFIX}/copies/${copy._id}`)
      .set(auth(libToken));
    expect(copyDoc.body.status).toBe('ON_LOAN');
  });

  it('enforces one-active-loan-per-copy via the partial unique index', async () => {
    const book = await createBook(ctx, libToken);
    const [copy] = await addCopies(ctx, libToken, book._id, [
      `IDX-${Date.now()}`,
    ]);
    const s = await registerStudent(ctx);
    const l = await login(ctx, s.payload.email, s.payload.password);

    const first = await ctx
      .http()
      .post(`${API_PREFIX}/loans/issue`)
      .set(auth(l.token))
      .send({ bookId: book._id, copyId: copy._id });
    expect(first.status).toBe(201);

    // A direct second ACTIVE loan insert for the same copy must be rejected.
    await expect(
      ctx.connection.collection('loans').insertOne({
        bookId: new Types.ObjectId(book._id),
        copyId: new Types.ObjectId(copy._id),
        borrowerId: new Types.ObjectId(l.body.user.id),
        status: 'ACTIVE',
        issuedAt: new Date(),
        dueAt: new Date(),
      }),
    ).rejects.toThrow();
  });
});
