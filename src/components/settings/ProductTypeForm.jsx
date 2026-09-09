import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { X, Zap } from 'lucide-react';
import { useInsumoNames } from '@/hooks/useInsumoNames';
import { INSUMO_KEYS, INSUMO_FIELDS } from '@/lib/insumos';
import { inferNorm, getNormClasses, getClassFbk } from '@/lib/qualityNorms';

const empty = {
  name: '', code: '', category: '', unit: 'un',
  units_per_mold: '',
  length_mm: '', width_mm: '', height_mm: '',
  pieces_per_m: '',
  pieces_per_m_unit: 'm',
  mold_id: '',
  mold_name: '',
  mold_cost_per_unit: '',
  concrete_trace_id: '',
  volume_per_unit_m3: '',
  cement_per_unit: '',
  sand_artificial_per_unit: '',
  sand_medium_per_unit: '',
  sand_fine_per_unit: '',
  gravel_per_unit: '',
  additive_per_unit: '',
  pigment_per_unit: '',
  norm_class: '',
  target_resistance: 0,
  selling_price: '',
  active: true,
};

export default function ProductTypeForm({ item, onClose, onSaved }) {
  const [form, setForm] = useState(item ? { ...item } : empty);
  const [saving, setSaving] = useState(false);
  const [traces, setTraces] = useState([]);
  const [molds, setMolds] = useState([]);
  const [categories, setCategories] = useState([]);
  const { names } = useInsumoNames();

  useEffect(() => {
    Promise.all([
      base44.entities.ConcreteTrace.filter({ active: true }, 'name'),
      base44.entities.Mold.filter({ status: 'Ativo' }, 'name'),
      base44.entities.ProductCategory.filter({ active: true }, 'name'),
    ]).then(([t, m, c]) => { setTraces(t); setMolds(m); setCategories(c); });
  }, []);

  function set(field, val) { setForm(f => ({ ...f, [field]: val })); }

  function handleMoldChange(id) {
    const m = molds.find(m => m.id === id);
    const moldCost = m && m.cost && m.max_cycles && m.units_per_cycle
      ? m.cost / m.max_cycles / m.units_per_cycle
      : 0;
    setForm(f => ({
      ...f,
      mold_id: id,
      mold_name: m ? m.name : '',
      mold_cost_per_unit: moldCost ? +moldCost.toFixed(6) : '',
    }));
  }

  // Auto-calcular consumo baseado no traço selecionado
  // volume_per_unit_m3 representa o PESO da unidade em kg
  function applyTrace() {
    const trace = traces.find(t => t.id === form.concrete_trace_id);
    const weightKg = parseFloat(form.volume_per_unit_m3); // peso em kg da peça
    if (!trace || !weightKg) return;

    const cp = parseFloat(trace.cement_parts) || 1;
    const totalParts = cp
      + (parseFloat(trace.sand_artificial_parts) || 0)
      + (parseFloat(trace.sand_medium_parts) || 0)
      + (parseFloat(trace.sand_fine_parts) || 0)
      + (parseFloat(trace.gravel_parts) || 0);

    const cementFrac = cp / totalParts;
    const sandArtFrac = (parseFloat(trace.sand_artificial_parts) || 0) / totalParts;
    const sandMedFrac = (parseFloat(trace.sand_medium_parts) || 0) / totalParts;
    const sandFinFrac = (parseFloat(trace.sand_fine_parts) || 0) / totalParts;
    const gravelFrac = (parseFloat(trace.gravel_parts) || 0) / totalParts;

    setForm(f => ({
      ...f,
      cement_per_unit: (cementFrac * weightKg).toFixed(4),
      sand_artificial_per_unit: (sandArtFrac * weightKg).toFixed(4),
      sand_medium_per_unit: (sandMedFrac * weightKg).toFixed(4),
      sand_fine_per_unit: (sandFinFrac * weightKg).toFixed(4),
      gravel_per_unit: (gravelFrac * weightKg).toFixed(4),
    }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    const payload = { ...form };
    INSUMO_KEYS.forEach(key => {
      const { pt_field } = INSUMO_FIELDS[key];
      payload[pt_field] = parseFloat(form[pt_field]) || 0;
    });
    payload.volume_per_unit_m3 = parseFloat(form.volume_per_unit_m3) || null;
    payload.length_mm = parseFloat(form.length_mm) || null;
    payload.width_mm = parseFloat(form.width_mm) || null;
    payload.height_mm = parseFloat(form.height_mm) || null;
    payload.pieces_per_m = parseFloat(form.pieces_per_m) || null;
    payload.mold_cost_per_unit = parseFloat(form.mold_cost_per_unit) || 0;
    payload.selling_price = parseFloat(form.selling_price) || 0;
    if (item?.id) {
      await base44.entities.ProductType.update(item.id, payload);
    } else {
      await base44.entities.ProductType.create(payload);
    }
    setSaving(false);
    onSaved();
    onClose();
  }

  const selectedTrace = traces.find(t => t.id === form.concrete_trace_id);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-card w-full max-w-lg rounded-2xl shadow-2xl border border-border overflow-y-auto max-h-[90vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="font-semibold text-foreground">{item ? 'Editar Artefato' : 'Novo Tipo de Artefato'}</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Nome</label>
              <input className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                value={form.name} onChange={e => set('name', e.target.value)} placeholder="Bloco 14" required />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Código</label>
              <input className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                value={form.code} onChange={e => set('code', e.target.value)} placeholder="BL14" required />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Unidade de Venda</label>
              <select className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                value={form.unit || 'un'} onChange={e => set('unit', e.target.value)}>
                <option value="un">un (unitário)</option>
                <option value="m2">m² (metro quadrado)</option>
                <option value="m">m (metro linear)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Artefatos por Molde</label>
              <input type="number" min="1" step="1"
                className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                value={form.units_per_mold ?? ''} onChange={e => set('units_per_mold', e.target.value)}
                placeholder="ex: 4" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Subcategoria</label>
            <select className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
              value={form.category || ''} onChange={e => set('category', e.target.value)}>
              <option value="">Selecione a categoria...</option>
              {categories.map(c => (
                <option key={c.id} value={c.name}>{c.name}</option>
              ))}
            </select>
            {categories.length === 0 && (
              <p className="text-xs text-muted-foreground mt-1">Nenhuma categoria ativa. Cadastre na aba <strong>Categorias</strong>.</p>
            )}
          </div>

          {/* ── Dimensões ── */}
          <div className="bg-muted/40 rounded-xl p-4 space-y-3">
            <p className="text-xs font-semibold text-muted-foreground">Dimensões do Produto</p>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Largura (mm)</label>
                <input type="number" min="0" step="1"
                  className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                  value={form.width_mm ?? ''} onChange={e => set('width_mm', e.target.value)} placeholder="190" />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Altura (mm)</label>
                <input type="number" min="0" step="1"
                  className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                  value={form.height_mm ?? ''} onChange={e => set('height_mm', e.target.value)} placeholder="140" />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Comprimento (mm)</label>
                <input type="number" min="0" step="1"
                  className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                  value={form.length_mm ?? ''} onChange={e => set('length_mm', e.target.value)} placeholder="390" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Peças por Metro</label>
                <input type="number" min="0" step="0.01"
                  className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                  value={form.pieces_per_m ?? ''} onChange={e => set('pieces_per_m', e.target.value)} placeholder="ex: 2.5" />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Unidade de Medida</label>
                <select
                  className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                  value={form.pieces_per_m_unit || 'm'} onChange={e => set('pieces_per_m_unit', e.target.value)}>
                  <option value="m">m (metro linear)</option>
                  <option value="m2">m² (metro quadrado)</option>
                </select>
              </div>
            </div>
          </div>

          {/* ── Classe da Norma ── */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-3">
            <p className="text-xs font-semibold text-blue-700">
              Classe da Norma {inferNorm(form.category)}
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Classe</label>
                <select
                  className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                  value={form.norm_class || ''}
                  onChange={e => {
                    const normRef = inferNorm(form.category);
                    const fbk = getClassFbk(normRef, e.target.value);
                    setForm(f => ({ ...f, norm_class: e.target.value, target_resistance: fbk }));
                  }}
                >
                  <option value="">Selecione a classe...</option>
                  {getNormClasses(inferNorm(form.category)).map(c => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
                {!form.category && (
                  <p className="text-xs text-muted-foreground mt-1">Selecione a subcategoria para definir a norma.</p>
                )}
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">fck de Projeto (MPa)</label>
                <input type="number" step="0.1" min="0"
                  className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-muted/40 text-muted-foreground"
                  value={form.target_resistance || ''} readOnly
                  placeholder="Definido pela classe" />
              </div>
            </div>
          </div>

          {/* ── Molde vinculado ── */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Molde Utilizado</label>
            <select className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
              value={form.mold_id || ''} onChange={e => handleMoldChange(e.target.value)}>
              <option value="">Selecione o molde...</option>
              {molds.map(m => (
                <option key={m.id} value={m.id}>
                  {m.name} ({m.code}){m.units_per_cycle ? ` — ${m.units_per_cycle} peças/ciclo` : ''}
                </option>
              ))}
            </select>
            {molds.length === 0 && (
              <p className="text-xs text-muted-foreground mt-1">Nenhum molde ativo. Cadastre moldes na página <strong>Moldes</strong>.</p>
            )}
            {form.mold_cost_per_unit ? (
              <p className="text-xs text-primary mt-1.5">
                Custo do molde por peça: <strong>
                  {parseFloat(form.mold_cost_per_unit).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 4 })}
                </strong>
                <span className="text-muted-foreground/70"> (custo ÷ vida útil ÷ peças/ciclo)</span>
              </p>
            ) : null}
          </div>

          {/* ── Cálculo automático por traço ── */}
          <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 space-y-3">
            <p className="text-xs font-semibold text-indigo-700">Calcular consumo pelo Traço de Concreto</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Traço</label>
                <select className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                  value={form.concrete_trace_id} onChange={e => set('concrete_trace_id', e.target.value)}>
                  <option value="">Selecione o traço...</option>
                  {traces.map(t => (
                    <option key={t.id} value={t.id}>
                      {t.name}{t.resistance_mpa ? ` — ${t.resistance_mpa} MPa` : ''}{t.ratio_label ? ` (${t.ratio_label})` : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Peso por Unidade (kg)</label>
                <input type="number" min="0" step="0.001"
                  className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                  value={form.volume_per_unit_m3} onChange={e => set('volume_per_unit_m3', e.target.value)} placeholder="ex: 8.5" />
              </div>
            </div>
            {selectedTrace && (
              <p className="text-xs text-indigo-600">
                Proporção: {Math.round(selectedTrace.cement_parts)}:{Math.round(selectedTrace.sand_artificial_parts || 0)}:{Math.round(selectedTrace.sand_medium_parts || 0)}:{Math.round(selectedTrace.sand_fine_parts || 0)}:{Math.round(selectedTrace.gravel_parts || 0)}
              </p>
            )}
            <button type="button" onClick={applyTrace}
              disabled={!form.concrete_trace_id || !form.volume_per_unit_m3}
              className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-xs font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-40">
              <Zap className="w-3.5 h-3.5" /> Calcular Automaticamente
            </button>
          </div>

          {/* ── Preço de Venda ── */}
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
            <p className="text-xs font-semibold text-emerald-700 mb-2">Preço de Venda (por unidade de venda)</p>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-emerald-700 pointer-events-none">R$</span>
              <input type="number" min="0" step="0.01"
                className="w-full border border-emerald-300 rounded-lg pl-9 pr-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                value={form.selling_price ?? ''} onChange={e => set('selling_price', e.target.value)}
                placeholder="0,00" />
            </div>
            <p className="text-[11px] text-emerald-700/80 mt-1.5">Usado no cálculo de margem de lucro na Análise de Custos.</p>
          </div>

          <div className="bg-muted/40 rounded-xl p-4 space-y-3">
            <p className="text-xs font-semibold text-muted-foreground">Consumo Padrão por Unidade Produzida</p>
            <div className="grid grid-cols-2 gap-3">
              {INSUMO_KEYS.map((key, i) => {
                const { pt_field, unit } = INSUMO_FIELDS[key];
                return (
                  <div key={key}>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">
                      {i + 1}. {names[key]} ({unit}/un)
                    </label>
                    <input type="number" min="0" step="0.0001"
                      className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                      value={form[pt_field] ?? ''}
                      onChange={e => set(pt_field, e.target.value)}
                      placeholder="0" />
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input id="active" type="checkbox" checked={form.active !== false} onChange={e => set('active', e.target.checked)} className="rounded border-input" />
            <label htmlFor="active" className="text-sm text-muted-foreground">Ativo</label>
          </div>
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 border border-border rounded-lg py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted transition-colors">Cancelar</button>
            <button type="submit" disabled={saving} className="flex-1 bg-primary text-primary-foreground rounded-lg py-2.5 text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-60">
              {saving ? 'Salvando...' : item ? 'Salvar' : 'Criar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}