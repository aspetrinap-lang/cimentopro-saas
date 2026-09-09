import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { AlertTriangle, Clock, CheckCircle2, Wrench, Plus, Printer, RefreshCw, Pencil, Trash2 } from 'lucide-react';
import MachineDowntimeForm from '@/components/orders/MachineDowntimeForm';
import { usePermissions } from '@/lib/PermissionsContext';
import MaintenanceAlerts from '@/components/dashboard/MaintenanceAlerts';
import MachinesReport from '@/components/reports/MachinesReport';
import { format, subDays, parseISO, isAfter } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const CATEGORY_COLORS = {
  'Elétrico': '#4F46E5',
  'Mecânico': '#F97316',
  'Pneumático': '#06B6D4',
  'Hidráulico': '#14B8A6',
  'Operacional': '#F59E0B',
  'Manutenção Preventiva': '#8B5CF6',
  'Falta de Material': '#EC4899',
  'Outros': '#94A3B8',
};

const PERIODS = [
  { label: '7 dias', days: 7 },
  { label: '30 dias', days: 30 },
  { label: '90 dias', days: 90 },
];

function fmt(min) {
  if (min < 60) return `${min}min`;
  return `${Math.floor(min / 60)}h ${min % 60}min`;
}

export default function MachineDashboard() {
  const { can } = usePermissions();
  const [downtimes, setDowntimes] = useState([]);
  const [orders, setOrders] = useState([]);
  const [machines, setMachines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState(30);
  const [showForm, setShowForm] = useState(false);
  const [editingDowntime, setEditingDowntime] = useState(null);
  const [selectedMachine, setSelectedMachine] = useState('');
  const [showReport, setShowReport] = useState(false);

  async function load() {
    setLoading(true);
    const [d, o, m] = await Promise.all([
      base44.entities.MachineDowntime.list('-date', 500),
      base44.entities.ProductionOrder.list('-production_date', 500),
      base44.entities.Machine.list('name'),
    ]);
    setDowntimes(d); setOrders(o); setMachines(m);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  // Filtrar pelo período
  const cutoff = subDays(new Date(), period);
  const filteredDT = downtimes.filter(d => d.date && isAfter(parseISO(d.date), cutoff));
  const filteredOrders = orders.filter(o => o.production_date && isAfter(parseISO(o.production_date), cutoff));

  // Minutos disponíveis por máquina no período (8h/dia × dias)
  const workMinutesPerDay = 8 * 60;

  // Agrupar downtime por máquina
  const byMachine = {};
  machines.forEach(m => {
    byMachine[m.id] = { id: m.id, name: m.name, downtimeMinutes: 0, occurrences: 0, categories: {}, prodMinutes: 0, orders: 0 };
  });

  filteredDT.forEach(d => {
    if (!byMachine[d.machine_id]) {
      byMachine[d.machine_id] = { id: d.machine_id, name: d.machine_name || d.machine_id, downtimeMinutes: 0, occurrences: 0, categories: {}, prodMinutes: 0, orders: 0 };
    }
    byMachine[d.machine_id].downtimeMinutes += d.duration_minutes || 0;
    byMachine[d.machine_id].occurrences += 1;
    const cat = d.failure_category || 'Outros';
    byMachine[d.machine_id].categories[cat] = (byMachine[d.machine_id].categories[cat] || 0) + (d.duration_minutes || 0);
  });

  filteredOrders.forEach(o => {
    if (!o.machine_id) return;
    if (!byMachine[o.machine_id]) return;
    byMachine[o.machine_id].prodMinutes += o.production_minutes || 0;
    byMachine[o.machine_id].orders += 1;
  });

  const machineStats = Object.values(byMachine).filter(m => m.downtimeMinutes > 0 || m.orders > 0);

  // KPIs totais
  const totalDowntime = filteredDT.reduce((s, d) => s + (d.duration_minutes || 0), 0);
  const totalOccurrences = filteredDT.length;
  const totalProdMinutes = filteredOrders.reduce((s, o) => s + (o.production_minutes || 0), 0);

  // Falhas por categoria (para o pie)
  const catTotals = {};
  filteredDT.forEach(d => {
    const cat = d.failure_category || 'Outros';
    catTotals[cat] = (catTotals[cat] || 0) + (d.duration_minutes || 0);
  });
  const pieData = Object.entries(catTotals).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);

  // Evolução temporal (por semana)
  const timelineData = {};
  filteredDT.forEach(d => {
    const week = format(parseISO(d.date), "'Sem' w/yyyy", { locale: ptBR });
    if (!timelineData[week]) timelineData[week] = { week };
    const cat = d.failure_category || 'Outros';
    timelineData[week][cat] = (timelineData[week][cat] || 0) + (d.duration_minutes || 0);
  });
  const timeline = Object.values(timelineData).slice(-8);

  // Máquinas disponíveis para filtro
  const machineOptions = machines.filter(m => machineStats.find(s => s.id === m.id));

  // Histórico filtrado
  const historyFiltered = filteredDT
    .filter(d => !selectedMachine || d.machine_id === selectedMachine)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 50);

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dashboard de Máquinas</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Tempo produtivo, paradas e eficiência por equipamento</p>
        </div>
        <div className="flex gap-2">
          <button onClick={load} disabled={loading}
            className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg border border-border text-muted-foreground hover:bg-muted transition-colors disabled:opacity-50">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button onClick={() => setShowReport(true)}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors">
            <Printer className="w-4 h-4" /> Relatório
          </button>
          {can('MACHINES_EDIT') && (
            <button onClick={() => setShowForm(true)}
              className="flex items-center gap-2 bg-amber-500 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-amber-600 transition-colors">
              <Plus className="w-4 h-4" /> Registrar Parada
            </button>
          )}
        </div>
      </div>

      {/* Período */}
      <div className="flex gap-1 bg-muted rounded-xl p-1 w-fit">
        {PERIODS.map(p => (
          <button key={p.days} onClick={() => setPeriod(p.days)}
            className={`px-4 py-2 text-sm rounded-lg font-medium transition-all ${period === p.days ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
            {p.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
        </div>
      ) : (
        <>
          <MaintenanceAlerts />

          {/* KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'Tempo de Parada', value: fmt(totalDowntime), sub: `${period} dias`, icon: AlertTriangle, color: 'bg-red-50 text-red-600' },
              { label: 'Ocorrências', value: totalOccurrences, sub: 'falhas registradas', icon: Wrench, color: 'bg-orange-50 text-orange-600' },
              { label: 'Tempo em Produção', value: fmt(totalProdMinutes), sub: 'todas as máquinas', icon: Clock, color: 'bg-green-50 text-green-600' },
              { label: 'Disponibilidade Méd.', value: machineStats.length > 0
                  ? `${Math.round(machineStats.reduce((s, m) => {
                      const total = m.prodMinutes + m.downtimeMinutes;
                      return s + (total > 0 ? (m.prodMinutes / total) * 100 : 100);
                    }, 0) / machineStats.length)}%`
                  : '—',
                sub: 'prod / (prod+parada)', icon: CheckCircle2, color: 'bg-indigo-50 text-indigo-600' },
            ].map(card => (
              <div key={card.label} className="bg-card rounded-xl border border-border p-5 shadow-sm">
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${card.color} mb-3`}>
                  <card.icon className="w-4 h-4" />
                </div>
                <p className="text-2xl font-bold text-foreground">{card.value}</p>
                <p className="text-xs font-medium text-muted-foreground mt-1">{card.label}</p>
                <p className="text-xs text-muted-foreground/70">{card.sub}</p>
              </div>
            ))}
          </div>

          {/* Cards por máquina */}
          {machineStats.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-base font-semibold text-foreground">Eficiência por Máquina</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {machineStats.map(m => {
                  const total = m.prodMinutes + m.downtimeMinutes;
                  const avail = total > 0 ? Math.round((m.prodMinutes / total) * 100) : null;
                  const topCat = Object.entries(m.categories).sort((a, b) => b[1] - a[1])[0];
                  return (
                    <div key={m.id} className="bg-card border border-border rounded-xl p-4 shadow-sm space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-sm text-foreground">{m.name}</span>
                        <span className="text-xs text-muted-foreground">{m.orders} ordem(ns)</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="bg-green-50 rounded-lg p-2">
                          <p className="text-green-600 font-semibold text-sm">{fmt(m.prodMinutes)}</p>
                          <p className="text-green-700">em produção</p>
                        </div>
                        <div className="bg-red-50 rounded-lg p-2">
                          <p className="text-red-600 font-semibold text-sm">{fmt(m.downtimeMinutes)}</p>
                          <p className="text-red-700">{m.occurrences} parada(s)</p>
                        </div>
                      </div>
                      {avail !== null && (
                        <div>
                          <div className="flex justify-between text-xs mb-1">
                            <span className="text-muted-foreground">Disponibilidade</span>
                            <span className={`font-semibold ${avail >= 90 ? 'text-green-600' : avail >= 75 ? 'text-amber-600' : 'text-red-600'}`}>{avail}%</span>
                          </div>
                          <div className="h-2 bg-muted rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${avail >= 90 ? 'bg-green-500' : avail >= 75 ? 'bg-amber-500' : 'bg-red-500'}`}
                              style={{ width: `${avail}%` }} />
                          </div>
                        </div>
                      )}
                      {topCat && (
                        <p className="text-xs text-muted-foreground border-t border-border pt-2">
                          Principal falha: <span className="font-medium text-foreground">{topCat[0]}</span> ({fmt(topCat[1])})
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* Gráficos */}
          {pieData.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Pie: paradas por categoria */}
              <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
                <h3 className="text-sm font-semibold text-foreground mb-4">Paradas por Categoria (min)</h3>
                <div className="flex items-center gap-4">
                  <ResponsiveContainer width="50%" height={200}>
                    <PieChart>
                      <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80}>
                        {pieData.map((entry) => (
                          <Cell key={entry.name} fill={CATEGORY_COLORS[entry.name] || '#94A3B8'} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v) => [`${fmt(v)}`, '']} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex-1 space-y-1.5">
                    {pieData.map(item => (
                      <div key={item.name} className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-1.5">
                          <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: CATEGORY_COLORS[item.name] || '#94A3B8' }} />
                          <span className="text-muted-foreground">{item.name}</span>
                        </div>
                        <span className="font-semibold text-foreground">{fmt(item.value)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Bar: parada por máquina */}
              <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
                <h3 className="text-sm font-semibold text-foreground mb-4">Paradas por Máquina (min)</h3>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={machineStats.map(m => ({ name: m.name, 'Parada (min)': m.downtimeMinutes, 'Produção (min)': m.prodMinutes }))}
                    margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(214 32% 91%)" />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} />
                    <YAxis tick={{ fontSize: 11, fill: '#64748b' }} />
                    <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: 12 }} />
                    <Legend iconType="square" iconSize={10} wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="Produção (min)" fill="#22C55E" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Parada (min)" fill="#EF4444" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Paradas por categoria separado por máquina */}
          {machineStats.filter(m => m.downtimeMinutes > 0).length > 0 && (
            <section className="space-y-3">
              <h2 className="text-base font-semibold text-foreground">Paradas por Categoria — por Máquina (min)</h2>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {machineStats.filter(m => m.downtimeMinutes > 0).map(m => {
                  const cats = Object.entries(m.categories).sort((a, b) => b[1] - a[1]);
                  const barData = cats.map(([cat, min]) => ({ cat: cat.length > 12 ? cat.slice(0, 12) + '…' : cat, fullCat: cat, min }));
                  return (
                    <div key={m.id} className="bg-card border border-border rounded-xl p-4 shadow-sm">
                      <p className="text-sm font-semibold text-foreground mb-3">{m.name}</p>
                      <ResponsiveContainer width="100%" height={160}>
                        <BarChart data={barData} layout="vertical" margin={{ top: 0, right: 16, left: 8, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(214 32% 91%)" horizontal={false} />
                          <XAxis type="number" tick={{ fontSize: 10, fill: '#64748b' }} unit=" min" />
                          <YAxis type="category" dataKey="cat" tick={{ fontSize: 10, fill: '#64748b' }} width={90} />
                          <Tooltip
                            contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: 12 }}
                            formatter={(v, _n, props) => [fmt(v), props.payload.fullCat]}
                            labelFormatter={() => ''}
                          />
                          <Bar dataKey="min" radius={[0, 4, 4, 0]}>
                            {barData.map((entry) => (
                              <Cell key={entry.fullCat} fill={CATEGORY_COLORS[entry.fullCat] || '#94A3B8'} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* Histórico de paradas */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-foreground">Histórico de Paradas</h2>
              <select className="border border-input rounded-lg px-3 py-1.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                value={selectedMachine} onChange={e => setSelectedMachine(e.target.value)}>
                <option value="">Todas as máquinas</option>
                {machines.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </div>
            <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
              {historyFiltered.length === 0 ? (
                <div className="p-12 text-center text-muted-foreground text-sm">
                  Nenhuma parada registrada. Use o botão "Registrar Parada" para começar.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-muted/50 text-xs text-muted-foreground uppercase tracking-wide">
                        <th className="px-4 py-3 text-left font-semibold">Data</th>
                        <th className="px-4 py-3 text-left font-semibold">Máquina</th>
                        <th className="px-4 py-3 text-left font-semibold">Categoria</th>
                        <th className="px-4 py-3 text-right font-semibold">Duração</th>
                        <th className="px-4 py-3 text-left font-semibold">Descrição</th>
                        <th className="px-4 py-3 text-left font-semibold">Ação Corretiva</th>
                        <th className="px-4 py-3" />
                      </tr>
                    </thead>
                    <tbody>
                      {historyFiltered.map(d => (
                        <tr key={d.id} className="border-b border-border hover:bg-muted/30 transition-colors">
                          <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                            {d.date}{d.start_time ? ` ${d.start_time}` : ''}
                          </td>
                          <td className="px-4 py-3 font-medium whitespace-nowrap">{d.machine_name || '—'}</td>
                          <td className="px-4 py-3">
                            <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full"
                              style={{ backgroundColor: (CATEGORY_COLORS[d.failure_category] || '#94A3B8') + '20', color: CATEGORY_COLORS[d.failure_category] || '#64748b' }}>
                              {d.failure_category}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right font-semibold text-red-600 whitespace-nowrap">{fmt(d.duration_minutes || 0)}</td>
                          <td className="px-4 py-3 text-muted-foreground max-w-xs truncate">{d.failure_description || '—'}</td>
                          <td className="px-4 py-3 text-muted-foreground max-w-xs truncate">{d.corrective_action || '—'}</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1.5 justify-end">
                              {can('MACHINES_EDIT') && (
                                <button onClick={() => { setEditingDowntime(d); setShowForm(true); }}
                                  className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                                  <Pencil className="w-3.5 h-3.5" />
                                </button>
                              )}
                              {can('MACHINES_DELETE') && (
                                <button onClick={async () => {
                                  if (!window.confirm('Excluir este registro de parada?')) return;
                                  await base44.entities.MachineDowntime.delete(d.id);
                                  load();
                                }}
                                  className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors">
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </section>
        </>
      )}

      {showReport && <MachinesReport onClose={() => setShowReport(false)} />}

      {showForm && (
        <MachineDowntimeForm
          item={editingDowntime}
          onClose={() => { setShowForm(false); setEditingDowntime(null); }}
          onSaved={() => { setShowForm(false); setEditingDowntime(null); load(); }}
        />
      )}
    </div>
  );
}