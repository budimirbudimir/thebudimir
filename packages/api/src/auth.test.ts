import { describe, expect, test, beforeEach, mock } from 'bun:test';

// Mock @clerk/backend before importing auth module
const mockClerkVerifyToken = mock(() => Promise.resolve({ sub: 'user_test123' }));
mock.module('@clerk/backend', () => ({
  verifyToken: mockClerkVerifyToken,
}));

import { isAuthEnabled, verifyToken } from './auth';

describe('Auth Module', () => {
  beforeEach(() => {
    mockClerkVerifyToken.mockClear();
  });

  describe('isAuthEnabled', () => {
    test('returns true when CLERK_SECRET_KEY is set', () => {
      // Auth module reads env var at load time, so we test current state
      const result = isAuthEnabled();
      
      if (process.env.CLERK_SECRET_KEY) {
        expect(result).toBe(true);
      } else {
        expect(result).toBe(false);
      }
    });
  });

  describe('verifyToken', () => {
    test('returns null when token is null', async () => {
      const result = await verifyToken(null);
      expect(result).toBeNull();
      expect(mockClerkVerifyToken).not.toHaveBeenCalled();
    });

    test('returns null when token is empty string', async () => {
      const result = await verifyToken('');
      expect(result).toBeNull();
      expect(mockClerkVerifyToken).not.toHaveBeenCalled();
    });

    test('strips Bearer prefix and verifies token', async () => {
      if (!process.env.CLERK_SECRET_KEY) {
        console.log('⏭️  Skipping test - CLERK_SECRET_KEY not configured');
        return;
      }

      mockClerkVerifyToken.mockResolvedValueOnce({ sub: 'user_456' });
      
      const result = await verifyToken('Bearer test_token_123');
      
      expect(result).toEqual({ userId: 'user_456' });
      expect(mockClerkVerifyToken).toHaveBeenCalledWith('test_token_123', {
        secretKey: process.env.CLERK_SECRET_KEY,
      });
    });

    test('handles token without Bearer prefix', async () => {
      if (!process.env.CLERK_SECRET_KEY) {
        console.log('⏭️  Skipping test - CLERK_SECRET_KEY not configured');
        return;
      }

      mockClerkVerifyToken.mockResolvedValueOnce({ sub: 'user_789' });
      
      const result = await verifyToken('test_token_456');
      
      expect(result).toEqual({ userId: 'user_789' });
      expect(mockClerkVerifyToken).toHaveBeenCalledWith('test_token_456', {
        secretKey: process.env.CLERK_SECRET_KEY,
      });
    });

    test('returns null when verification fails', async () => {
      if (!process.env.CLERK_SECRET_KEY) {
        console.log('⏭️  Skipping test - CLERK_SECRET_KEY not configured');
        return;
      }

      mockClerkVerifyToken.mockRejectedValueOnce(new Error('Invalid token'));
      
      const result = await verifyToken('invalid_token');
      
      expect(result).toBeNull();
    });

    test('returns null when CLERK_SECRET_KEY is not configured', async () => {
      if (process.env.CLERK_SECRET_KEY) {
        console.log('⏭️  Skipping test - CLERK_SECRET_KEY is configured');
        return;
      }
      
      const result = await verifyToken('Bearer test_token');
      
      expect(result).toBeNull();
      expect(mockClerkVerifyToken).not.toHaveBeenCalled();
    });
  });
});
