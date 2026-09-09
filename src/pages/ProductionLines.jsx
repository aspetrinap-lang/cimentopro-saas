import { useEffect, useState, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { Plus, Printer, Search, Pencil, Trash2, Eye, Layers, Zap, DollarSign, Activity, Power, Boxes } from 'lucide-react';
import ProductionLineForm from '@/components/lines/ProductionLineForm';
import ProductionLineDetail from '@/components/lines/ProductionLineDetail';
import SharedResourceManager from '@/components/lines/SharedResourceManager';
import ProductionLinesReport from '@/components/reports/ProductionLinesReport';
import { fmtNum } from '@/lib/statsUtils';

export default function ProductionLines() {
  const [lines, setLines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [viewing, setViewing] = useState(null);
  const [showResources, setShowResources] = useState(false);
  const [showReport, setShowReport] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await base44.entities.ProductionLine.list('-created_date', 200);
      setLines(data);
    } catch (e) {
      setLines([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  function handleNew() { setEditing(null); setShowForm(true); }
  function handleEdit(line) { setEditing(line); setShowForm(true); }

  async function handleDelete(line) {
    if (!confirm(`Excluir a linha "${line.name}"?`)) return;
    await base44.entities.ProductionLine.delete(line.id);
    load();
  }

  const filtered = lines.filter((l) =>
    !search || l.name.toLowerCase().includes(search.toLowerCase()) || (l.description || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Layers className="w-5 h-5 text-primary" /> Linhas de Produção
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">Cadastre linhas industriais e organize os equipamentos em sequência operacional.</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowReport(true)}
            className="flex items-center gap-2 border border-border bg-card px-4 py-2.5 rounded-lg text-sm font-medium text-foreground hover:bg-muted transition-colors">
            <Printer className="w-4 h-4 text-primary" /> Relatório
          </button>
          <button onClick={() => setShowResources(true)} className="flex items-center gap-2 border border-border bg-card px-4 py-2.5 rounded-lg text-sm font-medium text-foreground hover:bg-muted transition-colors">
            <Boxes className="w-4 h-4 text-primary" /> Recursos Compartilhados
          </button>
          <button onClick={handleNew} className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors">
            <Plus className="w-4 h-4" /> Nova Linha
          </button>
        </div>
      </div>

      <div className="relative">
        <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
        <input className="w-full pl-9 pr-3 py-2 border border-input rounded-lg text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
          placeholder="Buscar linha..." value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16"><div className="w-8 h-8 border-4 border-slate-200 border-t-primary rounded-full animate-spin" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <Layers className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Nenhuma linha cadastrada. Clique em "Nova Linha" para começar.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((line) => {
            const machines = line.machines || [];
            const usedPower = Number(line.used_power_kw) || machines.reduce((s, m) => s + (Number(m.power_kw) || 0), 0);
            return (
              <div key={line.id} className="bg-card border border-border rounded-xl p-4 shadow-sm flex flex-col">
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-foreground truncate">{line.name}</h3>
                      {line.active === false && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">Inativa</span>}
                    </div>
                    {line.description && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{line.description}</p>}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => setViewing(line)} className="p-1.5 text-muted-foreground hover:text-primary rounded-lg hover:bg-muted" title="Detalhes"><Eye className="w-4 h-4" /></button>
                    <button onClick={() => handleEdit(line)} className="p-1.5 text-muted-foreground hover:text-primary rounded-lg hover:bg-muted" title="Editar"><Pencil className="w-4 h-4" /></button>
                    <button onClick={() => handleDelete(line)} className="p-1.5 text-muted-foreground hover:text-destructive rounded-lg hover:bg-muted" title="Excluir"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs mb-3">
                  <div className="flex items-center gap-1.5 bg-muted/40 rounded-lg p-2 border border-border">
                    <Power className="w-3.5 h-3.5 text-primary" />
                    <div><p className="text-muted-foreground text-[10px]">Pot. Instalada</p><p className="font-semibold text-foreground">{fmtNum(line.installed_power_kw, 4)} kW</p></div>
                  </div>
                  <div className="flex items-center gap-1.5 bg-muted/40 rounded-lg p-2 border border-border">
                    <Zap className="w-3.5 h-3.5 text-amber-500" />
                    <div><p className="text-muted-foreground text-[10px]">Pot. Utilizada</p><p className="font-semibold text-foreground">{fmtNum(usedPower, 4)} kW</p></div>
                  </div>
                  <div className="flex items-center gap-1.5 bg-muted/40 rounded-lg p-2 border border-border">
                    <Activity className="w-3.5 h-3.5 text-green-600" />
                    <div><p className="text-muted-foreground text-[10px]">Capacidade</p><p className="font-semibold text-foreground">{fmtNum(line.production_capacity_per_hour, 0)} cic/h</p></div>
                  </div>
                  <div className="flex items-center gap-1.5 bg-muted/40 rounded-lg p-2 border border-border">
                    <DollarSign className="w-3.5 h-3.5 text-primary" />
                    <div><p className="text-muted-foreground text-[10px]">Custo Energia</p><p className="font-semibold text-foreground">{fmtNum(line.energy_cost_per_kwh, 2)}/kWh</p></div>
                  </div>
                </div>

                <div className="mt-auto">
                  <p className="text-[10px] text-muted-foreground mb-1.5">Equipamentos ({machines.length})</p>
                  {machines.length === 0 ? (
                    <p className="text-xs text-muted-foreground/70">Nenhuma máquina vinculada.</p>
                  ) : (
                    <div className="flex flex-wrap gap-1">
                      {machines.sort((a, b) => (a.sequence_order || 0) - (b.sequence_order || 0)).map((m, i) => (
                        <span key={i} className="text-[10px] px-1.5 py-0.5 rounded-md bg-muted text-muted-foreground border border-border">
                          {m.sequence_order || i + 1}. {m.machine_name || '—'}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showForm && (
        <ProductionLineForm
          line={editing}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); load(); }}
        />
      )}
      {viewing && (
        <ProductionLineDetail line={viewing} onClose={() => setViewing(null)} />
      )}
      {showResources && (
        <SharedResourceManager onClose={() => setShowResources(false)} onSaved={load} />
      )}
      {showReport && <ProductionLinesReport onClose={() => setShowReport(false)} />}
    </div>
  );
}