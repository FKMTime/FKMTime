import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from 'crypto';

// Secrets FKMTime has to send back later (unlike the hashed device tokens),
// so they are encrypted, with a key derived from the server's SECRET
const key = () => createHash('sha256').update(process.env.SECRET).digest();

/** AES-256-GCM; the result holds the IV, the auth tag and the ciphertext */
export const encryptSecret = (plain: string) => {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(), iv);
  const encrypted = Buffer.concat([
    cipher.update(plain, 'utf8'),
    cipher.final(),
  ]);
  return [iv, cipher.getAuthTag(), encrypted]
    .map((part) => part.toString('base64'))
    .join('.');
};

/** Null when the value is damaged or was encrypted with another SECRET */
export const decryptSecret = (stored: string): string | null => {
  try {
    const [iv, tag, encrypted] = stored
      .split('.')
      .map((part) => Buffer.from(part, 'base64'));
    const decipher = createDecipheriv('aes-256-gcm', key(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ]).toString('utf8');
  } catch {
    return null;
  }
};
