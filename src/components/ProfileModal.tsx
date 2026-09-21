import { User, ShieldCheck, Building2, Cpu, Contact, Award } from 'lucide-react';
import { Modal } from '@/components/Modal';
import { DEFAULT_PROFILE } from '@/hooks/useAuth';
import { StatusDot } from '@/components/Panel';
import type { OperatorProfile } from '@/App';

type Props = {
  open: boolean;
  onClose: () => void;
  profile?: OperatorProfile;
};

export function ProfileModal({ open, onClose, profile }: Props) {
  const fallback = DEFAULT_PROFILE;

  const fullName      = profile?.fullName      ?? fallback.fullName;
  const role          = profile?.role          ?? fallback.role;
  const studentNumber = profile?.studentNumber ?? fallback.operatorId;
  const email         = profile?.email         ?? 'admin@kusog.lab';

  const rows = [
    { icon: User,      label: 'Full Name',      value: fullName },
    { icon: Award,     label: 'Role',           value: role },
    { icon: Contact,   label: 'Student Number', value: studentNumber },
    { icon: Building2, label: 'Institution',    value: fallback.institution },
    { icon: Cpu,       label: 'Active Station', value: fallback.station },
  ];

  return (
    <Modal open={open} onClose={onClose} title="Operator Profile" icon={<User className="h-4 w-4" />} maxWidth="max-w-lg">
      <div className="space-y-4">
        <div className="flex items-center gap-4 rounded-xl border border-base-600/70 bg-base-900/50 p-4">
          <div className="grid h-16 w-16 place-items-center rounded-xl bg-gradient-to-br from-accent-500 to-accent-600 shadow-glow-accent">
            <User className="h-8 w-8 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">{fullName}</h3>
            <p className="text-sm text-slate-400">{email}</p>
            <div className="mt-1.5 flex items-center gap-1.5">
              <span className="rounded-full bg-ok-500/15 px-2 py-0.5 text-[10px] font-bold tracking-wider text-ok-400">
                {fallback.permissions} PERMISSIONS
              </span>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          {rows.map((r) => {
            const Icon = r.icon;
            return (
              <div key={r.label} className="flex items-center gap-3 rounded-lg border border-base-600/70 bg-base-900/40 px-3 py-2.5">
                <Icon className="h-4 w-4 shrink-0 text-accent-400" />
                <span className="text-xs uppercase tracking-wider text-slate-500">{r.label}</span>
                <span className="ml-auto font-mono text-sm font-medium text-slate-200">{r.value}</span>
              </div>
            );
          })}
        </div>

        <div className="flex items-center justify-between rounded-lg border border-ok-500/30 bg-ok-500/10 px-4 py-3">
          <span className="flex items-center gap-2 text-sm text-ok-400">
            <ShieldCheck className="h-4 w-4" /> Access Level
          </span>
          <span className="flex items-center gap-2">
            <StatusDot color="ok" />
            <span className="font-mono text-sm font-bold text-ok-400">{fallback.permissions} — Full Control</span>
          </span>
        </div>
      </div>
    </Modal>
  );
}
