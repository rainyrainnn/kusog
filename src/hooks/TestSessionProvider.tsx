import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { TestSessionContext } from '@/hooks/testSessionContext';

export function TestSessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<{ ready: boolean; recordId: string | null }>({
    ready: false,
    recordId: null,
  });

  const setActiveTest = useCallback((recordId: string) => setSession({ ready: true, recordId }), []);
  const setInactive = useCallback(() => setSession({ ready: true, recordId: null }), []);
  const value = useMemo(() => ({ ...session, setActiveTest, setInactive }), [session, setActiveTest, setInactive]);

  return <TestSessionContext.Provider value={value}>{children}</TestSessionContext.Provider>;
}
