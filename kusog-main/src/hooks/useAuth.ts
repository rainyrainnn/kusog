import { createContext, useContext } from 'react';
import type { Session, User } from '@supabase/supabase-js';

export type UserProfile = {
  fullName: string;
  role: string;
  operatorId: string;
  institution: string;
  station: string;
  permissions: string;
};

export type AuthContextValue = {
  session: Session | null;
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (data: SignUpData) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
};

export type SignUpData = {
  fullName: string;
  operatorId: string;
  email: string;
  password: string;
  role: string;
};

export const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

export const DEFAULT_PROFILE: UserProfile = {
  fullName: 'Reyna Ann Joy Nebril Bausin',
  role: 'Lead Research Engineer',
  operatorId: 'OP-2026-8804',
  institution: 'KUSOG Typhoon Chamber Thesis',
  station: 'CHAMBER-NODE-01',
  permissions: 'Level 3',
};
