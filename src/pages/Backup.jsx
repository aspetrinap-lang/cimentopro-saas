import BackupPanel from '@/components/settings/BackupPanel';

export default function Backup() {
  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Backup Administrativo da Empresa</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Baixe, restaure e mantenha cópias locais dos dados da empresa. Distinto da exportação individual (LGPD) — este backup é administrativo e não substitui a portabilidade de dados do titular.
        </p>
      </div>
      <BackupPanel />
    </div>
  );
}