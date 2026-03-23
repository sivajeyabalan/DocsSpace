import { createContext } from 'react';
import type { AuthPayload } from '../types/auth';

type Session = AuthPayload | null;

export type AuthContextValue = {
  session: Session;
  isAuthenticated: boolean;
  register: (input: {
    email: string;
    password: string;
    tenantName: string;
    tenantSlug: string;
  }) => Promise<void>;
  login: (input: {
    email: string;
    password: string;
    tenantSlug: string;
  }) => Promise<void>;
  registerFromInvite: (input: {
    email: string;
    password: string;
    token: string;
  }) => Promise<void>;
  logout: () => Promise<void>;
};

export const STORAGE_KEY = 'docspace.session';
export const AuthContext = createContext<AuthContextValue | null>(null);

export type { Session };
