// Configuração tributária da EMPRESA (banco de dados, escopo multi-tenant) —
// substitui os valores que viviam no localStorage do navegador. Na primeira
// carga, semeia a partir do legado do navegador (migração única) e persiste.
import { useCallback, useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { scopedFilter, withCompany } from '@/lib/companyScope';

const KEY = 'tax_settings';
const LEGACY_TAXES_KEY = 'pricing_simulator_regime_taxes';
const LEGACY_DEFAULTS_KEY = 'pricing_simulator_defaults';

// Alíquota inicial sugerida por regime (valor inicial — editável pela empresa)
export const DEFAULT_REGIME_TAXES = { simples: 13, real: 21.5 };

function readLegacy() {
  try {
    const d = JSON.parse(localStorage.getItem(LEGACY_DEFAULTS_KEY) || 'null');
    const t = JSON.parse(localStorage.getItem(LEGACY_TAXES_KEY) || 'null');
    const tax_rates = { ...DEFAULT_REGIME_TAXES };
    if (t?.simples != null) tax_rates.simples = Number(t.simples);
    if (t?.real != null) tax_rates.real = Number(t.real);
    return { regime: d?.regime || 'simples', tax_rates };
  } catch {
    return { regime: 'simples', tax_rates: { ...DEFAULT_REGIME_TAXES } };
  }
}

export function useCompanyTaxes() {
  const [taxes, setTaxes] = useState({ regime: 'simples', tax_rates: { ...DEFAULT_REGIME_TAXES } });
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await base44.entities.AppSettings.filter(scopedFilter({ key: KEY }));
      if (rows.length) {
        const v = rows[0].value || {};
        setTaxes({ regime: v.regime || 'simples', tax_rates: { ...DEFAULT_REGIME_TAXES, ...(v.tax_rates || {}) } });
        return;
      }
      // Migração única: semeia a partir do legado do navegador
      const seeded = readLegacy();
      await base44.entities.AppSettings.create(withCompany({ key: KEY, value: seeded }));
      setTaxes(seeded);
    } catch {
      // sem empresa ativa ou falha — mantém defaults em memória
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const save = useCallback(async (next) => {
    setTaxes(next);
    const rows = await base44.entities.AppSettings.filter(scopedFilter({ key: KEY }));
    if (rows.length) await base44.entities.AppSettings.update(rows[0].id, { value: next });
    else await base44.entities.AppSettings.create(withCompany({ key: KEY, value: next }));
  }, []);

  const currentRate = taxes.regime === 'real' ? taxes.tax_rates.real : taxes.tax_rates.simples;

  return { taxes, setTaxes: save, reloadTaxes: load, loading, currentRate };
}