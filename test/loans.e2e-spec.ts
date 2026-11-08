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

describe('Loan lifecycle, corrections & audit (e2e)', () => {
  let ctx: TestContext;
  let libToken: string;
  let studentToken: string;
  let studentId: string;

  beforeAll(async () => {
    ctx = await createTestApp();
  });
  afterAll(async () => {
    await ctx.app.close();
  });
  beforeEach(async () => {
    ({ token: libToken } = await createLibrarianAndLogin(ctx));
    const { payload } = await registerStudent(ctx);
    const res = await login(ctx, payload.email, payload.password);
    studentToken = res.token;
    studentId = res.body.user.id;
  });
  afterEach(async () => {
    await clearDatabase(ctx.connection);
  });

  async function freshCopy() {
    const book = await createBook(ctx, libToken);
    const [copy] = await addCopies(ctx, libToken, book._id, [
      `BC-${Date.now()}-${Math.random()}`,
    ]);
    return { bookId: book._id as string, copyId: copy._id };
  }

  async function issueToStudent() {
    const { bookId, copyId } = await freshCopy();
    const res = await ctx
      .http()
      .post(`${API_PREFIX}/loans/issue`)
      .set(auth(studentToken))
      .send({ bookId, copyId });
    return { bookId, copyId, res };
  }

  it('issues a copy with a 14-day due date and marks the copy ON_LOAN', async () => {
    const { copyId, res } = await issueToStudent();
    expect(res.status).toBe(201);
    const issuedAt = new Date(res.body.issuedAt).getTime();
    const dueAt = new Date(res.body.dueAt).getTime();
    expect(Math.round((dueAt - issuedAt) / 86_400_000)).toBe(14);

    const copy = await ctx
      .http()
      .get(`${API_PREFIX}/copies/${copyId}`)
      .set(auth(libToken));
    expect(copy.body.status).toBe('ON_LOAN');
  });

  it('auto-picks an available copy when copyId is omitted (bookId only)', async () => {
    const book = await createBook(ctx, libToken);
    await addCopies(ctx, libToken, book._id, [
      `AP-${Date.now()}-1`,
      `AP-${Date.now()}-2`,
    ]);
    const res = await ctx
      .http()
      .post(`${API_PREFIX}/loans/issue`)
      .set(auth(studentToken))
      .send({ bookId: book._id });
    expect(res.status).toBe(201);
    expect(res.body.copyId).toBeDefined();
    expect(res.body.bookSnapshot.title).toBe('Test Book');
  });

  it('derives bookId from copyId when bookId is omitted', async () => {
    const { copyId } = await freshCopy();
    const res = await ctx
      .http()
      .post(`${API_PREFIX}/loans/issue`)
      .set(auth(studentToken))
      .send({ copyId });
    expect(res.status).toBe(201);
    expect(res.body.bookId).toBeDefined();
    expect(res.body.copyId).toBe(copyId);
  });

  it('rejects issue when neither bookId nor copyId is provided', async () => {
    const res = await ctx
      .http()
      .post(`${API_PREFIX}/loans/issue`)
      .set(auth(studentToken))
      .send({});
    expect(res.status).toBe(400);
  });

  it('returns 409 when auto-picking with no available copies', async () => {
    const book = await createBook(ctx, libToken);
    // no copies added at all
    const res = await ctx
      .http()
      .post(`${API_PREFIX}/loans/issue`)
      .set(auth(studentToken))
      .send({ bookId: book._id });
    expect(res.status).toBe(409);
  });

  it('returns a loan (student self-return) and frees the copy', async () => {
    const { copyId, res } = await issueToStudent();
    const ret = await ctx
      .http()
      .post(`${API_PREFIX}/loans/${res.body._id}/return`)
      .set(auth(studentToken))
      .send({});
    expect(ret.status).toBe(200);
    expect(ret.body.status).toBe('RETURNED');
    expect(ret.body.returnReportedBy).toBe('STUDENT');

    const copy = await ctx
      .http()
      .get(`${API_PREFIX}/copies/${copyId}`)
      .set(auth(libToken));
    expect(copy.body.status).toBe('AVAILABLE');
  });

  it('rejects a duplicate return with 409', async () => {
    const { res } = await issueToStudent();
    await ctx
      .http()
      .post(`${API_PREFIX}/loans/${res.body._id}/return`)
      .set(auth(studentToken))
      .send({});
    const dup = await ctx
      .http()
      .post(`${API_PREFIX}/loans/${res.body._id}/return`)
      .set(auth(studentToken))
      .send({});
    expect(dup.status).toBe(409);
  });

  it('records a damaged return (librarian) as RETURNED loan + DAMAGED copy', async () => {
    const { copyId, res } = await issueToStudent();
    const ret = await ctx
      .http()
      .post(`${API_PREFIX}/loans/${res.body._id}/return`)
      .set(auth(libToken))
      .send({ condition: 'DAMAGED', conditionNotes: 'torn pages' });
    expect(ret.status).toBe(200);
    expect(ret.body.returnCondition).toBe('DAMAGED');

    const copy = await ctx
      .http()
      .get(`${API_PREFIX}/copies/${copyId}`)
      .set(auth(libToken));
    expect(copy.body.status).toBe('DAMAGED');
  });

  it('marks a loan lost: loan LOST + copy LOST', async () => {
    const { copyId, res } = await issueToStudent();
    const lost = await ctx
      .http()
      .post(`${API_PREFIX}/loans/${res.body._id}/mark-lost`)
      .set(auth(libToken))
      .send({ reason: 'not returned' });
    expect(lost.status).toBe(200);
    expect(lost.body.status).toBe('LOST');
    const copy = await ctx
      .http()
      .get(`${API_PREFIX}/copies/${copyId}`)
      .set(auth(libToken));
    expect(copy.body.status).toBe('LOST');
  });

  it('derives overdue state from loan dates', async () => {
    const { res } = await issueToStudent();
    // Force the due date into the past directly in the DB.
    await ctx.connection
      .collection('loans')
      .updateOne(
        { _id: new Types.ObjectId(res.body._id) },
        { $set: { dueAt: new Date(Date.now() - 86_400_000) } },
      );
    const get = await ctx
      .http()
      .get(`${API_PREFIX}/loans/${res.body._id}`)
      .set(auth(studentToken));
    expect(get.body.isOverdue).toBe(true);
    expect(get.body.overdueDays).toBeGreaterThanOrEqual(1);

    const overdue = await ctx
      .http()
      .get(`${API_PREFIX}/loans/me?overdue=true`)
      .set(auth(studentToken));
    expect(overdue.body.total).toBe(1);
  });

  it('retires the copy when a copy of an archived book is returned', async () => {
    const { bookId, copyId, res } = await issueToStudent();
    await ctx
      .http()
      .post(`${API_PREFIX}/books/${bookId}/archive`)
      .set(auth(libToken))
      .send({});
    const ret = await ctx
      .http()
      .post(`${API_PREFIX}/loans/${res.body._id}/return`)
      .set(auth(libToken))
      .send({});
    expect(ret.status).toBe(200);
    const copy = await ctx
      .http()
      .get(`${API_PREFIX}/copies/${copyId}`)
      .set(auth(libToken));
    expect(copy.body.status).toBe('RETIRED');
  });

  it('prevents a student from reading another student’s loan', async () => {
    const { res } = await issueToStudent();
    const other = await registerStudent(ctx);
    const otherLogin = await login(
      ctx,
      other.payload.email,
      other.payload.password,
    );
    const get = await ctx
      .http()
      .get(`${API_PREFIX}/loans/${res.body._id}`)
      .set(auth(otherLogin.token));
    expect(get.status).toBe(403);
  });

  it('corrects the borrower with a reason and audits before/after', async () => {
    const { res } = await issueToStudent();
    const other = await registerStudent(ctx);
    const otherLogin = await login(
      ctx,
      other.payload.email,
      other.payload.password,
    );

    const correct = await ctx
      .http()
      .post(`${API_PREFIX}/loans/${res.body._id}/correct`)
      .set(auth(libToken))
      .send({
        correctionType: 'BORROWER',
        reason: 'Scanned the wrong student card',
        newBorrowerId: otherLogin.body.user.id,
      });
    expect(correct.status).toBe(200);
    expect(correct.body.borrowerId).toBe(otherLogin.body.user.id);

    const trail = await ctx
      .http()
      .get(`${API_PREFIX}/audit-logs/loan/${res.body._id}`)
      .set(auth(libToken));
    const corrected = trail.body.find(
      (a: any) => a.action === 'LOAN_CORRECTED',
    );
    expect(corrected).toBeDefined();
    expect(corrected.reason).toBe('Scanned the wrong student card');
    expect(corrected.changes[0].before.borrowerId).toBe(studentId);
    expect(corrected.changes[0].after.borrowerId).toBe(otherLogin.body.user.id);
  });

  it('rejects a correction without a reason (400)', async () => {
    const { res } = await issueToStudent();
    const bad = await ctx
      .http()
      .post(`${API_PREFIX}/loans/${res.body._id}/correct`)
      .set(auth(libToken))
      .send({ correctionType: 'BORROWER', newBorrowerId: studentId });
    expect(bad.status).toBe(400);
  });

  it('voids an active loan and frees the copy; refuses to void a returned loan', async () => {
    const { copyId, res } = await issueToStudent();
    const voided = await ctx
      .http()
      .post(`${API_PREFIX}/loans/${res.body._id}/void`)
      .set(auth(libToken))
      .send({ reason: 'created by mistake' });
    expect(voided.status).toBe(200);
    expect(voided.body.status).toBe('VOIDED');
    const copy = await ctx
      .http()
      .get(`${API_PREFIX}/copies/${copyId}`)
      .set(auth(libToken));
    expect(copy.body.status).toBe('AVAILABLE');

    // A second issue + return, then void should fail.
    const second = await issueToStudent();
    await ctx
      .http()
      .post(`${API_PREFIX}/loans/${second.res.body._id}/return`)
      .set(auth(studentToken))
      .send({});
    const voidReturned = await ctx
      .http()
      .post(`${API_PREFIX}/loans/${second.res.body._id}/void`)
      .set(auth(libToken))
      .send({ reason: 'too late' });
    expect(voidReturned.status).toBe(409);
  });

  it('files a damage claim within the window, then rejects it after re-issue', async () => {
    const { copyId, res } = await issueToStudent();
    // Student self-returns (no inspection).
    await ctx
      .http()
      .post(`${API_PREFIX}/loans/${res.body._id}/return`)
      .set(auth(studentToken))
      .send({});

    const claim = await ctx
      .http()
      .post(`${API_PREFIX}/loans/${res.body._id}/damage-claim`)
      .set(auth(libToken))
      .send({ notes: 'cover torn' });
    expect(claim.status).toBe(200);
    const copy = await ctx
      .http()
      .get(`${API_PREFIX}/copies/${copyId}`)
      .set(auth(libToken));
    expect(copy.body.status).toBe('DAMAGED');
  });

  it('issue and return each generate an audit record; audit has no mutation endpoint', async () => {
    const { res } = await issueToStudent();
    await ctx
      .http()
      .post(`${API_PREFIX}/loans/${res.body._id}/return`)
      .set(auth(studentToken))
      .send({});
    const trail = await ctx
      .http()
      .get(`${API_PREFIX}/audit-logs/loan/${res.body._id}`)
      .set(auth(libToken));
    const actions = trail.body.map((a: any) => a.action);
    expect(actions).toContain('LOAN_ISSUED');
    expect(actions).toContain('LOAN_RETURNED');

    // No audit mutation routes exist.
    const patch = await ctx
      .http()
      .patch(`${API_PREFIX}/audit-logs/${trail.body[0]._id}`)
      .set(auth(libToken))
      .send({ action: 'HACK' });
    expect(patch.status).toBe(404);
    const del = await ctx
      .http()
      .delete(`${API_PREFIX}/audit-logs/${trail.body[0]._id}`)
      .set(auth(libToken));
    expect(del.status).toBe(404);
  });
});
