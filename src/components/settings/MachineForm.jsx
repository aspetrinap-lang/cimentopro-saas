import { useState, useEffect } from 'react';
import { scopedFilter, withCompany } from '@/lib/companyScope';
import { base44 } from '@/api/base44Client';
import { X, Plus, Trash2, Factory, ArrowRightLeft } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { intervalsFromItems, itemsFromIntervals } from '@/lib/machineIntervals';

const MACHINE_TYPES = [
  {
    value: 'Produção',
    label: 'Produção',
    icon: Factory,
    hint: 'Máquina principal — entra nos cálculos de ciclos e produção',
  },
  {
    value: 'Movimentação',
    label: 'Movimentação',
    icon: ArrowRightLeft,
    hint: 'Máquina secundária — movimenta peças, excluída dos cálculos de produção',
  },
];

function generateMachineCode(existingCodes) {
  const year = new Date().getFullYear().toString().slice(-2);
  const yearCodes = existingCodes
    .map(c => {
      const match = (c || '').match(/MQ(\d+)\/(\d+)/i);
      return match && match[2] === year ? parseInt(match[1]) : 0;
    })
    .filter(n => !isNaN(n));
  const nextSeq = (yearCodes.length > 0 ? Math.max(...yearCodes) : 0) + 1;
  return `MQ${String(nextSeq).padStart(4, '0')}/${year}`;
}

export default function MachineForm({ item, onClose, onSaved }) {
  const [form, setForm] = useState(() => ({
    name: item?.name || '',
    code: item?.code || '',
    type: item?.type || '',
    machine_type: item?.machine_type || 'Produção',
    intervalItems: itemsFromIntervals(item?.maintenance_intervals),
    active: item?.active !== false,
  }));
  const [saving, setSaving] = useState(false);

  function set(field, val) { setForm(f => ({ ...f, [field]: val })); }

  function updateItem(idx, patch) {
    setForm(f => ({
      ...f,
      intervalItems: f.intervalItems.map((it, i) => (i === idx ? { ...it, ...patch } : it)),
    }));
  }

  function addItem() {
    setForm(f => ({
      ...f,
      intervalItems: [...f.intervalItems, { name: '', days: 30, enabled: true, custom: true }],
    }));
  }

  function removeItem(idx) {
    setForm(f => ({ ...f, intervalItems: f.intervalItems.filter((_, i) => i !== idx) }));
  }

  useEffect(() => {
    if (!item) {
      base44.entities.Machine.filter(scopedFilter({}), 'name', 500).then(machines => {
        const code = generateMachineCode(machines.map(m => m.code));
        setForm(f => ({ ...f, code }));
      });
    }
  }, [item]);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    const payload = {
      name: form.name,
      code: form.code,
      type: form.type,
      machine_type: form.machine_type,
      maintenance_intervals: intervalsFromItems(form.intervalItems),
      active: form.active,
    };
    if (item?.id) {
      await base44.entities.Machine.update(item.id, payload);
    } else {
      await base44.entities.Machine.create(withCompany(payload));
    }
    setSaving(false);
    onSaved();
    onClose();
  }

  const inputCls = 'w-full border border-input rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-card w-full max-w-md rounded-2xl shadow-2xl border border-border max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border sticky top-0 bg-card">
          <h2 className="font-semibold text-foreground">{item ? 'Editar Máquina' : 'Nova Máquina'}</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Nome</label>
              <input className={inputCls} value={form.name} onChange={e => set('name', e.target.value)} placeholder="Vibro-prensa 1" required />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Código {item ? '' : '(automático)'}</label>
              <input className={`${inputCls} font-mono bg-muted/50`} value={form.code} onChange={e => set('code', e.target.value)} placeholder="MQ0001/26" required readOnly={!item} />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Tipo de Equipamento</label>
            <input className={inputCls} value={form.type} onChange={e => set('type', e.target.value)} placeholder="Vibro-prensa, Betoneira..." />
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Classificação</label>
            <div className="grid grid-cols-2 gap-2">
              {MACHINE_TYPES.map(t => (
                <button
                  type="button"
                  key={t.value}
                  onClick={() => set('machine_type', t.value)}
                  className={`flex flex-col items-start gap-1 rounded-lg border p-3 text-left transition-colors ${
                    form.machine_type === t.value ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/40'
                  }`}
                >
                  <span className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                    <t.icon className="w-4 h-4" /> {t.label}
                  </span>
                  <span className="text-[11px] text-muted-foreground leading-snug">{t.hint}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Intervalos de Manutenção Preventiva (dias)</label>
            <p className="text-xs text-muted-foreground mb-2">Ative apenas os itens que esta máquina usa e adicione itens próprios se necessário.</p>
            <div className="space-y-2">
              {form.intervalItems.map((it, idx) => (
                <div key={idx} className="flex items-center gap-2 rounded-lg border border-border p-2.5">
                  <Switch checked={it.enabled} onCheckedChange={v => updateItem(idx, { enabled: v })} />
                  {it.custom ? (
                    <input
                      className="flex-1 min-w-0 border border-input rounded-lg px-2 py-1.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                      value={it.name}
                      onChange={e => updateItem(idx, { name: e.target.value })}
                      placeholder="Nome do item"
                    />
                  ) : (
                    <span className={`flex-1 text-sm truncate ${it.enabled ? 'text-foreground' : 'text-muted-foreground line-through'}`}>{it.name}</span>
                  )}
                  <input
                    type="number" min="1"
                    className={`w-20 border border-input rounded-lg px-2 py-1.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring ${!it.enabled ? 'opacity-50' : ''}`}
                    value={it.days}
                    onChange={e => updateItem(idx, { days: e.target.value })}
                    disabled={!it.enabled}
                  />
                  <span className="text-xs text-muted-foreground whitespace-nowrap">dias</span>
                  {it.custom && (
                    <button type="button" onClick={() => removeItem(idx)}
                      className="p-1 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors shrink-0">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
              <button type="button" onClick={addItem}
                className="flex items-center gap-1.5 w-full justify-center border border-dashed border-border rounded-lg py-2 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors">
                <Plus className="w-3.5 h-3.5" /> Adicionar item
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input type="checkbox" id="active" checked={form.active !== false} onChange={e => set('active', e.target.checked)} className="rounded" />
            <label htmlFor="active" className="text-sm text-foreground">Ativo</label>
          </div>
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 border border-border rounded-lg py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted transition-colors">Cancelar</button>
            <button type="submit" disabled={saving} className="flex-1 bg-primary text-primary-foreground rounded-lg py-2.5 text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-60">
              {saving ? 'Salvando...' : item ? 'Salvar' : 'Criar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}