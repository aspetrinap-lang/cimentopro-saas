import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { DEFAULT_RAW_MATERIALS, INSUMO_KEYS } from '@/lib/insumos';
import { useCompany } from '@/lib/CompanyContext';
import { scopedFilter, withCompany } from '@/lib/companyScope';

export const DEFAULT_MAINTENANCE_INTERVALS = {
  'Lubrificação': 15,
  'Inspeção Geral': 30,
  'Elétrico': 60,
  'Mecânico': 60,
  'Pneumático': 45,
  'Hidráulico': 45,
  'Troca de Peça': 90,
  'Outros': 30,
};

const ConfigContext = createContext(null);

export function ConfigProvider({ children }) {
  const [rawMaterials, setRawMaterials] = useState(DEFAULT_RAW_MATERIALS);
  const [insumoCosts, setInsumoCosts] = useState(
    Object.fromEntries(INSUMO_KEYS.map(k => [k, 0]))
  );
  const [maintenanceIntervals, setMaintenanceIntervals] = useState(DEFAULT_MAINTENANCE_INTERVALS);
  const [loading, setLoading] = useState(true);
  const { currentCompanyId } = useCompany();

  const refreshConfigs = useCallback(async () => {
    try {
      // Uma única consulta por empresa (antes eram 3 em paralelo — estourava o
      // limite de requisições da plataforma na inicialização) e seleção por chave.
      const rows = await base44.entities.AppSettings.filter(scopedFilter());
      const byKey = (key) => rows.find((r) => r.key === key);
      const mat = byKey('raw_materials');
      const costs = byKey('insumo_costs');
      const intervals = byKey('maintenance_intervals');
      if (mat && Array.isArray(mat.value?.items)) {
        setRawMaterials(mat.value.items);
      }
      if (costs?.value) {
        setInsumoCosts({ ...Object.fromEntries(INSUMO_KEYS.map(k => [k, 0])), ...costs.value });
      }
      if (intervals?.value) {
        setMaintenanceIntervals({ ...DEFAULT_MAINTENANCE_INTERVALS, ...intervals.value });
      }
    } finally {
      // Em falha transitória (ex: limite de requisições), o app continua com os
      // valores padrão em vez de travar na tela de carregamento.
      setLoading(false);
    }
  }, []);

  useEffect(() => { refreshConfigs(); }, [refreshConfigs, currentCompanyId]);

  // Nomes derivados da lista de matérias-primas (compatibilidade com useInsumoNames)
  const insumoNames = Object.fromEntries(rawMaterials.map(m => [m.key, m.name]));

  async function saveCosts(newCosts) {
    const rows = await base44.entities.AppSettings.filter(scopedFilter({ key: 'insumo_costs' }));
    if (rows.length > 0) {
      await base44.entities.AppSettings.update(rows[0].id, { value: newCosts });
    } else {
      await base44.entities.AppSettings.create(withCompany({ key: 'insumo_costs', value: newCosts }));
    }
    setInsumoCosts(newCosts);
  }

  async function saveRawMaterials(newList) {
    const rows = await base44.entities.AppSettings.filter(scopedFilter({ key: 'raw_materials' }));
    const valueObj = { items: newList };
    if (rows.length > 0) {
      await base44.entities.AppSettings.update(rows[0].id, { value: valueObj });
    } else {
      await base44.entities.AppSettings.create(withCompany({ key: 'raw_materials', value: valueObj }));
    }
    setRawMaterials(newList);
  }

  async function saveMaintenanceIntervals(newIntervals) {
    const rows = await base44.entities.AppSettings.filter(scopedFilter({ key: 'maintenance_intervals' }));
    if (rows.length > 0) {
      await base44.entities.AppSettings.update(rows[0].id, { value: newIntervals });
    } else {
      await base44.entities.AppSettings.create(withCompany({ key: 'maintenance_intervals', value: newIntervals }));
    }
    setMaintenanceIntervals(newIntervals);
  }

  return (
    <ConfigContext.Provider value={{ rawMaterials, insumoNames, insumoCosts, maintenanceIntervals, loading, refreshConfigs, saveCosts, saveRawMaterials, saveMaintenanceIntervals }}>
      {children}
    </ConfigContext.Provider>
  );
}

export function useConfig() {
  const ctx = useContext(ConfigContext);
  if (!ctx) throw new Error('useConfig must be used within ConfigProvider');
  return ctx;
}