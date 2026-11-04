import { useContext } from 'react';
import { TestSessionContext } from '@/hooks/testSessionContext';

export function useTestSession() {
  const session = useContext(TestSessionContext);
  if (!session) throw new Error('Sensor polling must be used inside TestSessionProvider.');
  return session;
}
