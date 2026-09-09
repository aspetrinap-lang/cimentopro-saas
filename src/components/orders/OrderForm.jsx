import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { X, AlertTriangle } from 'lucide-react';
import { useInsumoNames } from '@/hooks/useInsumoNames';
import { INSUMO_KEYS, INSUMO_FIELDS, INSUMO_TRACE_PARTS } from '@/lib/insumos';
import MachineDowntimeForm from './MachineDowntimeForm';
import { useBackButtonClose } from '@/hooks/useBackButtonClose';
import { scopedFilter, withCompany, assertSameCompany, activeCompanyId } from '@/lib/companyScope';

const LOSS_FIELDS = [
  { key: 'loss_second_line', label: '2ª Linha' },
  { key: 'loss_discarded', label: 'Descartadas' },
];

const emptyForm = {
  order_number: '',
  order_year: new Date().getFullYear(),
  order_sequence: 0,
  product_type_id: '',
  product_type_name: '',
  machine_id: '',
  machine_name: '',
  machine_cycles_total: '',
  production_date: new Date().toISOString().split('T')[0],
  start_time: '',
  end_time: '',
  production_minutes: '',
  operator_id: '',
  operator_name: '',
  shift: '',
  planned_quantity: '',
  actual_quantity: '',
  actual_traces_produced: '',
  raw_material_moisture: '',
  loss_reason: '',
  status: 'Em Andamento',
  notes: '',
};

export default function OrderForm({ order, productTypes, onClose, onSaved }) {
  const [form, setForm] = useState(order ? { ...order } : { ...emptyForm });
  const [saving, setSaving] = useState(false);
  const [machines, setMachines] = useState([]);
  const [molds, setMolds] = useState([]);
  const [concreteTraces, setConcreteTraces] = useState([]);
  const [operators, setOperators] = useState([]);
  const [generatingNumber, setGeneratingNumber] = useState(false);
  const [showDowntime, setShowDowntime] = useState(false);
  const [saveError, setSaveError] = useState('');
  const { names } = useInsumoNames();
  useBackButtonClose(onClose);

  // Busca molde que contenha o product_type_id selecionado no array product_type_ids
  function findMoldForProduct(productTypeId) {
    return molds.find(m => (m.product_type_ids || []).includes(productTypeId));
  }

  // Calcula ciclos da máquina baseado em quantidade e peças por ciclo do molde
  function calcCycles(quantity, moldUnitsPerCycle) {
    if (!quantity || !moldUnitsPerCycle || moldUnitsPerCycle <= 0) return null;
    return Math.ceil(parseFloat(quantity) / moldUnitsPerCycle);
  }

  // Calcula quantidade a partir de ciclos e peças por ciclo do molde
  function calcQuantity(cycles, moldUnitsPerCycle) {
    if (!cycles || !moldUnitsPerCycle || moldUnitsPerCycle <= 0) return null;
    return parseFloat(cycles) * moldUnitsPerCycle;
  }

  async function generateOrderNumber() {
    setGeneratingNumber(true);
    const year = new Date().getFullYear();
    const yearShort = String(year).slice(-2);
    const existingOrders = await base44.entities.ProductionOrder.filter(scopedFilter({ order_year: year }), 'order_sequence', 500);
    const maxSeq = existingOrders.length > 0
      ? Math.max(...existingOrders.map(o => o.order_sequence || 0))
      : 0;
    const nextSeq = maxSeq + 1;
    setForm(f => ({
      ...f,
      order_number: `${String(nextSeq).padStart(3, '0')}/${yearShort}`,
      order_year: year,
      order_sequence: nextSeq,
    }));
    setGeneratingNumber(false);
  }

  useEffect(() => {
    base44.entities.Machine.filter(scopedFilter({ active: true }), 'name').then(ms => setMachines(ms.filter(m => m.machine_type !== 'Movimentação')));
    base44.entities.Mold.filter({ status: 'Ativo' }, 'name').then(setMolds);
    base44.entities.ConcreteTrace.filter(scopedFilter({ active: true }), 'name').then(setConcreteTraces);
    base44.entities.UserPin.filter(scopedFilter({ active: true }), 'name').then(setOperators);
    if (!order) generateOrderNumber();
  }, []);

  const selectedType = productTypes.find(p => p.id === form.product_type_id);
  const qty = parseFloat(form.planned_quantity) || 0;
  const linkedMoldForCalc = selectedType ? findMoldForProduct(selectedType.id) : null;
  const unitsPerCycle = linkedMoldForCalc?.units_per_cycle ?? selectedType?.units_per_mold ?? null;

  function set(field, val) { setForm(f => ({ ...f, [field]: val })); }

  function calcMinutes(updated) {
    if (updated.start_time && updated.end_time) {
      const [sh, sm] = updated.start_time.split(':').map(Number);
      const [eh, em] = updated.end_time.split(':').map(Number);
      let mins = (eh * 60 + em) - (sh * 60 + sm);
      if (mins < 0) mins += 24 * 60;
      const lunchDiscount = parseInt(updated.lunch_minutes) || 0;
      updated.production_minutes = Math.max(0, mins - lunchDiscount);
    }
    return updated;
  }

  function handleTimeChange(field, val) {
    const updated = calcMinutes({ ...form, [field]: val });
    setForm(updated);
  }

  function handleLunchChange(val) {
    const updated = calcMinutes({ ...form, lunch_minutes: val });
    setForm(updated);
  }

  function handleTypeChange(id) {
    const pt = productTypes.find(p => p.id === id);
    const mold = findMoldForProduct(id);
    const upc = mold?.units_per_cycle ?? pt?.units_per_mold ?? null;
    const plannedQty = calcQuantity(form.machine_cycles_planned, upc);
    const actualQty = calcQuantity(form.machine_cycles_actual, upc);
    setForm(f => ({
      ...f,
      product_type_id: id,
      product_type_name: pt ? pt.name : '',
      planned_quantity: plannedQty,
      actual_quantity: actualQty,
    }));
  }

  function handleMachineChange(id) {
    const m = machines.find(m => m.id === id);
    setForm(f => ({ ...f, machine_id: id, machine_name: m ? m.name : '' }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setSaveError('');
    try {
      // Isolamento multiempresa: referências só podem ser da empresa ativa
      await assertSameCompany([
        { entity: 'ProductType', id: form.product_type_id, label: 'Artefato selecionado' },
        { entity: 'Machine', id: form.machine_id, label: 'Máquina selecionada' },
        { entity: 'UserPin', id: form.operator_id, label: 'Operador selecionado' },
      ]);
      if (order?.id && order.company_id && order.company_id !== activeCompanyId()) {
        throw new Error('Esta ordem não pertence à empresa ativa.');
      }
    } catch (err) {
      setSaveError(err.message);
      setSaving(false);
      return;
    }
    const pt = productTypes.find(p => p.id === form.product_type_id);
    const payload = { ...form, planned_quantity: qty };
    const tracesQty = parseFloat(form.actual_traces_produced) || 0;
    const linkedTrace = concreteTraces.find(t => t.id === pt?.concrete_trace_id);
    INSUMO_KEYS.forEach(key => {
      const { pt_field, planned, actual } = INSUMO_FIELDS[key];
      payload[planned] = pt && pt[pt_field] ? qty * pt[pt_field] : null;
      payload[actual] = form[actual] != null && form[actual] !== '' ? parseFloat(form[actual]) : null;
    });
    payload.actual_traces_produced = form.actual_traces_produced ? parseFloat(form.actual_traces_produced) : null;
    payload.actual_quantity = form.actual_quantity ? parseFloat(form.actual_quantity) : null;
    payload.production_minutes = form.production_minutes ? parseFloat(form.production_minutes) : null;
    payload.machine_cycles_total = form.machine_cycles_total ? parseFloat(form.machine_cycles_total) : null;
    payload.machine_cycles_planned = form.machine_cycles_planned != null ? parseFloat(form.machine_cycles_planned) : null;
    payload.machine_cycles_actual = form.machine_cycles_actual != null ? parseFloat(form.machine_cycles_actual) : null;

    ['loss_second_line', 'loss_discarded'].forEach(k => {
      payload[k] = form[k] != null && form[k] !== '' ? parseInt(form[k], 10) : 0;
    });
    payload.raw_material_moisture = form.raw_material_moisture != null && form.raw_material_moisture !== '' ? parseFloat(form.raw_material_moisture) : null;
    payload.loss_reason = form.loss_reason || null;

    // Função auxiliar para atualizar ciclos do molde usando machine_cycles_actual
    async function updateMoldCycles(cyclesAdd) {
      if (!pt || !cyclesAdd || cyclesAdd <= 0) return;
      const mold = findMoldForProduct(pt.id);
      if (!mold) return;
      const newCycles = (mold.cycles_used || 0) + cyclesAdd;
      const moldUpdate = { cycles_used: newCycles };
      if (mold.max_cycles && newCycles >= mold.max_cycles) {
        moldUpdate.status = 'Em Manutenção';
      }
      await base44.entities.Mold.update(mold.id, moldUpdate);
    }

    if (order?.id) {
      await base44.entities.ProductionOrder.update(order.id, payload);
      // Atualiza ciclos do molde ao CONCLUIR (transição para Concluída)
      const wasConcluded = order.status === 'Concluída';
      const isNowConcluded = payload.status === 'Concluída';
      if (!wasConcluded && isNowConcluded) {
        await updateMoldCycles(payload.machine_cycles_actual);
      }
    } else {
      await base44.entities.ProductionOrder.create(withCompany(payload));
      // Se criada já como Concluída, conta ciclos
      if (payload.status === 'Concluída') {
        await updateMoldCycles(payload.machine_cycles_actual);
      }
    }
    setSaving(false);
    onSaved();
    onClose();
  }

  const isFinishing = form.status === 'Concluída';

  const plannedItems = INSUMO_KEYS.map(key => {
    const { pt_field, unit } = INSUMO_FIELDS[key];
    const val = selectedType && qty && selectedType[pt_field]
      ? (qty * selectedType[pt_field]).toFixed(4) : null;
    return { key, label: names[key], val, unit };
  }).filter(i => i.val);

  const tracesQty = parseFloat(form.actual_traces_produced) || 0;
  const linkedTrace = concreteTraces.find(t => t.id === selectedType?.concrete_trace_id);

  // Lista de matérias-primas do traço (cimento + composição) + água, para lançamento manual
  const traceMaterials = [];
  if (linkedTrace) {
    const cementKg = linkedTrace.cement_kg_per_m3 || 0;
    const cementParts = linkedTrace.cement_parts || 1;
    traceMaterials.push({
      key: 'cement', label: names.cement, unit: INSUMO_FIELDS.cement.unit, field: 'actual_cement',
      theo: tracesQty && cementKg ? +(tracesQty * cementKg).toFixed(4) : null,
    });
    Object.keys(linkedTrace.materials_composition || {}).forEach(key => {
      if (key === 'cement') return;
      const f = INSUMO_FIELDS[key];
      if (!f) return;
      const partField = INSUMO_TRACE_PARTS[key];
      const partVal = partField ? linkedTrace[partField] : null;
      const theo = partVal && tracesQty && cementKg ? +(tracesQty * cementKg * (partVal / cementParts)).toFixed(4) : null;
      traceMaterials.push({ key, label: names[key] || key, unit: f.unit, field: f.actual, theo });
    });
  }
  traceMaterials.push({ key: 'water', label: names.water || 'Água', unit: INSUMO_FIELDS.water.unit, field: 'actual_water', theo: null });

  const linkedMold = selectedType ? findMoldForProduct(selectedType.id) : null;

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
        <div className="bg-card w-full max-w-2xl rounded-2xl shadow-2xl border border-border overflow-y-auto max-h-[90vh]">
          <div className="flex items-center justify-between px-6 py-4 border-b border-border">
            <h2 className="font-semibold text-foreground">{order ? 'Editar Ordem' : 'Nova Ordem de Produção'}</h2>
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors"><X className="w-5 h-5" /></button>
          </div>
          <form onSubmit={handleSubmit} className="p-6 space-y-5">

            {/* Nº e Data */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  Nº da Ordem {generatingNumber && <span className="italic text-muted-foreground/60">(gerando...)</span>}
                </label>
                <input
                  className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-muted text-foreground font-mono cursor-not-allowed focus:outline-none"
                  value={form.order_number}
                  readOnly
                  placeholder="Gerando..."
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Data</label>
                <input type="date" className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                  value={form.production_date} onChange={e => set('production_date', e.target.value)} required />
              </div>
            </div>

            {/* Artefato */}
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Tipo de Artefato</label>
              <select className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                value={form.product_type_id} onChange={e => handleTypeChange(e.target.value)} required>
                <option value="">Selecione...</option>
                {productTypes.filter(p => p.active !== false).map(p => (
                  <option key={p.id} value={p.id}>{p.name} ({p.code})</option>
                ))}
              </select>
              {linkedMold && (
                <p className="text-xs text-muted-foreground mt-1.5 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary inline-block shrink-0" />
                  Molde: <strong className="text-foreground">{linkedMold.name}</strong>
                  — {linkedMold.cycles_used || 0}{linkedMold.max_cycles ? `/${linkedMold.max_cycles}` : ''} ciclos utilizados
                </p>
              )}
            </div>

            {/* Operador + Turno */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Operador</label>
                <select className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                  value={form.operator_id || ''} onChange={e => {
                    const op = operators.find(o => o.id === e.target.value);
                    setForm(f => ({ ...f, operator_id: e.target.value, operator_name: op ? op.name : '' }));
                  }}>
                  <option value="">Selecione...</option>
                  {operators.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Turno</label>
                <select className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                  value={form.shift || ''} onChange={e => set('shift', e.target.value)}>
                  <option value="">Selecione...</option>
                  <option value="Turno 1">Turno 1</option>
                  <option value="Turno 2">Turno 2</option>
                  <option value="Turno 3">Turno 3</option>
                  <option value="Adm">Adm</option>
                </select>
              </div>
            </div>

            {/* Máquina + botão parada */}
            <div className="flex gap-3 items-end">
              <div className="flex-1">
                <label className="block text-xs font-medium text-muted-foreground mb-1">Máquina</label>
                <select className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                  value={form.machine_id || ''} onChange={e => handleMachineChange(e.target.value)}>
                  <option value="">Selecione a máquina...</option>
                  {machines.map(m => <option key={m.id} value={m.id}>{m.name} ({m.code})</option>)}
                </select>
              </div>
              {form.machine_id && (
                <button type="button" onClick={() => setShowDowntime(true)}
                  className="flex items-center gap-1.5 px-3 py-2 border border-amber-300 bg-amber-50 text-amber-700 rounded-lg text-xs font-medium hover:bg-amber-100 transition-colors whitespace-nowrap">
                  <AlertTriangle className="w-3.5 h-3.5" /> Registrar Parada
                </button>
              )}
            </div>



            {/* Tempo de produção */}
            <div className="bg-muted/40 rounded-xl p-4">
              <p className="text-xs font-semibold text-muted-foreground mb-3">Tempo em Produção</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Início</label>
                  <input type="time" className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                    value={form.start_time || ''} onChange={e => handleTimeChange('start_time', e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Fim</label>
                  <input type="time" className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                    value={form.end_time || ''} onChange={e => handleTimeChange('end_time', e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Almoço (min)</label>
                  <input type="number" min="0" max="120"
                    className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                    value={form.lunch_minutes || ''} onChange={e => handleLunchChange(e.target.value)}
                    placeholder="ex: 60" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Duração (min)</label>
                  <input type="number" min="0"
                    className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                    value={form.production_minutes || ''} onChange={e => set('production_minutes', e.target.value)}
                    placeholder="calc. auto." />
                </div>
              </div>
            </div>

            {/* Ciclos + Quantidade Planejados */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Ciclos Planejados</label>
                <input type="number" min="0"
                  className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                  value={form.machine_cycles_planned ?? ''}
                  onChange={e => {
                    const val = e.target.value;
                    const qtyVal = calcQuantity(val, unitsPerCycle);
                    setForm(f => ({ ...f, machine_cycles_planned: val ? parseFloat(val) : null, planned_quantity: qtyVal }));
                  }}
                  placeholder="—" required />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  Quantidade Planejada <span className="text-muted-foreground/60 font-normal">(auto)</span>
                </label>
                <input type="number" min="0"
                  className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-muted text-foreground font-mono focus:outline-none focus:ring-2 focus:ring-ring"
                  value={form.planned_quantity ?? ''}
                  readOnly
                  placeholder="—" />
              </div>
            </div>

            {/* Insumos planejados */}
            {plannedItems.length > 0 && (
              <div className="bg-muted/50 rounded-xl p-4">
                <p className="text-xs font-semibold text-muted-foreground mb-2">Insumos Planejados (calculado)</p>
                <div className="grid grid-cols-4 gap-2">
                  {plannedItems.map(({ key, label, val, unit }) => (
                    <div key={key} className="bg-card rounded-lg p-2.5 border border-border text-center">
                      <p className="text-xs text-muted-foreground leading-tight">{label}</p>
                      <p className="font-semibold text-foreground text-sm mt-0.5">{val} <span className="text-xs font-normal">{unit}</span></p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Status */}
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Status</label>
              <select className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                value={form.status} onChange={e => set('status', e.target.value)}>
                <option value="Em Andamento">Em Andamento</option>
                <option value="Concluída">Concluída</option>
                <option value="Cancelada">Cancelada</option>
              </select>
            </div>

            {/* Dados reais */}
            {isFinishing && (
              <div className="border border-primary/30 bg-primary/5 rounded-xl p-4 space-y-4">
                <p className="text-xs font-semibold text-primary">Dados Reais (para conclusão)</p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">Ciclos Reais</label>
                    <input type="number" min="0" className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                      value={form.machine_cycles_actual ?? ''}
                      onChange={e => {
                        const val = e.target.value;
                        const qtyVal = calcQuantity(val, unitsPerCycle);
                        setForm(f => ({ ...f, machine_cycles_actual: val ? parseFloat(val) : null, actual_quantity: qtyVal }));
                      }}
                      placeholder="—" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">
                      Quantidade Real Produzida <span className="text-muted-foreground/60 font-normal">(auto)</span>
                    </label>
                    <input type="number" min="0"
                      className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-muted text-foreground font-mono focus:outline-none focus:ring-2 focus:ring-ring"
                      value={form.actual_quantity ?? ''}
                      readOnly
                      placeholder="—" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Traços Produzidos</label>
                  <input type="number" min="0"
                    className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                    value={form.actual_traces_produced ?? ''}
                    onChange={e => set('actual_traces_produced', e.target.value ? parseFloat(e.target.value) : null)}
                    placeholder="Nº de traços produzidos" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Umidade Agregados (%)</label>
                  <input type="number" min="0" step="0.1"
                    className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                    value={form.raw_material_moisture ?? ''}
                    onChange={e => set('raw_material_moisture', e.target.value === '' ? null : parseFloat(e.target.value))}
                    placeholder="Ex: 5.2" />
                </div>
                {traceMaterials.length > 0 && (
                  <div className="bg-card rounded-xl p-3 border border-border">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-semibold text-muted-foreground">Matérias-Primas Reais (lançamento manual)</p>
                      <p className="text-xs text-muted-foreground/60">teórico do traço entre parênteses</p>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {traceMaterials.map(({ key, label, unit, field, theo }) => (
                        <div key={key} className="bg-muted/40 rounded-lg p-2 border border-border">
                          <label className="block text-xs text-muted-foreground leading-tight">{label} ({unit})</label>
                          <input type="number" min="0" step="0.0001"
                            className="w-full border border-input rounded-lg px-2 py-1.5 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-ring mt-1"
                            value={form[field] ?? ''}
                            onChange={e => set(field, e.target.value === '' ? null : e.target.value)}
                            placeholder={theo != null ? `teor. ${theo}` : '—'} />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Perdas de produção */}
                <div className="bg-card rounded-xl p-3 border border-border">
                  <p className="text-xs font-semibold text-muted-foreground mb-2">Perdas de Produção (peças)</p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {LOSS_FIELDS.map(({ key, label }) => (
                      <div key={key} className="bg-muted/40 rounded-lg p-2 border border-border">
                        <label className="block text-xs text-muted-foreground leading-tight">{label}</label>
                        <input type="number" min="0" step="1"
                          className="w-full border border-input rounded-lg px-2 py-1.5 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-ring mt-1"
                          value={form[key] ?? 0}
                          onChange={e => set(key, e.target.value === '' ? 0 : parseInt(e.target.value, 10) || 0)} />
                      </div>
                    ))}
                  </div>
                  <div className="mt-2">
                    <label className="block text-xs text-muted-foreground mb-1">Motivo Principal das Perdas</label>
                    <select className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                      value={form.loss_reason || ''} onChange={e => set('loss_reason', e.target.value)}>
                      <option value="">Nenhum / Não se aplica</option>
                      <option value="Erro de Ajuste">Erro de Ajuste</option>
                      <option value="Falha da Máquina">Falha da Máquina</option>
                      <option value="Falha de Matéria-Prima">Falha de Matéria-Prima</option>
                      <option value="Erro do Operador">Erro do Operador</option>
                      <option value="Molde Desgastado">Molde Desgastado</option>
                      <option value="Outros">Outros</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* Observações */}
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Observações</label>
              <textarea className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                rows={2} value={form.notes} onChange={e => set('notes', e.target.value)} />
            </div>

            {saveError && (
              <p className="text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded-lg px-3 py-2">{saveError}</p>
            )}

            <div className="flex gap-3 pt-1">
              <button type="button" onClick={onClose} className="flex-1 border border-border rounded-lg py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted transition-colors">Cancelar</button>
              <button type="submit" disabled={saving} className="flex-1 bg-primary text-primary-foreground rounded-lg py-2.5 text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-60">
                {saving ? 'Salvando...' : order ? 'Salvar Alterações' : 'Criar Ordem'}
              </button>
            </div>
          </form>
        </div>
      </div>

      {showDowntime && (
        <MachineDowntimeForm
          prefillMachineId={form.machine_id}
          prefillMachineNme={form.machine_name}
          prefillDate={form.production_date}
          prefillOrderId={order?.id}
          prefillOrderNumber={form.order_number}
          onClose={() => setShowDowntime(false)}
          onSaved={() => setShowDowntime(false)}
        />
      )}
    </>
  );
}