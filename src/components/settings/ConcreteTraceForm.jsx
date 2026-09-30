import { useState } from 'react';
import { withCompany } from '@/lib/companyScope';
import { base44 } from '@/api/base44Client';
import { X, Plus, Trash2, Percent, Scale } from 'lucide-react';
import { useConfig } from '@/lib/ConfigContext';
import { CORE_PART_KEYS } from '@/lib/insumos';
import { deriveDirectWeights, directToTraceFields } from '@/lib/traceDirect';

const empty = {
  name: '',
  resistance_mpa: '',
  total_weight_kg: '',
  ratio_label: '1/16',
  aggregate_parts: 16,
  cement_parts: 1,
  materials_composition: {},
  notes: '',
  active: true,
};

function parseRatio(label) {
  if (!label) return { cement: 1, agg: 16 };
  const parts = String(label).split('/');
  const cement = parseFloat(String(parts[0]).replace(',', '.')) || 1;
  const agg = parseFloat(String(parts[1]).replace(',', '.')) || 0;
  return { cement, agg };
}

function fmt(val) {
  return val.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmt1(val) {
  return val.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

export default function ConcreteTraceForm({ item, onClose, onSaved }) {
  const { rawMaterials } = useConfig();
  // Modo travado: escolhido apenas na criação; na edição segue o modo salvo.
  const [mode, setMode] = useState(() => (item ? (item.input_mode || 'ratio') : null));
  const isDirect = mode === 'direct';
  const [form, setForm] = useState(() => {
    if (!item) return { ...empty, materials_composition: {} };
    return {
      ...empty,
      ...item,
      materials_composition: { ...(item.materials_composition || {}) },
    };
  });
  const [cementKgInput, setCementKgInput] = useState(() =>
    item?.input_mode === 'direct' ? String(item.cement_kg_per_m3 ?? '') : ''
  );
  const [kg, setKg] = useState(() => (item?.input_mode === 'direct' ? deriveDirectWeights(item).weights : {}));
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);

  function set(field, val) { setForm(f => ({ ...f, [field]: val })); }
  function setComp(key, field, val) {
    setForm(f => ({
      ...f,
      materials_composition: {
        ...f.materials_composition,
        [key]: { ...(f.materials_composition[key] || { percent: '', type: 'aggregate' }), [field]: val },
      },
    }));
  }
  function addMaterial(key) {
    if (form.materials_composition[key]) return;
    setForm(f => ({
      ...f,
      materials_composition: { ...f.materials_composition, [key]: { percent: '', type: 'aggregate' } },
    }));
    if (isDirect) setKg(k => ({ ...k, [key]: '' }));
    setPickerOpen(false);
  }
  function removeMaterial(key) {
    setForm(f => {
      const next = { ...f.materials_composition };
      delete next[key];
      return { ...f, materials_composition: next };
    });
    if (isDirect) setKg(k => { const n = { ...k }; delete n[key]; return n; });
  }
  function setKgVal(key, val) { setKg(k => ({ ...k, [key]: val })); }

  // ── Cálculos ──
  const totalWeight = parseFloat(form.total_weight_kg) || 0;
  const ratio = parseRatio(form.ratio_label);
  const totalRatioParts = ratio.cement + ratio.agg;
  const cementWeight = totalWeight > 0 && totalRatioParts > 0 ? totalWeight * ratio.cement / totalRatioParts : 0;

  const aggregateWeight = Math.max(0, totalWeight - cementWeight);

  function matWeight(key) {
    const comp = form.materials_composition[key];
    if (!comp) return 0;
    const pct = parseFloat(comp.percent) || 0;
    if (comp.type === 'additive') return cementWeight * pct / 100;
    return aggregateWeight * pct / 100;
  }

  // ── Cálculos do modo direto ──
  const cementKgNum = parseFloat(String(cementKgInput).replace(',', '.')) || 0;
  const directSumKg = cementKgNum + addedEntriesSafe();
  function addedEntriesSafe() {
    return Object.keys(form.materials_composition)
      .reduce((s, key) => s + (parseFloat(kg[key]) || 0), 0);
  }
  const directOver = totalWeight > 0 && directSumKg > totalWeight + 0.01;
  const directDiff = totalWeight > 0 ? totalWeight - directSumKg : 0;

  // Materiais disponíveis para adicionar (exclui cimento e água — cimento vem da proporção, água só na ordem)
  const availableToAdd = rawMaterials.filter(m =>
    m.key !== 'cement' && m.key !== 'water' && !form.materials_composition[m.key]
  );

  const addedEntries = Object.keys(form.materials_composition).map(key => {
    const mat = rawMaterials.find(m => m.key === key);
    return { key, name: mat?.name || key, unit: mat?.unit || 'kg', comp: form.materials_composition[key] };
  });

  const aggregatesPctSum = addedEntries
    .filter(e => e.comp.type === 'aggregate')
    .reduce((s, e) => s + (parseFloat(e.comp.percent) || 0), 0);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (isDirect) {
      if (!(totalWeight > 0)) { setError('Informe o peso total da mistura.'); return; }
      if (!(directSumKg > 0)) { setError('Informe o peso do cimento e/ou dos materiais.'); return; }
      if (directOver) {
        setError(`A soma dos materiais (${fmt(directSumKg)} kg) ultrapassa o peso total da mistura (${fmt(totalWeight)} kg). Ajuste os pesos antes de salvar.`);
        return;
      }
      if (addedEntries.some(en => en.comp.type === 'additive' && !(cementKgNum > 0))) {
        setError('Aditivos exigem o peso do cimento maior que zero.');
        return;
      }
    }

    setSaving(true);

    let payload;
    if (isDirect) {
      // Converte kg → percentuais: agregados % do peso de agregados (total − cimento); aditivos % do cimento.
      const entries = addedEntries.map(en => ({ key: en.key, kg: parseFloat(kg[en.key]) || 0, type: en.comp.type }));
      const conv = directToTraceFields({ total: totalWeight, cementKg: cementKgNum, entries });

      // Compatibilidade: partes relativas ao cimento (kg ÷ cimento)
      const compat = {};
      CORE_PART_KEYS.forEach(key => {
        if (key === 'cement') { compat.cement_parts = 1; return; }
        compat[`${key}_parts`] = conv.materials_parts[key] ?? 0;
      });

      payload = {
        ...form,
        input_mode: 'direct',
        ratio_label: '',
        total_weight_kg: totalWeight || null,
        cement_kg_per_m3: cementKgNum || null,
        cement_parts: 1,
        aggregate_parts: conv.aggregate_parts,
        materials_composition: conv.materials_composition,
        materials_parts: { cement: 1, ...conv.materials_parts },
        resistance_mpa: parseFloat(form.resistance_mpa) || null,
        ...compat,
      };
    } else {
      // Compatibilidade: partes relativas ao cimento (cement_parts = base da proporção)
      const materials_parts = { cement: ratio.cement };
      const compat = {};
      CORE_PART_KEYS.forEach(key => {
        if (key === 'cement') { compat.cement_parts = ratio.cement; materials_parts.cement = ratio.cement; return; }
        const w = matWeight(key);
        const parts = cementWeight > 0 ? w / cementWeight : 0;
        compat[`${key}_parts`] = parts;
        materials_parts[key] = parts;
      });

      payload = {
        ...form,
        input_mode: 'ratio',
        total_weight_kg: totalWeight || null,
        cement_kg_per_m3: cementWeight || null,
        cement_parts: ratio.cement,
        aggregate_parts: ratio.agg,
        resistance_mpa: parseFloat(form.resistance_mpa) || null,
        materials_composition: form.materials_composition,
        materials_parts,
        ...compat,
      };
    }

    if (item?.id) {
      await base44.entities.ConcreteTrace.update(item.id, payload);
    } else {
      await base44.entities.ConcreteTrace.create(withCompany(payload));
    }
    setSaving(false);
    onSaved();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-card w-full max-w-2xl rounded-2xl shadow-2xl border border-border overflow-y-auto max-h-[90vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="font-semibold text-foreground">{item ? 'Editar Traço' : 'Novo Traço de Concreto'}</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* ── Escolha do modo (apenas na criação) ── */}
          {mode === null && (
            <div className="space-y-3">
              <p className="text-xs font-semibold text-muted-foreground">Como deseja cadastrar este traço?</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button type="button" onClick={() => setMode('ratio')}
                  className="text-left border border-border rounded-xl p-4 hover:border-primary/60 hover:bg-primary/5 transition-colors">
                  <Percent className="w-5 h-5 text-primary mb-2" />
                  <p className="text-sm font-semibold text-foreground">Por Proporção</p>
                  <p className="text-xs text-muted-foreground mt-1">Informe a proporção (ex: 1/16) e o peso total — os pesos de cada material são calculados automaticamente.</p>
                </button>
                <button type="button" onClick={() => setMode('direct')}
                  className="text-left border border-border rounded-xl p-4 hover:border-primary/60 hover:bg-primary/5 transition-colors">
                  <Scale className="w-5 h-5 text-primary mb-2" />
                  <p className="text-sm font-semibold text-foreground">Peso Direto</p>
                  <p className="text-xs text-muted-foreground mt-1">Informe os kg de cada material (ex: agg1 400 kg, agg2 300 kg) — o sistema converte para o restante do aplicativo.</p>
                </button>
              </div>
              <p className="text-xs text-muted-foreground/70">A escolha fica fixa neste traço após a criação.</p>
            </div>
          )}

          {mode !== null && (
            <>
              {/* ── Modo fixo (edição) ── */}
              {item && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Modo de entrada:</span>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${isDirect ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
                    {isDirect ? 'Peso Direto' : 'Proporção'}
                  </span>
                </div>
              )}

              {/* ── Identificação ── */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Nome do Traço</label>
                  <input className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                    value={form.name} onChange={e => set('name', e.target.value)} placeholder="Traço 4 MPa" required />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Resistência (MPa)</label>
                  <input type="number" step="0.1" className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                    value={form.resistance_mpa ?? ''} onChange={e => set('resistance_mpa', e.target.value)} placeholder="4" />
                </div>
              </div>

              {/* ── Peso total e proporção ── */}
              <div className="bg-muted/40 rounded-xl p-4 space-y-3">
                <div className={isDirect ? 'space-y-4' : 'grid grid-cols-2 gap-4'}>
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">Peso Total da Mistura (kg)</label>
                    <input type="number" min="0" step="1"
                      className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                      value={form.total_weight_kg ?? ''} onChange={e => set('total_weight_kg', e.target.value)} placeholder="ex: 2100" />
                  </div>
                  {isDirect ? (
                    <div>
                      <label className="block text-xs font-medium text-muted-foreground mb-1">Cimento (kg)</label>
                      <input type="number" min="0" step="0.01"
                        className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                        value={cementKgInput} onChange={e => setCementKgInput(e.target.value)} placeholder="ex: 200" />
                    </div>
                  ) : (
                    <div>
                      <label className="block text-xs font-medium text-muted-foreground mb-1">Proporção Cimento/Agregado</label>
                      <input
                        className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                        value={form.ratio_label} onChange={e => set('ratio_label', e.target.value)} placeholder="1/16" />
                      <p className="text-xs text-muted-foreground/70 mt-1">Formato 1/16 = 1 parte cimento para 16 de agregado</p>
                    </div>
                  )}
                </div>

                {!isDirect && cementWeight > 0 && (
                  <div className="bg-primary/5 rounded-lg px-4 py-3 flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground">Peso do Cimento (calculado)</p>
                      <p className="text-xs text-muted-foreground/70">({fmt1(totalWeight)} ÷ {totalRatioParts} partes)</p>
                    </div>
                    <p className="text-2xl font-bold text-primary">{fmt1(cementWeight)} kg</p>
                  </div>
                )}

                {isDirect && totalWeight > 0 && (
                  <div className={`text-xs flex items-center gap-2 ${directOver ? 'text-destructive' : Math.abs(directDiff) <= 0.01 ? 'text-green-600' : 'text-amber-600'}`}>
                    Soma dos materiais: {fmt(directSumKg)} kg de {fmt1(totalWeight)} kg
                    {directOver
                      ? ' — ultrapassa o total: ajuste os pesos antes de salvar.'
                      : directDiff > 0.01
                        ? ` — restam ${fmt(directDiff)} kg sem alocação (permitido, mas confira).`
                        : ' — ok.'}
                  </div>
                )}
              </div>

              {/* ── Matérias-primas ── */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground">Matérias-primas</p>
                    <p className="text-xs text-muted-foreground/70">
                      {isDirect
                        ? 'Informe o peso de cada material em kg · Aditivos: peso por lote (base cimento)'
                        : 'Agregados: % do peso do agregado (total − cimento) · Aditivos: % do peso do cimento'}
                    </p>
                  </div>
                  <button type="button" onClick={() => setPickerOpen(o => !o)}
                    className="flex items-center gap-1.5 bg-primary text-primary-foreground px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-primary/90 transition-colors">
                    <Plus className="w-3.5 h-3.5" /> Adicionar
                  </button>
                </div>

                {pickerOpen && (
                  <div className="bg-card border border-border rounded-xl p-3 space-y-2 shadow-sm">
                    {availableToAdd.length === 0 ? (
                      <p className="text-xs text-muted-foreground text-center py-2">Todas as matérias-primas cadastradas já foram adicionadas.</p>
                    ) : (
                      <select
                        className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                        value=""
                        onChange={e => { if (e.target.value) addMaterial(e.target.value); }}
                      >
                        <option value="">Selecione uma matéria-prima para adicionar...</option>
                        {availableToAdd.map(m => (
                          <option key={m.key} value={m.key}>{m.name} ({m.unit})</option>
                        ))}
                      </select>
                    )}
                    <p className="text-xs text-muted-foreground/70 px-1">Cadastre novas matérias-primas em <strong>Configurações → Matéria-Prima</strong>.</p>
                  </div>
                )}

                {addedEntries.length === 0 ? (
                  <div className="bg-card border border-dashed border-border rounded-xl p-6 text-center text-sm text-muted-foreground">
                    Nenhuma matéria-prima adicionada. Use <strong>Adicionar</strong> para incluir agregados e aditivos.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {addedEntries.map(({ key, name, unit, comp }) => {
                      const weight = matWeight(key);
                      return (
                        <div key={key} className="bg-card border border-border rounded-xl p-3 grid grid-cols-12 gap-2 items-center">
                          <div className="col-span-3">
                            <p className="text-sm font-medium text-foreground truncate">{name}</p>
                            <p className="text-xs text-muted-foreground">{unit}</p>
                          </div>
                          <div className="col-span-3">
                            <select
                              className="w-full border border-input rounded-lg px-2 py-1.5 text-xs bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                              value={comp.type} onChange={e => setComp(key, 'type', e.target.value)}
                            >
                              <option value="aggregate">Agregado</option>
                              <option value="additive">Aditivo</option>
                            </select>
                          </div>
                          <div className="col-span-3">
                            {isDirect ? (
                              <div className="relative">
                                <input type="number" min="0" step="0.01"
                                  className="w-full border border-input rounded-lg px-2 py-1.5 pr-8 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                                  value={kg[key] ?? ''} onChange={e => setKgVal(key, e.target.value)} placeholder="0" />
                                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">kg</span>
                              </div>
                            ) : (
                              <div className="relative">
                                <input type="number" min="0" step="0.01"
                                  className="w-full border border-input rounded-lg px-2 py-1.5 pr-7 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                                  value={comp.percent} onChange={e => setComp(key, 'percent', e.target.value)} placeholder="0" />
                                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>
                              </div>
                            )}
                          </div>
                          <div className="col-span-2 text-right">
                            {isDirect ? (
                              <>
                                <p className="text-sm font-bold text-muted-foreground/60">—</p>
                                <p className="text-xs text-muted-foreground">% interno</p>
                              </>
                            ) : (
                              <>
                                <p className="text-sm font-bold text-foreground">{weight > 0 ? fmt(weight) : '—'}</p>
                                <p className="text-xs text-muted-foreground">kg</p>
                              </>
                            )}
                          </div>
                          <div className="col-span-1 flex justify-end">
                            <button type="button" onClick={() => removeMaterial(key)}
                              className="text-muted-foreground hover:text-destructive transition-colors p-1">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {!isDirect && aggregatesPctSum > 0 && (
                  <div className={`text-xs flex items-center gap-2 ${Math.abs(aggregatesPctSum - 100) <= 0.1 ? 'text-green-600' : 'text-amber-600'}`}>
                    Soma dos agregados: {aggregatesPctSum.toFixed(1)}%
                    {Math.abs(aggregatesPctSum - 100) > 0.1 && ' — atenção: deve totalizar 100%'}
                  </div>
                )}
                <p className="text-xs text-muted-foreground/70">A água não faz parte do traço — é informada manualmente em cada ordem de produção.</p>
              </div>

              {/* ── Observações ── */}
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Observações</label>
                <textarea className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring resize-none" rows={2}
                  value={form.notes ?? ''} onChange={e => set('notes', e.target.value)} />
              </div>

              <div className="flex items-center gap-2">
                <input type="checkbox" id="active" checked={form.active !== false} onChange={e => set('active', e.target.checked)} className="rounded" />
                <label htmlFor="active" className="text-sm text-muted-foreground">Ativo</label>
              </div>

              {error && (
                <div className="bg-destructive/10 border border-destructive/30 text-destructive rounded-lg px-4 py-2.5 text-xs font-medium">{error}</div>
              )}

              <div className="flex gap-3 pt-1">
                <button type="button" onClick={onClose} className="flex-1 border border-border rounded-lg py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted transition-colors">Cancelar</button>
                <button type="submit" disabled={saving} className="flex-1 bg-primary text-primary-foreground rounded-lg py-2.5 text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-60">
                  {saving ? 'Salvando...' : item ? 'Salvar' : 'Criar'}
                </button>
              </div>
            </>
          )}
        </form>
      </div>
    </div>
  );
}