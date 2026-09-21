import { useState } from 'react';
import {
  Mail, Lock, User, Eye, EyeOff,
  ShieldCheck, UserCog,
} from 'lucide-react';
import { StatusDot } from '@/components/Panel';
import type { OperatorProfile } from '@/App';
import { KusogLogo } from '@/components/KusogLogo';
import { supabase } from '@/lib/supabase';

type Props = {
  onLogin: (profile: OperatorProfile) => void;
};

export function AuthScreen({ onLogin }: Props) {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [error, setError] = useState<string | null>(null);
  const [showPw, setShowPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ── Sign-in fields ──────────────────────────────────────────────────────────
  const [siIdentifier, setSiIdentifier] = useState('');
  const [siPassword, setSiPassword]     = useState('');

  // ── Sign-up fields ──────────────────────────────────────────────────────────
  const [suFullName,      setSuFullName]      = useState('');
  const [suEmail,         setSuEmail]         = useState('');
  const [suPassword,      setSuPassword]      = useState('');
  const [suConfirm,       setSuConfirm]       = useState('');

  const switchMode = (m: 'signin' | 'signup') => { setMode(m); setError(null); };

  // ── Handlers ────────────────────────────────────────────────────────────────
  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setError(null);
    const email = siIdentifier.trim();
    if (!email || !siPassword) {
      setError('Please enter your email address and password.');
      return;
    }

    setIsSubmitting(true);
    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password: siPassword });
      if (signInError) {
        setError(signInError.message);
        return;
      }
      if (!data.user) {
        setError('Sign in did not return an authenticated user.');
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('full_name, email')
        .eq('id', data.user.id)
        .single();

      if (profileError) {
        setError(`Authenticated account does not have a profile record yet: ${profileError.message}`);
        return;
      }

      const fullName = profile.full_name?.trim()
        || data.user.user_metadata?.full_name
        || email.split('@')[0];
      const authenticatedEmail = profile.email?.trim() || data.user.email || email;
      onLogin({
        fullName,
        studentNumber: '—',
        role: 'User',
        email: authenticatedEmail,
      });
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to sign in.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setError(null);
    const fullName = suFullName.trim();
    const email = suEmail.trim();
    if (!fullName || !email || !suPassword || !suConfirm) {
      setError('All fields are required.');
      return;
    }
    if (suPassword !== suConfirm) {
      setError('Passwords do not match.');
      return;
    }
    if (suPassword.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setIsSubmitting(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email: email,
        password: suPassword,
        options: {
          data: {
            full_name: fullName,
          },
        },
      });
      if (error) {
        setError(error.message);
        return;
      }

      if (!data.session || !data.user) {
        setError('Account created, but no active session was returned. Please sign in to continue.');
        setMode('signin');
        setSiIdentifier(email);
        return;
      }

      const profileFullName = data.user.user_metadata?.full_name || fullName;
      const profileEmail = data.user.email || email;
      const { error: profileError } = await supabase
        .from('profiles')
        .insert({
          id: data.user.id,
          full_name: profileFullName,
          email: profileEmail,
        });

      if (profileError) {
        setError(
          profileError.code === '23505'
            ? `A profile already exists for this account: ${profileError.message}`
            : profileError.message,
        );
        return;
      }

      onLogin({
        fullName: profileFullName,
        studentNumber: '—',
        role: 'User',
        email: profileEmail,
      });
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to create your account.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-base-900 p-4">
      {/* Ambient blobs */}
      <div className="absolute inset-0 bg-grid opacity-30" />
      <div className="absolute left-1/4 top-1/4 h-96 w-96 rounded-full bg-accent-500/10 blur-[120px]" />
      <div className="absolute bottom-1/4 right-1/4 h-96 w-96 rounded-full bg-ok-500/8 blur-[100px]" />

      <div className="relative w-full max-w-md animate-[fadeIn_0.4s_ease-out]">

        {/* ── Logo area ─────────────────────────────────────────────────────── */}
        <div className="mb-7 flex flex-col items-center gap-3 text-center">
          <div className="grid h-28 w-28 place-items-center">
            <KusogLogo className="h-28 w-28" />
          </div>
          <div>
            <h1 className="font-mono text-2xl font-extrabold tracking-[0.2em] text-white">KUSOG</h1>
            <p className="text-xs tracking-wide text-slate-400">Smart Typhoon Simulation Chamber · v2.4</p>
          </div>
          <div className="flex items-center gap-1.5 rounded-full border border-ok-500/30 bg-ok-500/10 px-3 py-1">
            <StatusDot color="ok" />
            <span className="text-[10px] font-semibold tracking-wider text-ok-400">SYSTEM ONLINE</span>
          </div>
        </div>

        {/* ── Glass card ────────────────────────────────────────────────────── */}
        <div className="rounded-2xl border border-base-600/70 bg-base-850/80 shadow-panel backdrop-blur-md">

          {/* Tab strip */}
          <div className="flex border-b border-base-600/60">
            <TabBtn active={mode === 'signin'} onClick={() => switchMode('signin')}>Sign In</TabBtn>
            <TabBtn active={mode === 'signup'} onClick={() => switchMode('signup')}>Sign Up</TabBtn>
          </div>

          <div className="p-6">
            {error && (
              <div className="mb-4 flex items-start gap-2.5 rounded-lg border border-danger-500/40 bg-danger-500/10 px-3 py-2.5 text-sm text-danger-400">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
                {error}
              </div>
            )}

            {/* ══ SIGN IN ══════════════════════════════════════════════════════ */}
            {mode === 'signin' && (
              <form onSubmit={handleSignIn} className="space-y-4">
                <Field icon={Mail} label="Email Address">
                  <input
                    type="email"
                    value={siIdentifier}
                    onChange={(e) => setSiIdentifier(e.target.value)}
                    placeholder="admin@kusog.lab"
                    className="w-full bg-transparent text-sm text-slate-200 outline-none placeholder:text-slate-600"
                  />
                </Field>

                <Field icon={Lock} label="Password">
                  <div className="flex w-full items-center gap-2">
                    <input
                      type={showPw ? 'text' : 'password'}
                      value={siPassword}
                      onChange={(e) => setSiPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full bg-transparent text-sm text-slate-200 outline-none placeholder:text-slate-600"
                    />
                    <button type="button" onClick={() => setShowPw((s) => !s)} className="shrink-0 text-slate-500 hover:text-accent-400">
                      {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </Field>

                {/* Primary sign-in CTA */}
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex w-full items-center justify-center gap-2 rounded-lg border border-accent-500/40 bg-accent-500/15 py-3 text-sm font-bold uppercase tracking-widest text-accent-400 shadow-glow-accent transition hover:bg-accent-500 hover:text-white"
                >
                  {isSubmitting ? 'Signing In...' : 'Sign In'}
                </button>

              </form>
            )}

            {/* ══ SIGN UP ══════════════════════════════════════════════════════ */}
            {mode === 'signup' && (
              <form onSubmit={handleSignUp} className="space-y-3.5">
                <div className="mb-1 flex items-center gap-2">
                  <UserCog className="h-4 w-4 text-accent-400" />
                  <span className="text-[11px] font-semibold uppercase tracking-widest text-accent-400">
                    Account Registration
                  </span>
                </div>

                {/* Full Name */}
                <Field icon={User} label="Full Name">
                  <input
                    type="text"
                    value={suFullName}
                    onChange={(e) => setSuFullName(e.target.value)}
                    placeholder="e.g. Reyna Ann Joy Nebril Bausin"
                    className="w-full bg-transparent text-sm text-slate-200 outline-none placeholder:text-slate-600"
                  />
                </Field>

                {/* Email */}
                <Field icon={Mail} label="Email Address">
                  <input
                    type="email"
                    value={suEmail}
                    onChange={(e) => setSuEmail(e.target.value)}
                    placeholder="student@university.edu.ph"
                    className="w-full bg-transparent text-sm text-slate-200 outline-none placeholder:text-slate-600"
                  />
                </Field>

                {/* Password row */}
                <div className="grid grid-cols-2 gap-3">
                  <Field icon={Lock} label="Password">
                    <div className="flex w-full items-center gap-1">
                      <input
                        type={showPw ? 'text' : 'password'}
                        value={suPassword}
                        onChange={(e) => setSuPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full bg-transparent text-sm text-slate-200 outline-none placeholder:text-slate-600"
                      />
                      <button type="button" onClick={() => setShowPw((s) => !s)} className="shrink-0 text-slate-500 hover:text-accent-400">
                        {showPw ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                  </Field>
                  <Field icon={Lock} label="Confirm Password">
                    <div className="flex w-full items-center gap-1">
                      <input
                        type={showConfirmPw ? 'text' : 'password'}
                        value={suConfirm}
                        onChange={(e) => setSuConfirm(e.target.value)}
                        placeholder="••••••••"
                        className="w-full bg-transparent text-sm text-slate-200 outline-none placeholder:text-slate-600"
                      />
                      <button type="button" onClick={() => setShowConfirmPw((s) => !s)} className="shrink-0 text-slate-500 hover:text-accent-400">
                        {showConfirmPw ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                  </Field>
                </div>

                {/* Glowing CTA */}
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-lg border border-accent-500/60 bg-gradient-to-r from-accent-600/30 to-accent-500/20 py-3.5 text-sm font-bold uppercase tracking-widest text-accent-300 shadow-glow-accent transition hover:from-accent-500 hover:to-accent-600 hover:text-white"
                >
                  <span className="absolute inset-0 animate-pulse-soft rounded-lg bg-accent-500/10" />
                  <UserCog className="relative h-4 w-4" />
                  <span className="relative">{isSubmitting ? 'Creating Account...' : 'Create Account'}</span>
                </button>
              </form>
            )}
          </div>
        </div>

        <p className="mt-4 text-center text-[10px] text-slate-600">
          KUSOG Control Center v2.4 · Thesis Project · © 2025
        </p>
      </div>
    </div>
  );
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 py-3 text-sm font-semibold transition ${
        active
          ? 'border-b-2 border-accent-500 text-accent-400'
          : 'border-b-2 border-transparent text-slate-400 hover:text-slate-200'
      }`}
    >
      {children}
    </button>
  );
}

function Field({ icon: Icon, label, children }: { icon: React.ElementType; label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-widest text-slate-500">{label}</label>
      <div className="flex items-center gap-2 rounded-lg border border-base-600/70 bg-base-900/60 px-3 py-2.5 transition focus-within:border-accent-500/50">
        <Icon className="h-4 w-4 shrink-0 text-slate-500" />
        {children}
      </div>
    </div>
  );
}

