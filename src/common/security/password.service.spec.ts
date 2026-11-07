import { PasswordService } from './password.service';

describe('PasswordService', () => {
  const service = new PasswordService();

  it('hashes and verifies a correct password', async () => {
    const hash = await service.hash('Str0ng@Pass');
    expect(hash).not.toContain('Str0ng@Pass');
    expect(await service.verify(hash, 'Str0ng@Pass')).toBe(true);
  });

  it('rejects an incorrect password', async () => {
    const hash = await service.hash('Str0ng@Pass');
    expect(await service.verify(hash, 'wrong')).toBe(false);
  });

  it('returns false for a malformed hash instead of throwing', async () => {
    expect(await service.verify('not-a-hash', 'whatever')).toBe(false);
  });
});
