import { useAuth } from '@clerk/clerk-react';
import { useCallback, useMemo } from 'react';

export interface ChatApiEndpoints {
  chat: string;
  models: string;
  conversations: string;
  agents: string;
  teams: string;
}

export interface ChatApi {
  endpoints: ChatApiEndpoints;
  authFetch: (url: string, options?: RequestInit) => Promise<Response>;
}

export function useChatApi(): ChatApi {
  const { getToken } = useAuth();

  const apiBase = import.meta.env.PROD ? 'https://api.thebudimir.com' : 'http://localhost:3000';

  const endpoints = useMemo<ChatApiEndpoints>(
    () => ({
      chat: `${apiBase}/v1/chat`,
      models: `${apiBase}/v1/models`,
      conversations: `${apiBase}/v1/conversations`,
      agents: `${apiBase}/v1/agents`,
      teams: `${apiBase}/v1/teams`,
    }),
    []
  );

  const authFetch = useCallback(
    async (url: string, options: RequestInit = {}) => {
      const token = await getToken();
      const headers = new Headers(options.headers);
      if (token) {
        headers.set('Authorization', `Bearer ${token}`);
      }
      return fetch(url, { ...options, headers });
    },
    [getToken]
  );

  return { endpoints, authFetch };
}
