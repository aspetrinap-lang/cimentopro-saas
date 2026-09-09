import { useAuth } from '@/lib/AuthContext';
import { useOperator } from '@/lib/OperatorContext';
import ProductionSettings from '@/components/settings/ProductionSettings';

export default function Cadastro() {
  const { user } = useAuth();
  const { activeOperator } = useOperator();
  const role = activeOperator?.role || user?.role || 'user';
  const isAdmin = role === 'administrador' || role === 'admin';

  return (
    <div className="p-6 space-y-5 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Cadastro de Produção</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Artefatos, traços de concreto, máquinas, categorias e insumos</p>
      </div>
      <ProductionSettings canEditCost={isAdmin} />
    </div>
  );
}