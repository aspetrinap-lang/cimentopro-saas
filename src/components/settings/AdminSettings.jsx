import { useState } from 'react';
import OperatorsTab from '@/components/settings/OperatorsTab';
import BackupPanel from '@/components/settings/BackupPanel';
import ProfilesTab from '@/components/settings/ProfilesTab';

const TABS = [
  { key: 'perfis', label: 'Perfis de Acesso' },
  { key: 'operadores', label: 'Operadores' },
  { key: 'backup', label: 'Backup' },
];

export default function AdminSettings() {
  const [tab, setTab] = useState('perfis');

  return (
    <div className="space-y-5">
      <div className="flex gap-1 bg-muted rounded-xl p-1 w-fit flex-wrap">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm rounded-lg font-medium transition-all ${
              tab === t.key ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'perfis' && <ProfilesTab />}
      {tab === 'operadores' && <OperatorsTab />}
      {tab === 'backup' && <BackupPanel />}
    </div>
  );
}