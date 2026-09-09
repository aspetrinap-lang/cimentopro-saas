import ProductionSettings from '@/components/settings/ProductionSettings';
import { usePermissions } from '@/lib/PermissionsContext';

export default function Cadastro() {
  const { can } = usePermissions();

  return (
    <div className="p-6 space-y-5 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Cadastro de Produção</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Artefatos, traços de concreto, máquinas, categorias e insumos</p>
      </div>
      <ProductionSettings canEditCost={can('PRODUCTION_EDIT')} />
    </div>
  );
}