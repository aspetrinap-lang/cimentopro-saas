import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { DEFAULT_RAW_MATERIALS, INSUMO_KEYS } from '@/lib/insumos';

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

  const refreshConfigs = useCallback(async () => {
    const [matRows, costsRows, intervalsRows] = await Promise.all([
      base44.entities.AppSettings.filter({ key: 'raw_materials' }),
      base44.entities.AppSettings.filter({ key: 'insumo_costs' }),
      base44.entities.AppSettings.filter({ key: 'maintenance_intervals' }),
    ]);

    if (matRows.length > 0 && Array.isArray(matRows[0].value?.items)) {
      setRawMaterials(matRows[0].value.items);
    }
    if (costsRows.length > 0 && costsRows[0].value) {
      setInsumoCosts({ ...Object.fromEntries(INSUMO_KEYS.map(k => [k, 0])), ...costsRows[0].value });
    }
    if (intervalsRows.length > 0 && intervalsRows[0].value) {
      setMaintenanceIntervals({ ...DEFAULT_MAINTENANCE_INTERVALS, ...intervalsRows[0].value });
    }
    setLoading(false);
  }, []);

  useEffect(() => { refreshConfigs(); }, []);

  // Nomes derivados da lista de matérias-primas (compatibilidade com useInsumoNames)
  const insumoNames = Object.fromEntries(rawMaterials.map(m => [m.key, m.name]));

  async function saveCosts(newCosts) {
    const rows = await base44.entities.AppSettings.filter({ key: 'insumo_costs' });
    if (rows.length > 0) {
      await base44.entities.AppSettings.update(rows[0].id, { value: newCosts });
    } else {
      await base44.entities.AppSettings.create({ key: 'insumo_costs', value: newCosts });
    }
    setInsumoCosts(newCosts);
    refreshConfigs();
  }

  async function saveRawMaterials(newList) {
    const rows = await base44.entities.AppSettings.filter({ key: 'raw_materials' });
    const valueObj = { items: newList };
    if (rows.length > 0) {
      await base44.entities.AppSettings.update(rows[0].id, { value: valueObj });
    } else {
      await base44.entities.AppSettings.create({ key: 'raw_materials', value: valueObj });
    }
    setRawMaterials(newList);
    refreshConfigs();
  }

  async function saveMaintenanceIntervals(newIntervals) {
    const rows = await base44.entities.AppSettings.filter({ key: 'maintenance_intervals' });
    if (rows.length > 0) {
      await base44.entities.AppSettings.update(rows[0].id, { value: newIntervals });
    } else {
      await base44.entities.AppSettings.create({ key: 'maintenance_intervals', value: newIntervals });
    }
    setMaintenanceIntervals(newIntervals);
    refreshConfigs();
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