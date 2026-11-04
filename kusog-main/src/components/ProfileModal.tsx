import { User, Contact, Award } from 'lucide-react';
import { Modal } from '@/components/Modal';
import type { OperatorProfile } from '@/App';

type Props = {
  open: boolean;
  onClose: () => void;
  profile?: OperatorProfile;
};

export function ProfileModal({ open, onClose, profile }: Props) {
  const fullName = profile?.fullName || 'Unavailable';
  const role = profile?.role || 'Unavailable';
  const studentNumber = profile?.studentNumber || '--';
  const email = profile?.email || 'Unavailable';

  const rows = [
    { icon: Award, label: 'Role', value: role },
    { icon: Contact, label: 'Student Number', value: studentNumber },
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

      </div>
    </Modal>
  );
}
