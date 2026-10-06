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
import { SystemStatus } from '@/components/panels/SystemStatus';
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
  const sim = useSimulation({ rainSensor, loadCell, windSensor });
  const [route, setRoute] = useState<RouteId>('dashboard');

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-base-900 text-slate-200">
      <Header sim={sim} profile={profile} onSignOut={onSignOut} />
      <div className="flex min-h-0 flex-1">
        <Sidebar sim={sim} route={route} onNavigate={setRoute} />
        <main className="min-h-0 flex-1 overflow-y-auto bg-grid">
          <div className="p-4">
            {route === 'dashboard' && <div className="mb-3"><SystemStatus /></div>}
            <div key={route} className="animate-[fadeIn_0.25s_ease-out]">
              {route === 'dashboard'    && <DashboardView sim={sim} rainSensor={rainSensor} sensorError={rainSensorError} sensorLoading={rainSensorLoading} onNavigate={setRoute} />}
              {route === 'camera'       && <CameraView sim={sim} />}
              {route === 'environment'  && <EnvironmentView sim={sim} />}
              {route === 'controls'     && <ControlsView sim={sim} rainSensor={rainSensor} sensorError={rainSensorError} sensorLoading={rainSensorLoading} />}
              {route === 'graphs'       && <GraphsView sim={sim} />}
              {route === 'ai'           && <AiView sim={sim} />}
              {route === 'log'          && <LogView sim={sim} />}
              {route === 'reports'      && <ReportsView sim={sim} />}
              {route === 'settings'     && <SettingsView sim={sim} />}
            </div>
            <footer className="mt-4 flex items-center justify-between px-2 py-2 text-[10px] text-slate-600">
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
