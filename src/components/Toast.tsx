import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

type Toast = {
  id: number;
  message: string;
  type: 'success' | 'error' | 'info';
};

type ToastContextValue = {
  toast: (message: string, type?: Toast['type']) => void;
};

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}

let toastId = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toast = useCallback((message: string, type: Toast['type'] = 'success') => {
    const id = ++toastId;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3500);
  }, []);

  const dismiss = (id: number) => setToasts((prev) => prev.filter((t) => t.id !== id));

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="pointer-events-none fixed bottom-6 right-6 z-[100] flex flex-col gap-2">
        {toasts.map((t) => {
          const Icon = t.type === 'success' ? CheckCircle2 : t.type === 'error' ? AlertCircle : Info;
          const color = t.type === 'success' ? 'text-ok-400 border-ok-500/40' : t.type === 'error' ? 'text-danger-400 border-danger-500/40' : 'text-accent-400 border-accent-500/40';
          return (
            <div
              key={t.id}
              className={`pointer-events-auto flex items-center gap-3 rounded-lg border ${color} bg-base-850/95 px-4 py-3 shadow-panel backdrop-blur-md animate-[fadeIn_0.2s_ease-out]`}
            >
              <Icon className="h-5 w-5 shrink-0" />
              <span className="text-sm font-medium text-slate-200">{t.message}</span>
              <button onClick={() => dismiss(t.id)} className="ml-2 text-slate-500 hover:text-white">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}
