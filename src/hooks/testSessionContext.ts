import { createContext } from 'react';

export type TestSession = {
  ready: boolean;
  recordId: string | null;
  setActiveTest: (recordId: string) => void;
  setInactive: () => void;
};

export const TestSessionContext = createContext<TestSession | null>(null);
