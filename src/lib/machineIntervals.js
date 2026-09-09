// Intervalos de manutenção e classificação de máquinas (Produção x Movimentação).
// Fonte única usada pelo cadastro (MachineForm), alertas (MaintenanceAlerts)
// e listagem de máquinas (ProductionSettings).

export const DEFAULT_INTERVALS = {
  Lubrificação: 15,
  Hidráulico: 45,
  Pneumático: 45,
  Mecânico: 60,
  Elétrico: 60,
};

// Intervalos ativos da máquina. Máquinas antigas (sem o campo ou vazio)
// usam os 5 tipos padrão; itens com dias <= 0 são ignorados.
export function getActiveIntervals(machine) {
  const stored = machine?.maintenance_intervals;
  if (stored && typeof stored === 'object') {
    const active = {};
    Object.entries(stored).forEach(([type, days]) => {
      if (Number(days) > 0) active[type] = Number(days);
    });
    if (Object.keys(active).length > 0) return active;
  }
  return DEFAULT_INTERVALS;
}

// Máquina entra nos cálculos de ciclos/produção?
// Legado (sem classificação) é tratado como Produção.
export function isProductionMachine(machine) {
  return (machine?.machine_type || 'Produção') !== 'Movimentação';
}

// Converte os itens do formulário em objeto { tipo: dias }.
// Itens ativos salvam os dias; itens desativados salvam 0 (marcam "não usa",
// preservando a escolha ao reabrir o formulário — consumidores filtram <= 0).
export function intervalsFromItems(items) {
  const out = {};
  (items || []).forEach((item) => {
    const name = (item.name || '').trim();
    if (!name) return;
    const days = parseInt(item.days, 10);
    out[name] = item.enabled && days > 0 ? days : 0;
  });
  return out;
}

// Converte intervalos armazenados em itens do formulário (switch + dias + flag custom).
// Sem intervalos armazenados, parte dos 5 padrão ativos.
export function itemsFromIntervals(intervals) {
  const stored = intervals || {};
  const names = [...new Set([...Object.keys(DEFAULT_INTERVALS), ...Object.keys(stored)])];
  return names.map((name) => {
    const isDefault = name in DEFAULT_INTERVALS;
    const days = name in stored ? Number(stored[name]) : DEFAULT_INTERVALS[name];
    return {
      name,
      days: days > 0 ? days : isDefault ? DEFAULT_INTERVALS[name] : 30,
      enabled: name in stored ? Number(stored[name]) > 0 : true,
      custom: !isDefault,
    };
  });
}