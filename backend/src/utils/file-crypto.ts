import crypto from 'crypto';
import fs from 'fs';
import { AppError } from './response';

const ALGO = 'aes-256-gcm';
const IV_LEN = 12;
const TAG_LEN = 16;

function getKey(): Buffer | null {
  const raw = process.env.DOCUMENT_ENCRYPTION_KEY || process.env.DATA_ENCRYPTION_KEY;
  if (!raw) return null;
  // Accept 64-char hex or any string hashed to 32 bytes
  if (/^[0-9a-fA-F]{64}$/.test(raw)) return Buffer.from(raw, 'hex');
  return crypto.createHash('sha256').update(raw).digest();
}

export function isEncryptionConfigured(): boolean {
  return getKey() !== null;
}

/** Encrypt a file in place (writes .enc sibling and removes plaintext). Returns new path. */
export function encryptFileAtRest(filePath: string): { path: string; encrypted: boolean } {
  const key = getKey();
  if (!key) return { path: filePath, encrypted: false };

  const plaintext = fs.readFileSync(filePath);
  const iv = crypto.randomBytes(IV_LEN);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  const payload = Buffer.concat([iv, tag, encrypted]);
  const encPath = `${filePath}.enc`;
  fs.writeFileSync(encPath, payload);
  fs.unlinkSync(filePath);
  return { path: encPath, encrypted: true };
}

export function decryptFileToBuffer(filePath: string, encrypted: boolean): Buffer {
  const data = fs.readFileSync(filePath);
  if (!encrypted) return data;

  const key = getKey();
  if (!key) throw new AppError(500, 'Encrypted document cannot be read — DOCUMENT_ENCRYPTION_KEY is not set');

  const iv = data.subarray(0, IV_LEN);
  const tag = data.subarray(IV_LEN, IV_LEN + TAG_LEN);
  const ciphertext = data.subarray(IV_LEN + TAG_LEN);
  const decipher = crypto.createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}

/** Encrypt a short secret (e.g. webhook signing key) for DB storage. Prefix enc:v1: */
export function encryptSecret(plaintext: string): string {
  const key = getKey();
  if (!key) {
    // Dev fallback: store with clear prefix so we know it's not hashed
    return `plain:${plaintext}`;
  }
  const iv = crypto.randomBytes(IV_LEN);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `enc:v1:${Buffer.concat([iv, tag, enc]).toString('base64')}`;
}

export function decryptSecret(stored: string): string {
  if (stored.startsWith('plain:')) return stored.slice(6);
  if (!stored.startsWith('enc:v1:')) {
    // Legacy plaintext webhook secrets
    return stored;
  }
  const key = getKey();
  if (!key) throw new AppError(500, 'Cannot decrypt secret — DOCUMENT_ENCRYPTION_KEY is not set');
  const raw = Buffer.from(stored.slice(7), 'base64');
  const iv = raw.subarray(0, IV_LEN);
  const tag = raw.subarray(IV_LEN, IV_LEN + TAG_LEN);
  const ciphertext = raw.subarray(IV_LEN + TAG_LEN);
  const decipher = crypto.createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}
