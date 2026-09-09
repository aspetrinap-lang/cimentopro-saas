import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Pencil, Trash2, CheckCircle2, XCircle, Layers, ChevronDown, ChevronRight, Plus } from 'lucide-react';
import ProductTypeForm from '@/components/settings/ProductTypeForm';

export default function ArtifactTab({ types, traces, loading, categories, onChanged }) {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [expandedCats, setExpandedCats] = useState({});
  const [filterCat, setFilterCat] = useState('all');

  async function handleDelete(item) {
    if (!window.confirm(`Excluir "${item.name}"?`)) return;
    await base44.entities.ProductType.delete(item.id);
    onChanged();
  }

  function toggleCat(cat) {
    setExpandedCats(s => ({ ...s, [cat]: !s[cat] }));
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="w-7 h-7 border-4 border-muted border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  const catNames = categories.map(c => c.name);
  const typeCats = [...new Set(types.map(t => t.category).filter(Boolean))];
  const allCats = [...new Set([...catNames, ...typeCats])];
  const visibleCats = filterCat === 'all' ? allCats : allCats.filter(c => c === filterCat);
  const uncategorized = types.filter(t => !t.category);

  return (
    <>
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setFilterCat('all')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${filterCat === 'all' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}
          >
            Todas ({types.length})
          </button>
          {catNames.map(cat => {
            const count = types.filter(t => t.category === cat).length;
            return (
              <button
                key={cat}
                onClick={() => setFilterCat(cat)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${filterCat === cat ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}
              >
                {cat} ({count})
              </button>
            );
          })}
        </div>
        <button onClick={() => { setEditing(null); setShowForm(true); }}
          className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors">
          <Plus className="w-4 h-4" /> Novo Artefato
        </button>
      </div>

      <div className="space-y-4">
        {visibleCats.length === 0 && uncategorized.length === 0 && (
          <div className="bg-card rounded-xl border border-border shadow-sm p-12 text-center">
            <Layers className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">
              {types.length === 0
                ? 'Nenhum artefato cadastrado. Clique em "Novo Artefato" para começar.'
                : 'Nenhum artefato nesta subcategoria.'}
            </p>
          </div>
        )}

        {visibleCats.map(cat => {
          const catTypes = types.filter(t => t.category === cat);
          if (catTypes.length === 0) return null;
          const expanded = expandedCats[cat] !== false;
          return (
            <div key={cat} className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
              <button
                onClick={() => toggleCat(cat)}
                className="flex items-center gap-2 w-full px-5 py-3.5 border-b border-border bg-muted/30 hover:bg-muted/50 transition-colors"
              >
                {expanded ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                <Layers className="w-4 h-4 text-primary" />
                <h2 className="text-sm font-semibold text-foreground">{cat}</h2>
                <span className="ml-auto text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">{catTypes.length}</span>
              </button>
              {expanded && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-muted/50 text-xs text-muted-foreground uppercase tracking-wide">
                        <th className="px-5 py-3 text-left font-semibold">Nome</th>
                        <th className="px-5 py-3 text-left font-semibold">Código</th>
                        <th className="px-5 py-3 text-center font-semibold">Dimensões (mm)</th>
                        <th className="px-5 py-3 text-right font-semibold">Peças/m</th>
                        <th className="px-5 py-3 text-right font-semibold">Cimento (kg/un)</th>
                        <th className="px-5 py-3 text-center font-semibold">Traço</th>
                        <th className="px-5 py-3 text-center font-semibold">Classe</th>
                        <th className="px-5 py-3 text-center font-semibold">Ativo</th>
                        <th className="px-5 py-3" />
                      </tr>
                    </thead>
                    <tbody>
                      {catTypes.map(t => (
                        <tr key={t.id} className="border-b border-border hover:bg-muted/30 transition-colors">
                          <td className="px-5 py-3 font-medium text-foreground">{t.name}</td>
                          <td className="px-5 py-3 text-muted-foreground font-mono text-xs">{t.code}</td>
                          <td className="px-5 py-3 text-center text-xs text-muted-foreground whitespace-nowrap">
                            {t.length_mm || t.width_mm || t.height_mm
                              ? `${t.length_mm || '—'} × ${t.width_mm || '—'} × ${t.height_mm || '—'}`
                              : '—'}
                          </td>
                          <td className="px-5 py-3 text-right">{t.pieces_per_m || '—'}</td>
                          <td className="px-5 py-3 text-right">{(t.cement_per_unit || 0).toFixed(4)}</td>
                          <td className="px-5 py-3 text-right text-xs text-muted-foreground">
                            {t.concrete_trace_id ? (traces?.find(tr => tr.id === t.concrete_trace_id)?.name || '—') : '—'}
                          </td>
                          <td className="px-5 py-3 text-center">
                            {t.norm_class ? (
                              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                                {t.norm_class} {t.target_resistance ? `(${t.target_resistance} MPa)` : ''}
                              </span>
                            ) : '—'}
                          </td>
                          <td className="px-5 py-3 text-center">
                            {t.active !== false ? <CheckCircle2 className="w-4 h-4 text-green-600 inline" /> : <XCircle className="w-4 h-4 text-muted-foreground inline" />}
                          </td>
                          <td className="px-5 py-3">
                            <div className="flex items-center gap-2 justify-end">
                              <button onClick={() => { setEditing(t); setShowForm(true); }} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"><Pencil className="w-3.5 h-3.5" /></button>
                              <button onClick={() => handleDelete(t)} className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })}

        {uncategorized.length > 0 && filterCat === 'all' && (
          <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
            <div className="flex items-center gap-2 px-5 py-3.5 border-b border-border bg-muted/30">
              <Layers className="w-4 h-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold text-muted-foreground">Sem categoria</h2>
              <span className="ml-auto text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">{uncategorized.length}</span>
            </div>
            <table className="w-full text-sm">
              <tbody>
                {uncategorized.map(t => (
                  <tr key={t.id} className="border-b border-border hover:bg-muted/30 transition-colors">
                    <td className="px-5 py-3 font-medium text-foreground">{t.name}</td>
                    <td className="px-5 py-3 text-right">
                      <div className="flex items-center gap-2 justify-end">
                        <button onClick={() => { setEditing(t); setShowForm(true); }} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"><Pencil className="w-3.5 h-3.5" /></button>
                        <button onClick={() => handleDelete(t)} className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showForm && (
        <ProductTypeForm
          item={editing}
          onClose={() => { setShowForm(false); setEditing(null); }}
          onSaved={() => { setShowForm(false); setEditing(null); onChanged(); }}
        />
      )}
    </>
  );
}