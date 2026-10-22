import { useEffect, type ReactNode } from 'react';
import { X } from 'lucide-react';

export function Modal({ open, onClose, title, icon, children, maxWidth = 'max-w-lg' }: {
  open: boolean;
  onClose: () => void;
  title: string;
  icon?: ReactNode;
  children: ReactNode;
  maxWidth?: string;
}) {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-[fadeIn_0.15s_ease-out]" onClick={onClose} />
      <div className={`relative w-full ${maxWidth} animate-[fadeIn_0.2s_ease-out] rounded-2xl border border-base-600/70 bg-base-850/95 shadow-panel backdrop-blur-md`}>
        <header className="flex items-center justify-between border-b border-base-600/60 px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            {icon && <span className="text-accent-400">{icon}</span>}
            <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-white">{title}</h2>
          </div>
          <button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 transition hover:bg-base-700/60 hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </header>
        <div className="max-h-[75vh] overflow-y-auto p-5">{children}</div>
      </div>
    </div>
  );
}
