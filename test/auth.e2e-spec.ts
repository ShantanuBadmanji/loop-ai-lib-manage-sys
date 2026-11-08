import {
  API_PREFIX,
  TestContext,
  auth,
  clearDatabase,
  createLibrarianAndLogin,
  createTestApp,
  login,
  registerStudent,
} from './utils/test-app';

describe('Auth & authorization (e2e)', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestApp();
  });
  afterAll(async () => {
    await ctx.app.close();
  });
  afterEach(async () => {
    await clearDatabase(ctx.connection);
  });

  it('registers a student with role STUDENT (never client-set)', async () => {
    const { payload, body, status } = await registerStudent(ctx);
    expect(status).toBe(201);
    expect(body.role).toBe('STUDENT');
    expect(body.email).toBe(payload.email.toLowerCase());
    expect(body.passwordHash).toBeUndefined();
  });

  it('rejects a register payload that tries to set a role (403/400 via whitelist)', async () => {
    const res = await ctx
      .http()
      .post(`${API_PREFIX}/auth/register`)
      .send({
        name: 'Sneaky',
        email: `sneaky-${Date.now()}@u.edu`,
        password: 'Student@123',
        enrollmentNumber: `ENR-${Date.now()}`,
        department: 'CS',
        role: 'LIBRARIAN',
      });
    expect(res.status).toBe(400);
  });

  it('logs in with valid credentials and rejects invalid ones', async () => {
    const { payload } = await registerStudent(ctx);
    const ok = await login(ctx, payload.email, payload.password);
    expect(ok.status).toBe(200);
    expect(ok.token).toBeDefined();

    const bad = await login(ctx, payload.email, 'wrong-password');
    expect(bad.status).toBe(401);
  });

  it('returns the current user from /auth/me', async () => {
    const { payload } = await registerStudent(ctx);
    const { token } = await login(ctx, payload.email, payload.password);
    const res = await ctx.http().get(`${API_PREFIX}/auth/me`).set(auth(token));
    expect(res.status).toBe(200);
    expect(res.body.email).toBe(payload.email.toLowerCase());
  });

  it('blocks unauthenticated access to protected routes', async () => {
    const res = await ctx.http().get(`${API_PREFIX}/books`);
    expect(res.status).toBe(401);
  });

  it('forbids a student from creating a librarian', async () => {
    const { payload } = await registerStudent(ctx);
    const { token } = await login(ctx, payload.email, payload.password);
    const res = await ctx
      .http()
      .post(`${API_PREFIX}/users/librarians`)
      .set(auth(token))
      .send({
        name: 'X',
        email: `x-${Date.now()}@u.edu`,
        password: 'Librarian@123',
        employeeNumber: `EMP-${Date.now()}`,
      });
    expect(res.status).toBe(403);
  });

  it('lets a librarian create another librarian', async () => {
    const { token } = await createLibrarianAndLogin(ctx);
    const res = await ctx
      .http()
      .post(`${API_PREFIX}/users/librarians`)
      .set(auth(token))
      .send({
        name: 'New Lib',
        email: `newlib-${Date.now()}@u.edu`,
        password: 'Librarian@123',
        employeeNumber: `EMP-${Date.now()}`,
      });
    expect(res.status).toBe(201);
    expect(res.body.role).toBe('LIBRARIAN');
  });

  it('prevents a suspended student from borrowing', async () => {
    const { token: libToken } = await createLibrarianAndLogin(ctx);
    const { payload } = await registerStudent(ctx);
    const { token: studentToken, body: loginBody } = await login(
      ctx,
      payload.email,
      payload.password,
    );
    const studentId = loginBody.user.id;

    // Suspend the student.
    const suspend = await ctx
      .http()
      .patch(`${API_PREFIX}/users/students/${studentId}/suspend`)
      .set(auth(libToken))
      .send({ suspended: true, reason: 'test' });
    expect(suspend.status).toBe(200);

    // Create a book + copy to attempt borrowing.
    const book = await ctx
      .http()
      .post(`${API_PREFIX}/books`)
      .set(auth(libToken))
      .send({ title: 'B', authors: ['A'] });
    const copies = await ctx
      .http()
      .post(`${API_PREFIX}/books/${book.body._id}/copies`)
      .set(auth(libToken))
      .send({ copies: [{ barcode: `BC-${Date.now()}` }] });

    const issue = await ctx
      .http()
      .post(`${API_PREFIX}/loans/issue`)
      .set(auth(studentToken))
      .send({ bookId: book.body._id, copyId: copies.body[0]._id });
    expect(issue.status).toBe(403);
  });
});
