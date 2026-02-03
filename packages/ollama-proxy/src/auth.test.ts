import { describe, expect, test, beforeEach, mock } from 'bun:test';

// Mock @clerk/backend before importing auth module
const mockClerkVerifyToken = mock(() => Promise.resolve({ sub: 'user_test123' }));
mock.module('@clerk/backend', () => ({
  verifyToken: mockClerkVerifyToken,
}));

import { isAuthEnabled, verifyToken } from './auth';

describe('Ollama Proxy Auth Module', () => {
  beforeEach(() => {
    mockClerkVerifyToken.mockClear();
  });

  describe('isAuthEnabled', () => {
    test('returns correct value based on CLERK_SECRET_KEY', () => {
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

      mockClerkVerifyToken.mockResolvedValueOnce({ sub: 'user_proxy_123' });
      
      const result = await verifyToken('Bearer proxy_token_abc');
      
      expect(result).toEqual({ userId: 'user_proxy_123' });
      expect(mockClerkVerifyToken).toHaveBeenCalledWith('proxy_token_abc', {
        secretKey: process.env.CLERK_SECRET_KEY,
      });
    });

    test('handles token without Bearer prefix', async () => {
      if (!process.env.CLERK_SECRET_KEY) {
        console.log('⏭️  Skipping test - CLERK_SECRET_KEY not configured');
        return;
      }

      mockClerkVerifyToken.mockResolvedValueOnce({ sub: 'user_direct_token' });
      
      const result = await verifyToken('direct_token_xyz');
      
      expect(result).toEqual({ userId: 'user_direct_token' });
      expect(mockClerkVerifyToken).toHaveBeenCalledWith('direct_token_xyz', {
        secretKey: process.env.CLERK_SECRET_KEY,
      });
    });

    test('returns null when verification fails', async () => {
      if (!process.env.CLERK_SECRET_KEY) {
        console.log('⏭️  Skipping test - CLERK_SECRET_KEY not configured');
        return;
      }

      mockClerkVerifyToken.mockRejectedValueOnce(new Error('Token expired'));
      
      const result = await verifyToken('expired_token');
      
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
