import { redact } from './redact';

describe('redact', () => {
  it('redacts sensitive keys at any depth', () => {
    const input = {
      email: 'a@b.com',
      password: 'secret',
      nested: { passwordHash: 'h', token: 't', keep: 1 },
      list: [{ accessToken: 'x' }],
    };
    const out = redact(input) as any;
    expect(out.email).toBe('a@b.com');
    expect(out.password).toBe('[REDACTED]');
    expect(out.nested.passwordHash).toBe('[REDACTED]');
    expect(out.nested.token).toBe('[REDACTED]');
    expect(out.nested.keep).toBe(1);
    expect(out.list[0].accessToken).toBe('[REDACTED]');
  });

  it('is case-insensitive and leaves primitives untouched', () => {
    expect(redact('plain')).toBe('plain');
    expect((redact({ Password: 'p' }) as any).Password).toBe('[REDACTED]');
  });
});
