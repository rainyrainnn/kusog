import { useEffect, useState } from 'react';
import { useSimulation } from '@/hooks/useSimulation';
import { Header } from '@/components/Header';
import { Sidebar, type RouteId } from '@/components/Sidebar';
import { DashboardView } from '@/components/views/DashboardView';
import { CameraView } from '@/components/views/CameraView';
import { EnvironmentView } from '@/components/views/EnvironmentView';
import { ControlsView } from '@/components/views/ControlsView';
import { GraphsView } from '@/components/views/GraphsView';
import { AiView } from '@/components/views/AiView';
import { LogView } from '@/components/views/LogView';
import { ReportsView } from '@/components/views/ReportsView';
import { SettingsView } from '@/components/views/SettingsView';
import { ToastProvider } from '@/components/Toast';
import { AuthScreen } from '@/components/AuthScreen';
import { supabase } from '@/lib/supabase';
import { useRainSensor } from '@/lib/rainSensor';
import { useLoadCell } from '@/lib/loadCell';
import { useWindSensor } from '@/lib/windSensor';

export type OperatorProfile = {
  fullName: string;
  studentNumber: string;
  role: string;
  email: string;
};

function Dashboard({ profile, onSignOut }: { profile: OperatorProfile; onSignOut: () => void }) {
  const { data: rainSensor, error: rainSensorError, loading: rainSensorLoading } = useRainSensor();
  const loadCell = useLoadCell();
  const windSensor = useWindSensor();
  const sim = useSimulation({ loadCell, windSensor });
  const [route, setRoute] = useState<RouteId>('dashboard');

  return (
    <div className="dashboard-shell flex min-h-screen flex-col text-slate-100 md:h-screen md:overflow-hidden">
      <Header sim={sim} profile={profile} onSignOut={onSignOut} route={route} />
      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        <Sidebar sim={sim} route={route} onNavigate={setRoute} />
        <main className="dashboard-main min-h-0 min-w-0 flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-[1600px] p-3 sm:p-4 xl:p-5">
            <div key={route} className="animate-[fadeIn_0.25s_ease-out]">
              {route === 'dashboard'    && <DashboardView sim={sim} rainSensor={rainSensor} sensorError={rainSensorError} sensorLoading={rainSensorLoading} onNavigate={setRoute} />}
              {route === 'camera'       && <CameraView />}
              {route === 'environment'  && <EnvironmentView />}
              {route === 'controls'     && <ControlsView sim={sim} rainSensor={rainSensor} sensorError={rainSensorError} sensorLoading={rainSensorLoading} />}
              {route === 'graphs'       && <GraphsView sim={sim} />}
              {route === 'ai'           && <AiView sim={sim} />}
              {route === 'log'          && <LogView sim={sim} />}
              {route === 'reports'      && <ReportsView />}
              {route === 'settings'     && <SettingsView sim={sim} />}
            </div>
            <footer className="mt-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-t border-sky-200/15 px-2 py-3 text-[10px] text-slate-400">
              <span>KUSOG Smart Typhoon Simulation Chamber · Control Center v2.4</span>
              <span className="font-mono">© 2026 · Thesis Project · Rain sensor {rainSensorLoading ? 'loading' : rainSensorError ? 'error' : rainSensor.connected ? 'online' : rainSensor.offline ? 'offline' : 'waiting'}</span>
            </footer>
          </div>
        </main>
      </div>
    </div>
  );
}

function App() {
  const [profile, setProfile] = useState<OperatorProfile | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const restoreSession = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;

        if (!data.session) {
          if (active) setProfile(null);
          return;
        }

        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('full_name, email')
          .eq('id', data.session.user.id)
          .single();

        if (profileError) throw profileError;

        if (active) {
          setProfile({
            fullName: profile.full_name || data.session.user.user_metadata?.full_name || data.session.user.email?.split('@')[0] || 'User',
            studentNumber: '—',
            role: 'User',
            email: profile.email || data.session.user.email || '—',
          });
        }
      } catch (error) {
        console.error('Unable to restore Supabase authentication:', error);
        if (active) setProfile(null);
      } finally {
        if (active) setAuthLoading(false);
      }
    };

    const { data: authListener } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT' && active) setProfile(null);
    });

    restoreSession();

    return () => {
      active = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setProfile(null);
  };

  return (
    <ToastProvider>
      {authLoading ? (
        <div className="flex min-h-screen items-center justify-center bg-base-900 text-center text-slate-300">
          <div>
            <p className="font-mono text-2xl font-extrabold tracking-[0.2em] text-white">KUSOG</p>
            <p className="mt-2 text-xs tracking-wide text-slate-400">Checking authentication...</p>
          </div>
        </div>
      ) : profile === null ? (
        <AuthScreen onLogin={setProfile} />
      ) : (
        <Dashboard profile={profile} onSignOut={handleSignOut} />
      )}
    </ToastProvider>
  );
}

export default App;
