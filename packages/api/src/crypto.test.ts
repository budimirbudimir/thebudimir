import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { decrypt, encrypt, isEncryptionConfigured } from './crypto';

// A valid 64-character hex key (32 bytes)
const TEST_HEX_KEY = 'a'.repeat(64);
// A non-hex passphrase
const TEST_PASSPHRASE = 'my-secret-passphrase';

describe('Crypto Module', () => {
  const originalEnv = process.env.MESSAGE_ENCRYPTION_KEY;

  afterEach(() => {
    // Restore original env
    if (originalEnv !== undefined) {
      process.env.MESSAGE_ENCRYPTION_KEY = originalEnv;
    } else {
      delete process.env.MESSAGE_ENCRYPTION_KEY;
    }
  });

  describe('encrypt and decrypt', () => {
    beforeEach(() => {
      process.env.MESSAGE_ENCRYPTION_KEY = TEST_HEX_KEY;
    });

    test('correctly encrypts and decrypts a plaintext string', () => {
      const plaintext = 'Hello, world! This is a secret message.';
      const encrypted = encrypt(plaintext);

      expect(encrypted).not.toBe(plaintext);
      expect(typeof encrypted).toBe('string');
      // Encrypted output should be a hex string
      expect(encrypted).toMatch(/^[0-9a-f]+$/);

      const decrypted = decrypt(encrypted);
      expect(decrypted).toBe(plaintext);
    });

    test('handles empty strings', () => {
      const plaintext = '';
      const encrypted = encrypt(plaintext);

      expect(encrypted).not.toBe('');
      // Should still contain iv (16) + authTag (16) = 32 bytes = 64 hex chars minimum
      expect(encrypted.length).toBeGreaterThanOrEqual(64);

      const decrypted = decrypt(encrypted);
      expect(decrypted).toBe('');
    });

    test('produces different ciphertext for the same plaintext (random IV)', () => {
      const plaintext = 'same input';
      const encrypted1 = encrypt(plaintext);
      const encrypted2 = encrypt(plaintext);

      expect(encrypted1).not.toBe(encrypted2);

      expect(decrypt(encrypted1)).toBe(plaintext);
      expect(decrypt(encrypted2)).toBe(plaintext);
    });

    test('works with a non-hex passphrase key', () => {
      process.env.MESSAGE_ENCRYPTION_KEY = TEST_PASSPHRASE;

      const plaintext = 'encrypted with passphrase';
      const encrypted = encrypt(plaintext);
      const decrypted = decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
    });
  });

  describe('getEncryptionKey (via encrypt/decrypt)', () => {
    test('throws when MESSAGE_ENCRYPTION_KEY is not set', () => {
      delete process.env.MESSAGE_ENCRYPTION_KEY;

      expect(() => encrypt('test')).toThrow(
        'MESSAGE_ENCRYPTION_KEY environment variable is not set'
      );
      expect(() => decrypt('aa'.repeat(32))).toThrow(
        'MESSAGE_ENCRYPTION_KEY environment variable is not set'
      );
    });

    test('derives key from a 64-character hex string', () => {
      process.env.MESSAGE_ENCRYPTION_KEY = TEST_HEX_KEY;

      const plaintext = 'hex key test';
      const encrypted = encrypt(plaintext);
      expect(decrypt(encrypted)).toBe(plaintext);
    });

    test('derives key from a non-hex string using scryptSync', () => {
      process.env.MESSAGE_ENCRYPTION_KEY = TEST_PASSPHRASE;

      const plaintext = 'scrypt key test';
      const encrypted = encrypt(plaintext);
      expect(decrypt(encrypted)).toBe(plaintext);

      // Verify a different passphrase cannot decrypt
      process.env.MESSAGE_ENCRYPTION_KEY = 'different-passphrase';
      expect(() => decrypt(encrypted)).toThrow();
    });
  });

  describe('isEncryptionConfigured', () => {
    test('returns true when MESSAGE_ENCRYPTION_KEY is set', () => {
      process.env.MESSAGE_ENCRYPTION_KEY = TEST_HEX_KEY;
      expect(isEncryptionConfigured()).toBe(true);
    });

    test('returns false when MESSAGE_ENCRYPTION_KEY is not set', () => {
      delete process.env.MESSAGE_ENCRYPTION_KEY;
      expect(isEncryptionConfigured()).toBe(false);
    });
  });
});
