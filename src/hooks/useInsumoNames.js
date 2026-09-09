import { useConfig } from '@/lib/ConfigContext';

export function useInsumoNames() {
  const { insumoNames, loading, refreshConfigs } = useConfig();
  return { names: insumoNames, loading, reload: refreshConfigs };
}