import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { X, CheckSquare, Square } from 'lucide-react';
import { useBackButtonClose } from '@/hooks/useBackButtonClose';

const empty = {
  name: '', code: '', supplier_code: '',
  product_type_ids: [], product_type_names: [],
  units_per_cycle: '', max_cycles: '', cycles_used: 0,
  cost: '', status: 'Ativo', acquisition_date: '', last_maintenance_date: '', notes: '',
};

export default function MoldForm({ item, onClose, onSaved }) {
  const [form, setForm] = useState(item ? { 
    ...item,
    product_type_ids: item.product_type_ids || [],
    product_type_names: item.product_type_names || [],
  } : { ...empty });
  const [saving, setSaving] = useState(false);
  const [productTypes, setProductTypes] = useState([]);
  const [generatingCode, setGeneratingCode] = useState(false);
  useBackButtonClose(onClose);

  useEffect(() => {
    base44.entities.ProductType.filter({ active: true }, 'name').then(setProductTypes);
    if (!item) generateCode();
  }, []);

  async function generateCode() {
    setGeneratingCode(true);
    const year = new Date().getFullYear();
    const yearShort = String(year).slice(-2);
    const existing = await base44.entities.Mold.filter({ code_year: year }, 'code_sequence', 500);
    const maxSeq = existing.length > 0 ? Math.max(...existing.map(m => m.code_sequence || 0)) : 0;
    const nextSeq = maxSeq + 1;
    setForm(f => ({
      ...f,
      code: `BL${String(nextSeq).padStart(4, '0')}/${yearShort}`,
      code_sequence: nextSeq,
      code_year: year,
    }));
    setGeneratingCode(false);
  }

  function set(field, val) { setForm(f => ({ ...f, [field]: val })); }

  function toggleProductType(pt) {
    const ids = form.product_type_ids || [];
    const names = form.product_type_names || [];
    if (ids.includes(pt.id)) {
      setForm(f => ({
        ...f,
        product_type_ids: ids.filter(id => id !== pt.id),
        product_type_names: names.filter(n => n !== pt.name),
      }));
    } else {
      setForm(f => ({
        ...f,
        product_type_ids: [...ids, pt.id],
        product_type_names: [...names, pt.name],
      }));
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    const payload = {
      ...form,
      units_per_cycle: parseFloat(form.units_per_cycle) || null,
      max_cycles: parseFloat(form.max_cycles) || null,
      cycles_used: parseFloat(form.cycles_used) || 0,
      cost: parseFloat(form.cost) || 0,
    };
    if (item?.id) {
      await base44.entities.Mold.update(item.id, payload);
    } else {
      await base44.entities.Mold.create(payload);
    }
    setSaving(false);
    onSaved();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-card w-full max-w-lg rounded-2xl shadow-2xl border border-border overflow-y-auto max-h-[90vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="font-semibold text-foreground">{item ? 'Editar Molde' : 'Novo Molde'}</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Nome</label>
            <input className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
              value={form.name} onChange={e => set('name', e.target.value)} placeholder="Molde Bloco 14 - A" required />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                Código Interno {generatingCode && <span className="italic text-muted-foreground/60">(gerando...)</span>}
              </label>
              <input
                className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-muted text-foreground font-mono cursor-not-allowed focus:outline-none"
                value={form.code} readOnly placeholder="Gerando..." />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Código do Fornecedor</label>
              <input className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                value={form.supplier_code || ''} onChange={e => set('supplier_code', e.target.value)} placeholder="ex: FORN-4521" />
            </div>
          </div>

          {/* Multi-select de artefatos */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">
              Artefatos Vinculados
              {form.product_type_ids?.length > 0 && (
                <span className="ml-1.5 bg-primary/10 text-primary text-xs px-1.5 py-0.5 rounded-full font-semibold">
                  {form.product_type_ids.length} selecionado(s)
                </span>
              )}
            </label>
            <div className="border border-input rounded-lg divide-y divide-border max-h-40 overflow-y-auto">
              {productTypes.length === 0 ? (
                <p className="px-3 py-2.5 text-xs text-muted-foreground">Nenhum artefato ativo cadastrado.</p>
              ) : productTypes.map(pt => {
                const checked = (form.product_type_ids || []).includes(pt.id);
                return (
                  <button key={pt.id} type="button"
                    onClick={() => toggleProductType(pt)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 text-left text-sm transition-colors hover:bg-muted/50 ${checked ? 'bg-primary/5' : ''}`}>
                    {checked
                      ? <CheckSquare className="w-4 h-4 text-primary shrink-0" />
                      : <Square className="w-4 h-4 text-muted-foreground shrink-0" />}
                    <span className={checked ? 'font-medium text-foreground' : 'text-muted-foreground'}>
                      {pt.name}
                    </span>
                    <span className="ml-auto text-xs text-muted-foreground font-mono">{pt.code}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Peças por Ciclo</label>
              <input type="number" min="1" step="1"
                className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                value={form.units_per_cycle} onChange={e => set('units_per_cycle', e.target.value)} placeholder="ex: 4" />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Vida Útil (ciclos)</label>
              <input type="number" min="1" step="1"
                className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                value={form.max_cycles} onChange={e => set('max_cycles', e.target.value)} placeholder="ex: 5000" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Ciclos Utilizados</label>
              <input type="number" min="0" step="1"
                className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                value={form.cycles_used} onChange={e => set('cycles_used', e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Status</label>
              <select className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                value={form.status} onChange={e => set('status', e.target.value)}>
                <option value="Ativo">Ativo</option>
                <option value="Em Manutenção">Em Manutenção</option>
                <option value="Descartado">Descartado</option>
              </select>
            </div>
          </div>

          {/* Custo do molde */}
          <div className="bg-muted/40 rounded-xl p-4 space-y-3">
            <p className="text-xs font-semibold text-muted-foreground">Custo do Molde</p>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Custo de Aquisição (R$)</label>
              <input type="number" min="0" step="0.01"
                className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                value={form.cost ?? ''} onChange={e => set('cost', e.target.value)} placeholder="ex: 4500.00" />
            </div>
            {(() => {
              const cost = parseFloat(form.cost) || 0;
              const maxCycles = parseFloat(form.max_cycles) || 0;
              const upc = parseFloat(form.units_per_cycle) || 0;
              if (cost > 0 && maxCycles > 0) {
                const perCycle = cost / maxCycles;
                const perPiece = upc > 0 ? perCycle / upc : null;
                return (
                  <div className="bg-primary/5 rounded-lg px-3 py-2.5 grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-xs text-muted-foreground">Custo por ciclo</p>
                      <p className="text-sm font-bold text-primary">
                        {perCycle.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Custo por peça</p>
                      <p className="text-sm font-bold text-primary">
                        {perPiece != null
                          ? perPiece.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 4 })
                          : '—'}
                      </p>
                    </div>
                  </div>
                );
              }
              return null;
            })()}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Data de Aquisição</label>
              <input type="date"
                className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                value={form.acquisition_date} onChange={e => set('acquisition_date', e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Última Manutenção</label>
              <input type="date"
                className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                value={form.last_maintenance_date} onChange={e => set('last_maintenance_date', e.target.value)} />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Observações</label>
            <textarea className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring resize-none"
              rows={2} value={form.notes} onChange={e => set('notes', e.target.value)} />
          </div>

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 border border-border rounded-lg py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted transition-colors">
              Cancelar
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 bg-primary text-primary-foreground rounded-lg py-2.5 text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-60">
              {saving ? 'Salvando...' : item ? 'Salvar' : 'Criar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}