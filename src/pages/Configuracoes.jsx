import AdminSettings from '@/components/settings/AdminSettings';

export default function Configuracoes() {
  return (
    <div className="p-6 space-y-5 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Configurações</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Perfis de acesso, operadores e backup do sistema</p>
      </div>
      <AdminSettings />
    </div>
  );
}