import * as CryptoJS from 'crypto-js';

/**
 * A scramble as the import encrypted it with the set's password, or null
 * when the password is wrong. A wrong password often decrypts to bytes that
 * are not valid UTF-8, which makes toString throw instead of returning
 * garbage; otherwise it gives text that isn't a scramble.
 */
export const decryptScramble = (
  encrypted: string,
  password: string,
): string | null => {
  let text: string;
  try {
    text = CryptoJS.AES.decrypt(encrypted, password).toString(
      CryptoJS.enc.Utf8,
    );
  } catch {
    return null;
  }
  return text && text.includes(' ') ? text : null;
};
