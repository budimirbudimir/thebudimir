import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto';

/**
 * Encryption configuration using AES-256-GCM
 * - AES-256-GCM provides both confidentiality and integrity
 * - GCM mode is authenticated encryption
 */
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16; // 16 bytes for GCM
const AUTH_TAG_LENGTH = 16; // 16 bytes authentication tag
const SALT_LENGTH = 32; // 32 bytes salt for key derivation
const KEY_LENGTH = 32; // 256 bits for AES-256

/**
 * Get the encryption key from environment variable
 * Uses scrypt to derive a key from the password if needed
 */
function getEncryptionKey(): Buffer {
  const key = process.env.MESSAGE_ENCRYPTION_KEY;
  if (!key) {
    throw new Error('MESSAGE_ENCRYPTION_KEY environment variable is not set');
  }

  // If the key is already 64 hex chars (32 bytes), use it directly
  if (key.length === 64) {
    return Buffer.from(key, 'hex');
  }

  // Otherwise, derive a key from the password using scrypt
  const salt = Buffer.alloc(SALT_LENGTH);
  return scryptSync(key, salt, KEY_LENGTH);
}

/**
 * Encrypts a plaintext string using AES-256-GCM
 * Returns a hex string containing: salt + iv + authTag + ciphertext
 */
export function encrypt(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);

  const cipher = createCipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });

  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);

  const authTag = cipher.getAuthTag();

  // Format: iv (16) + authTag (16) + ciphertext
  // We don't need to store salt since we're using a fixed key from env
  return Buffer.concat([iv, authTag, encrypted]).toString('hex');
}

/**
 * Decrypts a hex string that was encrypted with encrypt()
 */
export function decrypt(encryptedHex: string): string {
  const key = getEncryptionKey();
  const data = Buffer.from(encryptedHex, 'hex');

  // Extract iv, authTag, and ciphertext
  const iv = data.subarray(0, IV_LENGTH);
  const authTag = data.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const ciphertext = data.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

  const decipher = createDecipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });

  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);

  return decrypted.toString('utf8');
}

/**
 * Check if encryption is configured and available
 */
export function isEncryptionConfigured(): boolean {
  return !!process.env.MESSAGE_ENCRYPTION_KEY;
}
