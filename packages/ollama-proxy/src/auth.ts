import { verifyToken as clerkVerifyToken } from '@clerk/backend';

const CLERK_SECRET_KEY = process.env.CLERK_SECRET_KEY;

if (!CLERK_SECRET_KEY) {
  console.warn('Warning: CLERK_SECRET_KEY not configured. Proxy will run without authentication.');
}

export async function verifyToken(token: string | null): Promise<{ userId: string } | null> {
  if (!CLERK_SECRET_KEY) {
    return null; // Allow all requests when Clerk is not configured
  }

  if (!token) {
    return null;
  }

  try {
    const cleanToken = token.replace(/^Bearer\s+/i, '');
    const payload = await clerkVerifyToken(cleanToken, {
      secretKey: CLERK_SECRET_KEY,
    });
    return { userId: payload.sub };
  } catch (error) {
    console.error('Token verification failed:', error);
    return null;
  }
}

export function isAuthEnabled(): boolean {
  return !!CLERK_SECRET_KEY;
}
