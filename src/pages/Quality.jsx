import { useEffect, useState } from 'react';
import { scopedFilter } from '@/lib/companyScope';
import { base44 } from '@/api/base44Client';
import QualityReportForm from '@/components/quality/QualityReportForm';
import QualityReportView from '@/components/quality/QualityReportView';
import { Plus, Search, FileText, Pencil, Trash2, Eye, AlertTriangle, RefreshCw, GitCompare } from 'lucide-react';
import { versionBadge, isRecalculatedReport } from '@/lib/qualityNorms';
import { usePermissions } from '@/lib/PermissionsContext';
import RecalculationDialog from '@/components/quality/RecalculationDialog';
import ReportVersionCompare from '@/components/quality/ReportVersionCompare';

// LAUDOS HISTÓRICOS — NUNCA recalcular automaticamente: a listagem exibe
// EXATAMENTE os valores armazenados em cada laudo.

const STATUS_COLORS = {
  'Rascunho': 'bg-slate-100 text-slate-600',
  'Emitido': 'bg-green-100 text-green-700',
  'Revisado': 'bg-blue-100 text-blue-700',
};

export default function Quality() {
  const { can } = usePermissions();
  const [reports, setReports] = useState([]);
  const [orders, setOrders] = useState([]);
  const [productTypes, setProductTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [viewing, setViewing] = useState(null);
  const [recalcTarget, setRecalcTarget] = useState(null);
  const [compareTarget, setCompareTarget] = useState(null);
  const [versionFilter, setVersionFilter] = useState('all');
  const [error, setError] = useState(null);

  // Rate limit da plataforma é transitório: tenta de novo com uma pausa antes de falhar
  async function fetchWithRetry(fn, attempts = 3) {
    for (let i = 0; i < attempts; i++) {
      try {
        return await fn();
      } catch (e) {
        const isRateLimit = /rate limit/i.test(e.message || '');
        if (!isRateLimit || i === attempts - 1) throw e;
        await new Promise(r => setTimeout(r, 2000 * (i + 1)));
      }
    }
  }

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [r, o, p] = await Promise.all([
        fetchWithRetry(() => base44.entities.QualityReport.filter(scopedFilter(), '-created_date', 500)),
        fetchWithRetry(() => base44.entities.ProductionOrder.filter(scopedFilter({}), '-production_date', 200)),
        fetchWithRetry(() => base44.entities.ProductType.filter(scopedFilter({}), 'name')),
      ]);
      setReports(r); setOrders(o); setProductTypes(p);
    } catch (e) {
      setError(
        /rate limit/i.test(e.message || '')
          ? 'Muitas consultas em sequência. Aguarde alguns segundos e tente novamente.'
          : e.message
      );
    }
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function handleDelete(rep) {
    // Versões originais com recalculados não podem ser apagadas (cadeia preservada)
    const hasVersions = reports.some(r => r.original_report_id === rep.id || r.recalculated_from_report_id === rep.id);
    if (hasVersions) {
      window.alert('Este laudo possui versões recalculadas e não pode ser excluído — a cadeia de versões é preservada.');
      return;
    }
    if (!window.confirm(`Excluir laudo ${rep.report_number}?`)) return;
    await base44.entities.QualityReport.delete(rep.id);
    load();
  }

  function openFromOrder(order) {
    setEditing({ order, product: productTypes.find(p => p.id === order.product_type_id) });
    setShowForm(true);
  }

  const filtered = reports.filter(r => {
    if (versionFilter === 'original' && isRecalculatedReport(r)) return false;
    if (versionFilter === 'recalculated' && !isRecalculatedReport(r)) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return r.report_number?.toLowerCase().includes(q) ||
      r.order_number?.toLowerCase().includes(q) ||
      r.product_type_name?.toLowerCase().includes(q);
  });

  return (
    <div className="p-6 space-y-5 max-w-full mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Qualidade — Laudos Técnicos</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Laudos de resistência conforme NBR 6136 / NBR 9781</p>
        </div>
        {can('QUALITY_EDIT') && (
          <button onClick={() => { setEditing(null); setShowForm(true); }}
            className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-primary/90">
            <Plus className="w-4 h-4" /> Novo Laudo
          </button>
        )}
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input className="w-full pl-9 pr-3 py-2 border border-input rounded-lg text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
          placeholder="Buscar laudo, ordem ou artefato..."
          value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <div className="flex items-center gap-1.5 flex-wrap">
        <span className="text-xs font-medium text-muted-foreground mr-1">Versões:</span>
        {[['all', 'Todas'], ['original', 'Originais'], ['recalculated', 'Recalculadas']].map(([v, label]) => (
          <button key={v} onClick={() => setVersionFilter(v)}
            className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-colors ${versionFilter === v ? 'bg-primary text-primary-foreground' : 'border border-border text-muted-foreground hover:bg-muted'}`}>
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="w-7 h-7 border-4 border-muted border-t-primary rounded-full animate-spin" />
        </div>
      ) : error ? (
        <div className="bg-card rounded-xl border border-border p-8 text-center">
          <AlertTriangle className="w-8 h-8 text-amber-500 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">{error}</p>
          <button onClick={load}
            className="mt-4 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90">
            Tentar novamente
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-card rounded-xl border border-border p-12 text-center text-muted-foreground text-sm">
          Nenhum laudo cadastrado. Crie o primeiro laudo a partir de uma ordem de produção.
        </div>
      ) : (
        <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50 text-xs text-muted-foreground uppercase tracking-wide">
                  <th className="px-4 py-3 text-left font-semibold whitespace-nowrap">Laudo</th>
                  <th className="px-4 py-3 text-left font-semibold whitespace-nowrap">Ordem</th>
                  <th className="px-4 py-3 text-left font-semibold whitespace-nowrap">Artefato</th>
                  <th className="px-4 py-3 text-left font-semibold whitespace-nowrap">Norma</th>
                  <th className="px-4 py-3 text-right font-semibold whitespace-nowrap">Média (MPa)</th>
                  <th className="px-4 py-3 text-right font-semibold whitespace-nowrap">Res. Caract.</th>
                  <th className="px-4 py-3 text-center font-semibold whitespace-nowrap">Conformidade</th>
                  <th className="px-4 py-3 text-left font-semibold whitespace-nowrap">Data Ensaio</th>
                  <th className="px-4 py-3 text-center font-semibold whitespace-nowrap">Status</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {filtered.map(r => {
                  const compliant = r.is_compliant;
                  const charRes = r.characteristic_resistance ?? r.estimated_fck;
                  return (
                    <tr key={r.id} className="border-b border-border hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 font-medium text-foreground">
                        <div className="flex items-center gap-2">
                          {r.report_number}
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${isRecalculatedReport(r) ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-muted text-muted-foreground border-border'}`}>
                            {versionBadge(r.report_number)}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{r.order_number || '—'}</td>
                      <td className="px-4 py-3">{r.product_type_name || '—'}</td>
                      <td className="px-4 py-3 text-xs">{r.norm_reference || '—'}</td>
                      <td className="px-4 py-3 text-right font-semibold">{r.average_resistance != null ? r.average_resistance.toFixed(2) : '—'}</td>
                      <td className="px-4 py-3 text-right">{charRes != null ? charRes.toFixed(2) : '—'}</td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          {compliant != null ? (
                            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${compliant ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                              {compliant ? 'Conforme' : 'Não Conforme'}
                            </span>
                          ) : '—'}
                          {r.alerts?.length > 0 && (
                            <span title={r.alerts.join('\n')} className="inline-flex items-center justify-center text-amber-600">
                              <AlertTriangle className="w-3.5 h-3.5" />
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{r.test_date || '—'}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[r.status] || 'bg-muted text-muted-foreground'}`}>{r.status}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 justify-end">
                          <button onClick={() => setViewing(r)} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted"><Eye className="w-3.5 h-3.5" /></button>
                          <button onClick={() => setCompareTarget(r)} title="Comparar versões" className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted"><GitCompare className="w-3.5 h-3.5" /></button>
                          {can('QUALITY_EDIT') && (
                            <button onClick={() => setRecalcTarget(r)} title="Recalcular conforme revisão normativa" className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted"><RefreshCw className="w-3.5 h-3.5" /></button>
                          )}
                          {can('QUALITY_EDIT') && (
                            <button onClick={() => { setEditing(r); setShowForm(true); }} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted"><Pencil className="w-3.5 h-3.5" /></button>
                          )}
                          {can('QUALITY_EDIT') && (
                            <button onClick={() => handleDelete(r)} className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10"><Trash2 className="w-3.5 h-3.5" /></button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showForm && editing && editing.order && (
        <QualityReportForm
          order={editing.order}
          productType={editing.product || productTypes.find(p => p.id === editing.order.product_type_id)}
          onClose={() => { setShowForm(false); setEditing(null); }}
          onSaved={load}
        />
      )}

      {showForm && editing && !editing.order && (
        <QualityReportForm
          report={editing}
          onClose={() => { setShowForm(false); setEditing(null); }}
          onSaved={load}
        />
      )}

      {showForm && !editing && (
        <OrderPicker
          orders={orders}
          reports={reports}
          productTypes={productTypes}
          onPick={openFromOrder}
          onClose={() => setShowForm(false)}
        />
      )}

      {viewing && (
        <QualityReportView
          report={viewing}
          onClose={() => setViewing(null)}
          onEdit={() => { setEditing(viewing); setShowForm(true); setViewing(null); }}
          onRecalculate={can('QUALITY_EDIT') ? () => { setRecalcTarget(viewing); setViewing(null); } : null}
          onCompare={() => { setCompareTarget(viewing); setViewing(null); }}
        />
      )}

      {recalcTarget && (
        <RecalculationDialog
          report={recalcTarget}
          reports={reports}
          onClose={() => setRecalcTarget(null)}
          onSaved={load}
          onCompare={() => { setCompareTarget(recalcTarget); setRecalcTarget(null); }}
        />
      )}

      {compareTarget && (
        <ReportVersionCompare report={compareTarget} reports={reports} onClose={() => setCompareTarget(null)} />
      )}
    </div>
  );
}

function OrderPicker({ orders, reports, productTypes, onPick, onClose }) {
  const [q, setQ] = useState('');
  const reportedIds = new Set(reports.map(r => r.order_id));
  const concluded = orders.filter(o => o.status === 'Concluída' && !reportedIds.has(o.id));
  const filtered = concluded.filter(o =>
    !q ||
    o.order_number?.toLowerCase().includes(q.toLowerCase()) ||
    o.product_type_name?.toLowerCase().includes(q.toLowerCase())
  );
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-card rounded-xl shadow-xl border border-border w-full max-w-2xl max-h-[80vh] overflow-y-auto">
        <div className="sticky top-0 bg-card border-b border-border px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-foreground">Selecionar Ordem de Produção</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Escolha a ordem concluída para gerar o laudo</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-muted text-muted-foreground text-xl">✕</button>
        </div>
        <div className="p-4 space-y-2">
          <input className="w-full px-3 py-2 border border-input rounded-lg text-sm bg-background" placeholder="Buscar ordem..." value={q} onChange={e => setQ(e.target.value)} />
          {filtered.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-8">Nenhuma ordem concluída encontrada.</p>
          ) : filtered.map(o => (
            <button key={o.id} onClick={() => onPick(o)}
              className="w-full flex items-center justify-between px-4 py-3 rounded-lg border border-border hover:bg-muted/50 transition-colors text-left">
              <div className="flex items-center gap-3">
                <FileText className="w-4 h-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium text-foreground">{o.order_number} — {o.product_type_name}</p>
                  <p className="text-xs text-muted-foreground">{o.production_date} • {o.actual_quantity || 0} un.</p>
                </div>
              </div>
              <span className="text-xs text-primary">Gerar Laudo →</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}