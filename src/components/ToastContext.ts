import { createContext, useContext } from 'react';

type ToastType = 'success' | 'error' | 'info';

export type ToastContextValue = {
  toast: (message: string, type?: ToastType) => void;
};

export const ToastContext = createContext<ToastContextValue | undefined>(undefined);

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used within ToastProvider');
  return context;
}