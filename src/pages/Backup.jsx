import BackupPanel from '@/components/settings/BackupPanel';

export default function Backup() {
  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Backup de Dados</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Baixe, restaure e mantenha cópias locais de todos os dados do aplicativo
        </p>
      </div>
      <BackupPanel />
    </div>
  );
}