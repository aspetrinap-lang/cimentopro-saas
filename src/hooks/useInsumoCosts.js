import { useConfig } from '@/lib/ConfigContext';

export const DEFAULT_INSUMO_COSTS = {};

export function useInsumoCosts() {
  const { insumoCosts, loading, saveCosts, refreshConfigs } = useConfig();
  return { costs: insumoCosts, loading, saveCosts, reload: refreshConfigs };
}