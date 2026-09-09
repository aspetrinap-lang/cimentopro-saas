import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import OrderForm from '@/components/orders/OrderForm';
import OrderRow from '@/components/orders/OrderRow';
import OrderTechSheet from '@/components/orders/OrderTechSheet';
import { Plus, Printer, Search } from 'lucide-react';
import { useInsumoNames } from '@/hooks/useInsumoNames';
import OrdersReport from '@/components/reports/OrdersReport';
import { scopedFilter } from '@/lib/companyScope';

export default function Orders() {
  const [orders, setOrders] = useState([]);
  const [productTypes, setProductTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [showReport, setShowReport] = useState(false);
  const { names } = useInsumoNames();

  async function load() {
    setLoading(true);
    const [o, p] = await Promise.all([
      base44.entities.ProductionOrder.filter(scopedFilter(), '-production_date', 200),
      base44.entities.ProductType.filter(scopedFilter(), 'name'),
    ]);
    setOrders(o); setProductTypes(p); setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function handleDelete(order) {
    if (!window.confirm(`Excluir ordem ${order.order_number}?`)) return;
    await base44.entities.ProductionOrder.delete(order.id);
    load();
  }

  function handleEdit(order) { setEditing(order); setShowForm(true); }

  const ptMap = {};
  productTypes.forEach(p => { ptMap[p.id] = p; });

  const filtered = orders.filter(o => {
    const matchSearch = !search ||
      o.order_number?.toLowerCase().includes(search.toLowerCase()) ||
      o.product_type_name?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = !statusFilter || o.status === statusFilter;
    return matchSearch && matchStatus;
  });

  return (
    <div className="p-6 space-y-5 max-w-full mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Ordens de Produção</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{orders.length} ordens registradas</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowReport(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium border border-border text-muted-foreground hover:bg-muted transition-colors">
            <Printer className="w-4 h-4" /> Relatório
          </button>
          <button onClick={() => { setEditing(null); setShowForm(true); }}
            className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors">
            <Plus className="w-4 h-4" /> Nova Ordem
          </button>
        </div>
      </div>

      <div className="flex gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            className="w-full pl-9 pr-3 py-2 border border-input rounded-lg text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
            placeholder="Buscar por nº ou artefato..."
            value={search} onChange={e => setSearch(e.target.value)}
          />
        </div>
        <select className="border border-input rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
          value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="">Todos os Status</option>
          <option value="Em Andamento">Em Andamento</option>
          <option value="Concluída">Concluída</option>
          <option value="Cancelada">Cancelada</option>
        </select>
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
                  <th className="sticky left-0 z-20 bg-muted/50 px-4 py-3 text-left font-semibold whitespace-nowrap shadow-[2px_0_4px_-2px_rgba(0,0,0,0.1)]">Ordem</th>
                  <th className="px-4 py-3 text-left font-semibold whitespace-nowrap">Data</th>
                  <th className="px-4 py-3 text-left font-semibold whitespace-nowrap">Artefato</th>
                  <th className="px-4 py-3 text-right font-semibold whitespace-nowrap">Qtd. Plan.</th>
                  <th className="px-4 py-3 text-right font-semibold whitespace-nowrap">Qtd. Real</th>
                  <th className="px-4 py-3 text-left font-semibold whitespace-nowrap">Atingimento</th>
                  <th className="px-4 py-3 text-center font-semibold whitespace-nowrap">Status</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center text-muted-foreground text-sm">
                      Nenhuma ordem encontrada.
                    </td>
                  </tr>
                ) : filtered.map(o => (
                  <OrderRow key={o.id} order={o} onEdit={handleEdit} onDelete={handleDelete} onSelect={setSelectedOrder} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showForm && (
        <OrderForm order={editing} productTypes={productTypes} onClose={() => setShowForm(false)} onSaved={load} />
      )}

      {selectedOrder && (
        <OrderTechSheet
          order={selectedOrder}
          productType={ptMap[selectedOrder.product_type_id]}
          names={names}
          onClose={() => setSelectedOrder(null)}
        />
      )}

      {showReport && <OrdersReport onClose={() => setShowReport(false)} />}
    </div>
  );
}