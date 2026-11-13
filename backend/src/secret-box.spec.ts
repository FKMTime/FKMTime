import { decryptSecret, encryptSecret } from './secret-box';

describe('secret box', () => {
  const secret = process.env.SECRET;
  beforeEach(() => {
    process.env.SECRET = 'a-test-secret-that-is-long-enough-for-fkmtime';
  });
  afterEach(() => {
    process.env.SECRET = secret;
  });

  it('gives back what it encrypted, without storing it in the clear', () => {
    const stored = encryptSecret('access-token-123');

    expect(stored).not.toContain('access-token-123');
    expect(decryptSecret(stored)).toBe('access-token-123');
  });

  it('encrypts the same value differently every time', () => {
    expect(encryptSecret('same')).not.toBe(encryptSecret('same'));
  });

  it('returns null for a value encrypted with another SECRET', () => {
    const stored = encryptSecret('access-token-123');
    process.env.SECRET = 'another-secret-that-is-also-long-enough-here';

    expect(decryptSecret(stored)).toBeNull();
  });

  it('returns null for a damaged value', () => {
    expect(decryptSecret('not-a-stored-secret')).toBeNull();
  });
});
