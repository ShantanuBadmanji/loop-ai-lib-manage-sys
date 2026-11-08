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

describe('Catalogue & inventory (e2e)', () => {
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

  it('searches books by a meaningful title word (q uses MongoDB $text)', async () => {
    // $text matches whole words and stems; stop words like "the" are excluded by the engine.
    await createBook(ctx, libToken, { title: 'Algorithms Unlocked', authors: ['Cormen'], isbn: undefined });
    await createBook(ctx, libToken, { title: 'Introduction to Algorithms', authors: ['Cormen'], isbn: undefined });
    await createBook(ctx, libToken, { title: 'Clean Code', authors: ['Martin'], isbn: undefined });

    const res = await ctx
      .http()
      .get(`${API_PREFIX}/books?q=algorithm`)
      .set(auth(libToken));
    expect(res.status).toBe(200);
    // $text stems "algorithm" to match "Algorithms" in both titles.
    expect(res.body.total).toBe(2);
    const titles: string[] = res.body.items.map((b: { title: string }) => b.title);
    expect(titles).toContain('Algorithms Unlocked');
    expect(titles).toContain('Introduction to Algorithms');
  });

  it('searches books by author name via q', async () => {
    await createBook(ctx, libToken, { title: 'Clean Code', authors: ['Robert Martin'], isbn: undefined });
    await createBook(ctx, libToken, { title: 'Clean Architecture', authors: ['Robert Martin'], isbn: undefined });
    await createBook(ctx, libToken, { title: 'SICP', authors: ['Abelson'], isbn: undefined });

    const res = await ctx
      .http()
      .get(`${API_PREFIX}/books?q=Martin`)
      .set(auth(libToken));
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(2);
  });

  it('returns empty results for a query with no matches', async () => {
    await createBook(ctx, libToken, { title: 'Clean Code', authors: ['Robert Martin'], isbn: undefined });
    const res = await ctx
      .http()
      .get(`${API_PREFIX}/books?q=zzznomatch`)
      .set(auth(libToken));
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(0);
    expect(res.body.items).toHaveLength(0);
  });

  it('rejects a duplicate ISBN with 409', async () => {
    const isbn = `978${Date.now()}`;
    await createBook(ctx, libToken, { isbn });
    const res = await ctx
      .http()
      .post(`${API_PREFIX}/books`)
      .set(auth(libToken))
      .send({ title: 'Dup', authors: ['A'], isbn });
    expect(res.status).toBe(409);
  });

  it('allows multiple books without an ISBN', async () => {
    const a = await createBook(ctx, libToken, { isbn: undefined });
    const b = await createBook(ctx, libToken, { isbn: undefined });
    expect(a._id).toBeDefined();
    expect(b._id).toBeDefined();
  });

  it('rejects a duplicate barcode with 409', async () => {
    const book = await createBook(ctx, libToken);
    const barcode = `BC-${Date.now()}`;
    await addCopies(ctx, libToken, book._id, [barcode]);
    const res = await ctx
      .http()
      .post(`${API_PREFIX}/books/${book._id}/copies`)
      .set(auth(libToken))
      .send({ copies: [{ barcode }] });
    expect(res.status).toBe(409);
  });

  it('adds multiple copies and derives availability', async () => {
    const book = await createBook(ctx, libToken);
    await addCopies(ctx, libToken, book._id, ['A1', 'A2', 'A3']);
    const res = await ctx
      .http()
      .get(`${API_PREFIX}/books/${book._id}/availability`)
      .set(auth(libToken));
    expect(res.status).toBe(200);
    expect(res.body.totalCopies).toBe(3);
    expect(res.body.available).toBe(3);
    expect(res.body.earliestExpectedReturn).toBeNull();
  });

  it('forbids a student from creating a book', async () => {
    const { payload } = await registerStudent(ctx);
    const { token } = await login(ctx, payload.email, payload.password);
    const res = await ctx
      .http()
      .post(`${API_PREFIX}/books`)
      .set(auth(token))
      .send({ title: 'X', authors: ['A'] });
    expect(res.status).toBe(403);
  });

  it('archives a book and blocks new issues while keeping the record', async () => {
    const book = await createBook(ctx, libToken);
    const [copy] = await addCopies(ctx, libToken, book._id, ['AR1']);
    const { payload } = await registerStudent(ctx);
    const { token: studentToken, body } = await login(
      ctx,
      payload.email,
      payload.password,
    );

    const archive = await ctx
      .http()
      .post(`${API_PREFIX}/books/${book._id}/archive`)
      .set(auth(libToken))
      .send({ reason: 'superseded' });
    expect(archive.status).toBe(201);

    // Record still retrievable.
    const get = await ctx
      .http()
      .get(`${API_PREFIX}/books/${book._id}`)
      .set(auth(libToken));
    expect(get.body.status).toBe('ARCHIVED');

    // New issue blocked.
    const issue = await ctx
      .http()
      .post(`${API_PREFIX}/loans/issue`)
      .set(auth(libToken))
      .send({ bookId: book._id, copyId: copy._id, borrowerId: body.user.id });
    expect(issue.status).toBe(409);
    // studentToken retained for symmetry; not needed further.
    expect(studentToken).toBeDefined();
  });
});
