/**
 * AES-256-GCM encryption utility for sensitive fields stored in the database.
 *
 * Usage:
 *   const encrypted = encrypt(rawSecret);
 *   const raw       = decrypt(encrypted);
 *
 * Environment variable required:
 *   ENCRYPTION_KEY = 64-character hex string (32 bytes)
 *   Generate with: openssl rand -hex 32
 *
 * Encrypted format: iv:authTag:ciphertext (all hex-encoded, colon-separated)
 */

import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';

const getKey = (): Buffer => {
  const hex = process.env.ENCRYPTION_KEY;
  if (!hex || hex.length !== 64) {
    throw new Error('[Encryption] ENCRYPTION_KEY must be a 64-char hex string (32 bytes). Generate with: openssl rand -hex 32');
  }
  return Buffer.from(hex, 'hex');
};

/**
 * Encrypts a plaintext string.
 * Returns null if input is null/undefined (passthrough for optional fields).
 */
export const encrypt = (plain: string | null | undefined): string | null => {
  if (plain == null || plain === '') return null;
  const key = getKey();
  const iv = randomBytes(12); // 96-bit IV for GCM
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${ciphertext.toString('hex')}`;
};

/**
 * Decrypts an encrypted string produced by `encrypt()`.
 * Returns null if input is null/undefined.
 */
export const decrypt = (encrypted: string | null | undefined): string | null => {
  if (encrypted == null || encrypted === '') return null;
  // If the value doesn't look like an encrypted payload, return as-is (migration passthrough)
  if (!encrypted.includes(':')) return encrypted;
  const key = getKey();
  const parts = encrypted.split(':');
  if (parts.length !== 3) return encrypted;
  const [ivHex, authTagHex, ciphertextHex] = parts;
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const ciphertext = Buffer.from(ciphertextHex, 'hex');
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
};

/**
 * Returns true if the value looks like an encrypted blob.
 * Useful for detecting un-migrated legacy data.
 */
export const isEncrypted = (value: string | null | undefined): boolean => {
  if (!value) return false;
  const parts = value.split(':');
  return parts.length === 3 && parts[0].length === 24; // 12-byte IV = 24 hex chars
};
