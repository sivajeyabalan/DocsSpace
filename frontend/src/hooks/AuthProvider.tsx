import {
  useCallback,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';
import * as api from '../api/client';
import type { AuthPayload } from '../types/auth';
import { AuthContext, type AuthContextValue, STORAGE_KEY, type Session } from './auth-context';

function readInitialSession(): Session {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as AuthPayload;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session>(() => readInitialSession());

  const persistSession = useCallback((nextSession: Session) => {
    setSession(nextSession);
    if (nextSession) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(nextSession));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  const register = useCallback(
    async (input: {
      email: string;
      password: string;
      tenantName: string;
      tenantSlug: string;
    }) => {
      const nextSession = await api.register(input);
      persistSession(nextSession);
    },
    [persistSession],
  );

  const login = useCallback(
    async (input: {
      email: string;
      password: string;
      tenantSlug: string;
    }) => {
      const nextSession = await api.login(input);
      persistSession(nextSession);
    },
    [persistSession],
  );

  const registerFromInvite = useCallback(
    async (input: {
      email: string;
      password: string;
      token: string;
    }) => {
      const nextSession = await api.registerFromInvite(input);
      persistSession(nextSession);
    },
    [persistSession],
  );

  const logout = useCallback(async () => {
    if (session) {
      await api
        .logout(session.refreshToken, session.accessToken, session.tenant.slug)
        .catch(() => undefined);
    }
    persistSession(null);
  }, [persistSession, session]);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      isAuthenticated: Boolean(session?.accessToken),
      register,
      login,
      registerFromInvite,
      logout,
    }),
    [session, register, login, registerFromInvite, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
