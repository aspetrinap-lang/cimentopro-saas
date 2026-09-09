import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Printer, TrendingDown, TrendingUp } from 'lucide-react';
import HistoryReport from '@/components/reports/HistoryReport';
import { useInsumoNames } from '@/hooks/useInsumoNames';
import { INSUMO_KEYS, INSUMO_FIELDS } from '@/lib/insumos';
import { consumptionDeviation } from '@/lib/productionMetrics';

// Desvio de consumo: teórico (produzido × consumo por unidade) × real —
// mesmo critério da ficha técnica da ordem (consumptionDeviation).
function DeviationCell({ order, productType, fields }) {
  const dev = consumptionDeviation(order, productType, fields);
  if (!dev) return <td className="px-3 py-3 text-center text-muted-foreground text-xs">—</td>;
  const pct = dev.lossPct;
  const isGain = pct <= 0;
  const Icon = isGain ? TrendingDown : TrendingUp;
  return (
    <td className="px-3 py-3 text-center">
      <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${isGain ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
        <Icon className="w-3 h-3" />{pct > 0 ? '+' : ''}{pct.toFixed(1)}%
      </span>
    </td>
  );
}

export default function History() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [productFilter, setProductFilter] = useState('');
  const [productTypes, setProductTypes] = useState([]);
  const [showReport, setShowReport] = useState(false);
  const { names } = useInsumoNames();

  async function load() {
    setLoading(true);
    const [o, p] = await Promise.all([
      base44.entities.ProductionOrder.filter({ status: 'Concluída' }, '-production_date', 500),
      base44.entities.ProductType.list('name'),
    ]);
    setOrders(o); setProductTypes(p); setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const ptMap = {};
  productTypes.forEach(p => { ptMap[p.id] = p; });

  const filtered = orders.filter(o => {
    if (dateFrom && o.production_date < dateFrom) return false;
    if (dateTo && o.production_date > dateTo) return false;
    if (productFilter && o.product_type_id !== productFilter) return false;
    return true;
  });

  return (
    <div className="p-6 space-y-5 max-w-full mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Histórico</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Ordens concluídas com análise de desvio</p>
        </div>
        <button onClick={() => setShowReport(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors">
          <Printer className="w-4 h-4" /> Relatório
        </button>
      </div>

      <div className="flex flex-wrap gap-3">
        <div>
          <label className="block text-xs text-muted-foreground mb-1">De</label>
          <input type="date" className="border border-input rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
        </div>
        <div>
          <label className="block text-xs text-muted-foreground mb-1">Até</label>
          <input type="date" className="border border-input rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring" value={dateTo} onChange={e => setDateTo(e.target.value)} />
        </div>
        <div>
          <label className="block text-xs text-muted-foreground mb-1">Artefato</label>
          <select className="border border-input rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring" value={productFilter} onChange={e => setProductFilter(e.target.value)}>
            <option value="">Todos</option>
            {productTypes.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        {(dateFrom || dateTo || productFilter) && (
          <div className="self-end">
            <button onClick={() => { setDateFrom(''); setDateTo(''); setProductFilter(''); }} className="text-xs text-primary hover:underline">Limpar filtros</button>
          </div>
        )}
      </div>

      <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="w-7 h-7 border-4 border-muted border-t-primary rounded-full animate-spin" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50 text-xs text-muted-foreground uppercase tracking-wide">
                  <th className="px-3 py-3 text-left font-semibold whitespace-nowrap">Ordem</th>
                  <th className="px-3 py-3 text-left font-semibold whitespace-nowrap">Data</th>
                  <th className="px-3 py-3 text-left font-semibold whitespace-nowrap">Artefato</th>
                  <th className="px-3 py-3 text-right font-semibold whitespace-nowrap">Qtd. Plan.</th>
                  <th className="px-3 py-3 text-right font-semibold whitespace-nowrap">Qtd. Real</th>
                  {INSUMO_KEYS.map(key => (
                    <th key={key} className="px-3 py-3 text-center font-semibold whitespace-nowrap">
                      {names[key]}
                    </th>
                  ))}
                  <th className="px-3 py-3 text-center font-semibold whitespace-nowrap">Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={5 + INSUMO_KEYS.length + 1} className="px-4 py-12 text-center text-muted-foreground text-sm">
                      Nenhum registro encontrado.
                    </td>
                  </tr>
                ) : filtered.map(o => (
                  <tr key={o.id} className="border-b border-border hover:bg-muted/30 transition-colors">
                    <td className="px-3 py-3 font-medium whitespace-nowrap">{o.order_number}</td>
                    <td className="px-3 py-3 text-muted-foreground whitespace-nowrap">{o.production_date}</td>
                    <td className="px-3 py-3 whitespace-nowrap">{o.product_type_name || '—'}</td>
                    <td className="px-3 py-3 text-right">{(o.planned_quantity || 0).toLocaleString('pt-BR')}</td>
                    <td className="px-3 py-3 text-right">{o.actual_quantity != null ? o.actual_quantity.toLocaleString('pt-BR') : '—'}</td>
                    {INSUMO_KEYS.map(key => (
                      <DeviationCell key={key} order={o} productType={ptMap[o.product_type_id]} fields={INSUMO_FIELDS[key]} />
                    ))}
                    <td className="px-3 py-3 text-center whitespace-nowrap">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                        o.status === 'Concluída' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                      }`}>{o.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <p className="text-xs text-muted-foreground">{filtered.length} registro(s) encontrado(s)</p>

      {showReport && (
        <HistoryReport
          initialStart={dateFrom || undefined}
          initialEnd={dateTo || undefined}
          initialProduct={productFilter || undefined}
          onClose={() => setShowReport(false)}
        />
      )}
    </div>
  );
}