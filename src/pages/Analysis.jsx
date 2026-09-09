import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { useInsumoNames } from '@/hooks/useInsumoNames';
import { useInsumoCosts } from '@/hooks/useInsumoCosts';
import { INSUMO_KEYS, INSUMO_FIELDS } from '@/lib/insumos';
import { Printer } from 'lucide-react';
import AnalysisReport from '@/components/reports/AnalysisReport';
import ProductMultiSelect from '@/components/analysis/ProductMultiSelect';
import TopProducts from '@/components/analysis/TopProducts';
import TraceDeviation from '@/components/analysis/TraceDeviation';
import DailyStability from '@/components/analysis/DailyStability';

function mean(values) {
  if (!values.length) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function formatCurrency(val) {
  return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export default function Analysis() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [productTypes, setProductTypes] = useState([]);
  const [concreteTraces, setConcreteTraces] = useState([]);
  const [downtimes, setDowntimes] = useState([]);
  const [maintenances, setMaintenances] = useState([]);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selectedProducts, setSelectedProducts] = useState([]);
  const [showReport, setShowReport] = useState(false);
  const { names } = useInsumoNames();
  const { costs } = useInsumoCosts();

  useEffect(() => {
    Promise.all([
      base44.entities.ProductionOrder.filter({ status: 'Concluída' }, '-production_date', 500),
      base44.entities.ProductType.list('name'),
      base44.entities.ConcreteTrace.list('name'),
      base44.entities.MachineDowntime.list('-date', 500),
      base44.entities.PreventiveMaintenance.list('-date', 500),
    ]).then(([data, types, traces, downtimes, maintenances]) => {
      setOrders(data); setProductTypes(types); setConcreteTraces(traces);
      setDowntimes(downtimes); setMaintenances(maintenances);
      setLoading(false);
    });
  }, []);

  const filteredOrders = orders.filter(o => {
    const orderDate = (o.production_date || '').slice(0, 10);
    if (dateFrom && orderDate < dateFrom) return false;
    if (dateTo && orderDate > dateTo) return false;
    if (selectedProducts.length > 0 && !selectedProducts.includes(o.product_type_id)) return false;
    return true;
  });

  const hasFilters = dateFrom || dateTo || selectedProducts.length > 0;

  // --- Médias reais por tipo de artefato ---
  const byProductAvg = {};
  filteredOrders.forEach((o) => {
    const name = o.product_type_name || 'Desconhecido';
    if (!byProductAvg[name]) {
      byProductAvg[name] = { name, quantities: [], insumos: {}, prodMinutes: 0 };
      INSUMO_KEYS.forEach((key) => { byProductAvg[name].insumos[key] = []; });
    }
    if (o.actual_quantity) byProductAvg[name].quantities.push(o.actual_quantity);
    byProductAvg[name].prodMinutes += o.production_minutes || 0;
    INSUMO_KEYS.forEach((key) => {
      const { actual } = INSUMO_FIELDS[key];
      if (o[actual]) byProductAvg[name].insumos[key].push(o[actual]);
    });
  });

  const productAvgData = Object.values(byProductAvg).map((p) => {
    const totalQty = p.quantities.reduce((a, b) => a + b, 0);
    const row = {
      name: p.name,
      ordens: p.quantities.length,
      avgQty: parseFloat(mean(p.quantities).toFixed(1)),
      totalQty,
      prodMinutes: p.prodMinutes,
      avgPerHour: p.prodMinutes > 0 ? parseFloat((totalQty / (p.prodMinutes / 60)).toFixed(1)) : null
    };
    INSUMO_KEYS.forEach((key) => {
      row[`avg_${key}`] = parseFloat(mean(p.insumos[key]).toFixed(3));
      row[`total_${key}`] = parseFloat(p.insumos[key].reduce((a, b) => a + b, 0).toFixed(2));
    });
    return row;
  });

  // --- Produção por hora por máquina e produto ---
  const byMachineProd = {};
  const productTypeMap = {};
  productTypes.forEach(pt => { productTypeMap[pt.id] = pt; });
  filteredOrders.forEach((o) => {
    if (!o.machine_name || !o.actual_quantity || !o.production_minutes) return;
    const key = `${o.machine_name} — ${o.product_type_name || 'Desconhecido'}`;
    if (!byMachineProd[key]) {
      const pt = productTypeMap[o.product_type_id];
      byMachineProd[key] = { label: key, machine: o.machine_name, product: o.product_type_name || 'Desconhecido', totalQty: 0, totalMinutes: 0, unitsPerMold: pt?.units_per_mold || null };
    }
    byMachineProd[key].totalQty += o.actual_quantity;
    byMachineProd[key].totalMinutes += o.production_minutes;
  });
  const machineProductRates = Object.values(byMachineProd).map((r) => ({
    ...r,
    ratePerHour: parseFloat((r.totalQty / (r.totalMinutes / 60)).toFixed(1)),
    cyclesPerHour: r.unitsPerMold ? parseFloat((r.totalQty / (r.totalMinutes / 60) / r.unitsPerMold).toFixed(1)) : null
  })).sort((a, b) => b.ratePerHour - a.ratePerHour);

  // --- Produtividade por máquina ---
  const byMachine = {};
  filteredOrders.forEach((o) => {
    if (!o.machine_name) return;
    const name = o.machine_name;
    if (!byMachine[name]) byMachine[name] = { name, totalPlanned: 0, totalActual: 0, ordens: 0, efficiency: [] };
    byMachine[name].totalPlanned += o.planned_quantity || 0;
    byMachine[name].totalActual += o.actual_quantity || 0;
    byMachine[name].ordens += 1;
    if (o.planned_quantity) byMachine[name].efficiency.push((o.actual_quantity || 0) / o.planned_quantity * 100);
  });

  const machineData = Object.values(byMachine).map((m) => ({
    name: m.name,
    'Qtd. Planejada': m.totalPlanned,
    'Qtd. Produzida': m.totalActual,
    'Eficiência (%)': parseFloat(mean(m.efficiency).toFixed(1)),
    ordens: m.ordens
  }));

  return (
    <div className="p-6 space-y-8 max-w-7xl mx-auto">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Análise & Relatórios</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Produtividade, consumo e custos por artefato e máquina</p>
        </div>
        <button onClick={() => setShowReport(true)}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors">
          <Printer className="w-4 h-4" /> Relatório
        </button>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-xs text-muted-foreground mb-1">De</label>
          <input type="date"
            className="border border-input rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
            value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
        </div>
        <div>
          <label className="block text-xs text-muted-foreground mb-1">Até</label>
          <input type="date"
            className="border border-input rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
            value={dateTo} onChange={e => setDateTo(e.target.value)} />
        </div>
        <div>
          <label className="block text-xs text-muted-foreground mb-1">Artefatos</label>
          <ProductMultiSelect products={productTypes} selected={selectedProducts} onChange={setSelectedProducts} />
        </div>
        {hasFilters && (
          <button onClick={() => { setDateFrom(''); setDateTo(''); setSelectedProducts([]); }}
            className="text-xs text-primary hover:underline self-end pb-2">
            Limpar filtros
          </button>
        )}
        {!loading && (
          <span className="self-end pb-2 text-xs text-muted-foreground">
            {filteredOrders.length} ordem(ns) selecionada(s)
          </span>
        )}
      </div>

      {loading ?
      <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
        </div> :

      <>
          {/* ── Produtos mais produzidos ── */}
          {productAvgData.length > 0 && (
            <TopProducts data={productAvgData} />
          )}

          {/* ── Produtividade por máquina ── */}
          <section className="space-y-4">
            <h2 className="text-base font-semibold text-foreground">Produtividade por Máquina</h2>
            <p className="text-xs text-muted-foreground -mt-2">Eficiência real vs. planejado por equipamento</p>

            {machineData.length === 0 ?
          <div className="bg-card border border-border rounded-xl p-12 text-center text-muted-foreground text-sm">
                Nenhuma ordem concluída com máquina vinculada.
              </div> :

          <>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  {machineData.map((m) =>
              <div key={m.name} className="bg-card border border-border rounded-xl p-4 shadow-sm">
                      <p className="font-semibold text-sm text-foreground">{m.name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{m.ordens} ordem(ns)</p>
                      <p className={`text-2xl font-bold mt-3 ${m['Eficiência (%)'] >= 98 ? 'text-green-600' : m['Eficiência (%)'] >= 90 ? 'text-amber-600' : 'text-red-600'}`}>
                        {m['Eficiência (%)'].toFixed(1)}%
                      </p>
                      <p className="text-xs text-muted-foreground">eficiência média</p>
                      <div className="mt-2 h-1.5 bg-muted rounded-full overflow-hidden">
                        <div
                    className={`h-full rounded-full ${m['Eficiência (%)'] >= 98 ? 'bg-green-500' : m['Eficiência (%)'] >= 90 ? 'bg-amber-500' : 'bg-red-500'}`}
                    style={{ width: `${Math.min(m['Eficiência (%)'], 100)}%` }} />
                  
                      </div>
                    </div>
              )}
                </div>
                <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
                  <h3 className="text-sm font-semibold text-foreground mb-4">Volume Planejado vs. Produzido por Máquina</h3>
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={machineData} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(214 32% 91%)" />
                      <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} />
                      <YAxis tick={{ fontSize: 11, fill: '#64748b' }} />
                      <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: 12 }}
                  formatter={(val, name) => [val.toLocaleString('pt-BR'), name]} />
                      <Legend iconType="square" iconSize={10} wrapperStyle={{ fontSize: 12 }} />
                      <Bar dataKey="Qtd. Planejada" fill="#A5B4FC" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="Qtd. Produzida" fill="#4F46E5" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </>
          }
          </section>

          {/* ── Produção por hora: máquina × produto ── */}
          {machineProductRates.length > 0 &&
        <section className="space-y-4">
              <div>
                <h2 className="text-base font-semibold text-foreground">Produção por Hora — Máquina × Artefato</h2>
                <p className="text-xs text-muted-foreground">Velocidade de produção real (un/h) com base no tempo efetivo registrado</p>
              </div>
              <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/50 text-xs text-muted-foreground uppercase tracking-wide">
                      <th className="px-5 py-3 text-left font-semibold">Máquina</th>
                      <th className="px-5 py-3 text-left font-semibold">Artefato</th>
                      <th className="px-5 py-3 text-right font-semibold">Total Produzido</th>
                      <th className="px-5 py-3 text-right font-semibold">Tempo (h)</th>
                      <th className="px-5 py-3 text-right font-semibold">Velocidade (un/h)</th>
                      <th className="px-5 py-3 text-right font-semibold">Artefatos/Molde</th>
                      <th className="px-5 py-3 text-right font-semibold">Ciclos/h</th>
                    </tr>
                  </thead>
                  <tbody>
                    {machineProductRates.map((r) =>
                <tr key={r.label} className="border-b border-border hover:bg-muted/30 transition-colors">
                        <td className="px-5 py-3 font-medium text-foreground whitespace-nowrap">{r.machine}</td>
                        <td className="px-5 py-3 text-muted-foreground">{r.product}</td>
                        <td className="px-5 py-3 text-right">{r.totalQty.toLocaleString('pt-BR')} un</td>
                        <td className="px-5 py-3 text-right text-muted-foreground">{(r.totalMinutes / 60).toFixed(1)} h</td>
                        <td className="px-5 py-3 text-right">
                          <span className={`font-bold text-base ${r.ratePerHour >= 100 ? 'text-green-600' : r.ratePerHour >= 50 ? 'text-amber-600' : 'text-foreground'}`}>
                            {r.ratePerHour.toLocaleString('pt-BR')}
                          </span>
                          <span className="text-xs text-muted-foreground ml-1">un/h</span>
                        </td>
                        <td className="px-5 py-3 text-right text-muted-foreground">{r.unitsPerMold || '—'}</td>
                        <td className="px-5 py-3 text-right">
                          {r.cyclesPerHour !== null ? (
                            <>
                              <span className="font-bold text-primary">{r.cyclesPerHour.toLocaleString('pt-BR')}</span>
                              <span className="text-xs text-muted-foreground ml-1">cic/h</span>
                            </>
                          ) : (
                            <span className="text-muted-foreground text-xs">—</span>
                          )}
                        </td>
                      </tr>
                )}
                  </tbody>
                </table>
              </div>
            </section>
        }

          {/* ── Desvio: produção real vs traço registrado ── */}
          <section className="space-y-4">
            <div>
              <h2 className="text-base font-semibold text-foreground">Desvio de Consumo vs. Traço Registrado</h2>
              <p className="text-xs text-muted-foreground -mt-2">Comparação entre o consumo teórico (traço × traços produzidos) e o consumo real registrado por ordem</p>
            </div>
            <TraceDeviation orders={filteredOrders} productTypes={productTypes} traces={concreteTraces} names={names} />
          </section>

          {/* ── Desvio padrão da produção diária por artefato ── */}
          <section className="space-y-4">
            <div>
              <h2 className="text-base font-semibold text-foreground">Estabilidade da Produção Diária</h2>
              <p className="text-xs text-muted-foreground -mt-2">Desvio padrão da produtividade diária (un/h) de cada artefato — CV alto indica processo instável</p>
            </div>
            <DailyStability orders={filteredOrders} downtimes={downtimes} maintenances={maintenances} />
          </section>

          {/* ── Médias reais por tipo de artefato (com custo) ── */}
          <section className="space-y-4">
            <h2 className="text-base font-semibold text-foreground">Médias de Produção por Tipo de Artefato</h2>
            <p className="text-xs text-muted-foreground -mt-2">Quantidade, consumo médio e custo de insumos por unidade produzida</p>
            {productAvgData.length === 0 ?
          <div className="bg-card border border-border rounded-xl p-12 text-center text-muted-foreground text-sm">
                Nenhuma ordem concluída para calcular médias.
              </div> :

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                {productAvgData.map((p) => {
            let totalCostPerUnit = 0;
            const insumoLines = INSUMO_KEYS.map((key) => {
              const totalInsumo = p[`total_${key}`];
              if (!totalInsumo || !p.totalQty) return null;
              const perUnit = totalInsumo / p.totalQty;
              const { unit } = INSUMO_FIELDS[key];
              const costPerUnit = perUnit * (costs[key] || 0);
              totalCostPerUnit += costPerUnit;
              return { key, perUnit, unit, costPerUnit };
            }).filter(Boolean);

            return (
              <div key={p.name} className="bg-card border border-border p-4 shadow-sm space-y-3 rounded-xl flex flex-col">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-sm text-foreground">{p.name}</span>
                        <span className="text-xs text-muted-foreground">{p.ordens} ordem(ns)</span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 bg-muted/40 rounded-lg p-3">
                        <div className="text-center">
                          <p className="text-xs text-muted-foreground">Média/ordem</p>
                          <p className="text-lg font-bold text-foreground">{p.avgQty.toLocaleString('pt-BR')}</p>
                          <p className="text-xs text-muted-foreground">un.</p>
                        </div>
                        <div className="text-center border-x border-border px-2">
                          <p className="text-xs text-muted-foreground">Total produzido</p>
                          <p className="text-lg font-bold text-primary">{p.totalQty.toLocaleString('pt-BR')}</p>
                          <p className="text-xs text-muted-foreground">un.</p>
                        </div>
                        <div className="text-center">
                          <p className="text-xs text-muted-foreground">Média/hora</p>
                          <p className="text-lg font-bold text-green-600">{p.avgPerHour !== null ? p.avgPerHour.toLocaleString('pt-BR') : '—'}</p>
                          <p className="text-xs text-muted-foreground">un/h</p>
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <p className="text-xs font-semibold text-muted-foreground">Consumo e custo por unidade produzida</p>
                        {insumoLines.map(({ key, perUnit, unit, costPerUnit }) => (
                  <div key={key} className="flex justify-between text-xs items-center">
                            <span className="text-muted-foreground">{names[key]}</span>
                            <div className="flex items-center gap-3">
                              <span className="font-medium text-foreground">{perUnit.toFixed(4)} {unit}/un</span>
                              {costPerUnit > 0 && (
                                <span className="text-muted-foreground">{formatCurrency(costPerUnit)}/un</span>
                              )}
                            </div>
                          </div>
                ))}
                      </div>
                      {totalCostPerUnit > 0 && (
                        <div className="space-y-1.5 pt-2 border-t border-border">
                          <div className="flex justify-between items-center">
                            <span className="text-xs font-semibold text-muted-foreground">Custo total de insumos/un</span>
                            <span className="text-sm font-bold text-primary">{formatCurrency(totalCostPerUnit)}</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-xs font-semibold text-muted-foreground">Custo total da produção</span>
                            <span className="text-sm font-bold text-foreground">{formatCurrency(totalCostPerUnit * p.totalQty)}</span>
                          </div>
                        </div>
                      )}
                    </div>
            );
            })}
              </div>
          }
          </section>
        </>
      }

      {showReport && (
        <AnalysisReport
          initialStart={dateFrom || undefined}
          initialEnd={dateTo || undefined}
          initialProducts={selectedProducts}
          onClose={() => setShowReport(false)}
        />
      )}
    </div>
  );
}