import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useConfig } from '@/lib/ConfigContext';
import ProductCategoryForm from '@/components/settings/ProductCategoryForm';
import MachineForm from '@/components/settings/MachineForm';
import { getActiveIntervals, isProductionMachine } from '@/lib/machineIntervals';
import UnifiedInsumosForm from '@/components/settings/UnifiedInsumosForm';
import ConcreteTraceForm from '@/components/settings/ConcreteTraceForm';
import ArtifactTab from '@/components/settings/ArtifactTab';
import { Plus, Pencil, Trash2, CheckCircle2, XCircle } from 'lucide-react';

const TABS = [
  { key: 'categorias', label: 'Categorias' },
  { key: 'artefatos', label: 'Artefatos' },
  { key: 'tracos', label: 'Traços de Concreto' },
  { key: 'maquinas', label: 'Máquinas' },
  { key: 'insumos', label: 'Insumos e Custos' },
];

export default function ProductionSettings({ canEditCost }) {
  const { refreshConfigs, rawMaterials } = useConfig();
  const [types, setTypes] = useState([]);
  const [machines, setMachines] = useState([]);
  const [traces, setTraces] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('artefatos');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);

  async function load() {
    setLoading(true);
    const [t, m, tr, c] = await Promise.all([
      base44.entities.ProductType.list('name'),
      base44.entities.Machine.list('name'),
      base44.entities.ConcreteTrace.list('name'),
      base44.entities.ProductCategory.list('name'),
    ]);
    setTypes(t); setMachines(m); setTraces(tr); setCategories(c);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function handleDelete(entity, item) {
    if (!window.confirm(`Excluir "${item.name}"?`)) return;
    await base44.entities[entity].delete(item.id);
    load();
    refreshConfigs();
  }

  const newLabel = { categorias: 'Nova Categoria', tracos: 'Novo Traço', maquinas: 'Nova Máquina' }[tab];
  const hasNew = ['categorias', 'tracos', 'maquinas'].includes(tab);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">Cadastros de Produção</h2>
        {hasNew && (
          <button onClick={() => { setEditing(null); setShowForm(true); }}
            className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors">
            <Plus className="w-4 h-4" /> {newLabel}
          </button>
        )}
      </div>

      <div className="flex gap-1 bg-muted rounded-xl p-1 w-fit flex-wrap">
        {TABS.map(t => (
          <button key={t.key} onClick={() => { setTab(t.key); setShowForm(false); setEditing(null); }}
            className={`px-4 py-2 text-sm rounded-lg font-medium transition-all ${tab === t.key ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'insumos' && (
        <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
          <UnifiedInsumosForm canEditCost={canEditCost} />
        </div>
      )}

      {tab === 'categorias' && (
        <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
          {loading ? <Spinner /> : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50 text-xs text-muted-foreground uppercase tracking-wide">
                  <th className="px-5 py-3 text-left font-semibold">Nome</th>
                  <th className="px-5 py-3 text-center font-semibold">Ativo</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody>
                {categories.length === 0 ? (
                  <tr><td colSpan={3} className="px-5 py-12 text-center text-muted-foreground text-sm">Nenhuma categoria cadastrada.</td></tr>
                ) : categories.map(c => (
                  <tr key={c.id} className="border-b border-border hover:bg-muted/30 transition-colors">
                    <td className="px-5 py-3 font-medium text-foreground">{c.name}</td>
                    <td className="px-5 py-3 text-center">
                      {c.active !== false ? <CheckCircle2 className="w-4 h-4 text-green-600 inline" /> : <XCircle className="w-4 h-4 text-muted-foreground inline" />}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2 justify-end">
                        <button onClick={() => { setEditing(c); setShowForm(true); }} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"><Pencil className="w-3.5 h-3.5" /></button>
                        <button onClick={() => handleDelete('ProductCategory', c)} className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === 'artefatos' && (
        <ArtifactTab types={types} traces={traces} loading={loading} categories={categories} onChanged={load} />
      )}

      {tab === 'tracos' && (
        <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
          {loading ? <Spinner /> : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50 text-xs text-muted-foreground uppercase tracking-wide">
                  <th className="px-5 py-3 text-left font-semibold">Nome</th>
                  <th className="px-5 py-3 text-right font-semibold">Resistência</th>
                  <th className="px-5 py-3 text-center font-semibold">Proporção</th>
                  <th className="px-5 py-3 text-right font-semibold">Peso Total (kg)</th>
                  <th className="px-5 py-3 text-right font-semibold">Cimento (kg)</th>
                  <th className="px-5 py-3 text-center font-semibold">Ativo</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody>
                {traces.length === 0 ? (
                  <tr><td colSpan={7} className="px-5 py-12 text-center text-muted-foreground text-sm">Nenhum traço cadastrado. Crie um traço para calcular consumo automaticamente.</td></tr>
                ) : traces.map(t => (
                  <tr key={t.id} className="border-b border-border hover:bg-muted/30 transition-colors">
                    <td className="px-5 py-3 font-medium text-foreground">{t.name}</td>
                    <td className="px-5 py-3 text-right">{t.resistance_mpa ? `${t.resistance_mpa} MPa` : '—'}</td>
                    <td className="px-5 py-3 text-center font-mono text-xs">
                      {t.ratio_label || (t.materials_parts
                        ? rawMaterials.map(m => Math.round(t.materials_parts[m.key] ?? 0)).join(':')
                        : `${Math.round(t.cement_parts)}:${Math.round(t.sand_artificial_parts || 0)}:${Math.round(t.sand_medium_parts || 0)}:${Math.round(t.sand_fine_parts || 0)}:${Math.round(t.gravel_parts || 0)}`)}
                    </td>
                    <td className="px-5 py-3 text-right">{t.total_weight_kg ? `${t.total_weight_kg}` : '—'}</td>
                    <td className="px-5 py-3 text-right">{t.cement_kg_per_m3 ? `${t.cement_kg_per_m3}` : '—'}</td>
                    <td className="px-5 py-3 text-center">
                      {t.active !== false ? <CheckCircle2 className="w-4 h-4 text-green-600 inline" /> : <XCircle className="w-4 h-4 text-muted-foreground inline" />}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2 justify-end">
                        <button onClick={() => { setEditing(t); setShowForm(true); }} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"><Pencil className="w-3.5 h-3.5" /></button>
                        <button onClick={() => handleDelete('ConcreteTrace', t)} className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === 'maquinas' && (
        <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
          {loading ? <Spinner /> : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50 text-xs text-muted-foreground uppercase tracking-wide">
                  <th className="px-5 py-3 text-left font-semibold">Nome</th>
                  <th className="px-5 py-3 text-left font-semibold">Código</th>
                  <th className="px-5 py-3 text-left font-semibold">Tipo</th>
                  <th className="px-5 py-3 text-left font-semibold">Classificação</th>
                  <th className="px-5 py-3 text-left font-semibold">Manutenção (dias)</th>
                  <th className="px-5 py-3 text-center font-semibold">Ativo</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody>
                {machines.length === 0 ? (
                  <tr><td colSpan={7} className="px-5 py-12 text-center text-muted-foreground text-sm">Nenhuma máquina cadastrada.</td></tr>
                ) : machines.map(m => (
                  <tr key={m.id} className="border-b border-border hover:bg-muted/30 transition-colors">
                    <td className="px-5 py-3 font-medium text-foreground">{m.name}</td>
                    <td className="px-5 py-3 text-muted-foreground font-mono text-xs">{m.code}</td>
                    <td className="px-5 py-3 text-muted-foreground">{m.type || '—'}</td>
                    <td className="px-5 py-3">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${isProductionMachine(m) ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                        {m.machine_type || 'Produção'}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-xs text-muted-foreground">
                      <div className="flex flex-col gap-0.5">
                        {Object.entries(getActiveIntervals(m)).map(([k, v]) => (
                          <span key={k}>{k}: {v}d</span>
                        ))}
                      </div>
                    </td>
                    <td className="px-5 py-3 text-center">
                      {m.active !== false ? <CheckCircle2 className="w-4 h-4 text-green-600 inline" /> : <XCircle className="w-4 h-4 text-muted-foreground inline" />}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2 justify-end">
                        <button onClick={() => { setEditing(m); setShowForm(true); }} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"><Pencil className="w-3.5 h-3.5" /></button>
                        <button onClick={() => handleDelete('Machine', m)} className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {showForm && tab === 'categorias' && <ProductCategoryForm item={editing} onClose={() => setShowForm(false)} onSaved={() => { load(); refreshConfigs(); }} />}
      {showForm && tab === 'tracos' && <ConcreteTraceForm item={editing} onClose={() => setShowForm(false)} onSaved={() => { load(); refreshConfigs(); }} />}
      {showForm && tab === 'maquinas' && <MachineForm item={editing} onClose={() => setShowForm(false)} onSaved={() => { load(); refreshConfigs(); }} />}
    </div>
  );
}

function Spinner() {
  return (
    <div className="flex items-center justify-center h-48">
      <div className="w-7 h-7 border-4 border-muted border-t-primary rounded-full animate-spin" />
    </div>
  );
}