import { AppSettings, UserData } from '../types';

export interface AccountPayload {
  token?: string;
  user: UserData;
  settings: AppSettings;
  hasProfile: boolean;
}

const parseResponse = async (response: Response) => {
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || 'Request failed');
  }

  return data;
};

export const loginAccount = async (email: string, password: string): Promise<AccountPayload> => {
  const response = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  return parseResponse(response);
};

export const loadAccount = async (token: string): Promise<AccountPayload> => {
  const response = await fetch('/api/profile', {
    headers: { authorization: `Bearer ${token}` },
  });

  return parseResponse(response);
};

export const saveAccount = async (
  token: string,
  user: UserData,
  settings: AppSettings,
): Promise<AccountPayload> => {
  const response = await fetch('/api/profile', {
    method: 'PUT',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ user, settings }),
  });

  return parseResponse(response);
};

export const logoutAccount = async (token: string) => {
  await fetch('/api/auth/logout', {
    method: 'POST',
    headers: { authorization: `Bearer ${token}` },
  }).catch(() => {});
};

export const requestPasswordReset = async (email: string) => {
  const response = await fetch('/api/auth/password-reset/request', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email }),
  });

  return parseResponse(response);
};

export const confirmPasswordReset = async (email: string, token: string, password: string) => {
  const response = await fetch('/api/auth/password-reset/confirm', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, token, password }),
  });

  return parseResponse(response);
};
