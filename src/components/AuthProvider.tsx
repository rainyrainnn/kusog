import { useEffect, useState, useCallback, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { AuthContext, DEFAULT_PROFILE, type UserProfile, type SignUpData, type AuthContextValue } from '@/hooks/useAuth';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Safety timeout — if Supabase is unreachable, still show the auth screen
    const timeout = setTimeout(() => setLoading(false), 3000);

    supabase.auth.getSession().then(({ data }) => {
      clearTimeout(timeout);
      setSession(data.session);
      setUser(data.session?.user ?? null);
      if (data.session) setProfile(buildProfile(data.session.user));
      setLoading(false);
    }).catch(() => {
      clearTimeout(timeout);
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, sess) => {
      setSession(sess);
      setUser(sess?.user ?? null);
      if (sess) {
        setProfile(buildProfile(sess.user));
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    return () => {
      clearTimeout(timeout);
      listener.subscription.unsubscribe();
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error ? error.message : null };
  }, []);

  const signUp = useCallback(async (data: SignUpData) => {
    const { error } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
      options: {
        data: {
          full_name: data.fullName,
          operator_id: data.operatorId,
          role: data.role,
        },
      },
    });
    return { error: error ? error.message : null };
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setSession(null);
    setUser(null);
    setProfile(null);
  }, []);

  const value: AuthContextValue = { session, user, profile, loading, signIn, signUp, signOut };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

function buildProfile(user: User): UserProfile {
  const meta = user.user_metadata ?? {};
  const fullName = meta.full_name || DEFAULT_PROFILE.fullName;
  const role = meta.role || DEFAULT_PROFILE.role;
  const operatorId = meta.operator_id || DEFAULT_PROFILE.operatorId;
  return {
    fullName,
    role,
    operatorId,
    institution: DEFAULT_PROFILE.institution,
    station: DEFAULT_PROFILE.station,
    permissions: DEFAULT_PROFILE.permissions,
  };
}
