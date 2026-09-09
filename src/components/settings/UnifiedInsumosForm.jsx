import { useState, useEffect } from 'react';
import { useConfig } from '@/lib/ConfigContext';
import { Save, Plus, Trash2, CheckCircle2 } from 'lucide-react';

export default function UnifiedInsumosForm({ canEditCost = true }) {
  const { rawMaterials, insumoCosts, saveRawMaterials, saveCosts } = useConfig();
  const [list, setList] = useState([]);
  const [costs, setCosts] = useState({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setList(rawMaterials?.length ? rawMaterials : []);
    setCosts(insumoCosts ? { ...insumoCosts } : {});
  }, [rawMaterials, insumoCosts]);

  function updateRow(i, field, val) {
    setList(l => l.map((m, idx) => idx === i ? { ...m, [field]: val } : m));
  }

  function updateCost(key, val) {
    setCosts(c => ({ ...c, [key]: val }));
  }

  function addRow() {
    setList(l => [...l, { key: `mat_${Date.now()}`, name: '', unit: 'kg' }]);
  }

  function removeRow(i) {
    setList(l => l.filter((_, idx) => idx !== i));
  }

  async function handleSave() {
    setSaving(true);
    const cleaned = list
      .map(m => ({ ...m, name: m.name?.trim() || 'Sem nome', unit: m.unit?.trim() || 'kg' }));
    const parsedCosts = Object.fromEntries(
      Object.entries(costs).map(([k, v]) => [k, parseFloat(v) || 0])
    );
    await saveRawMaterials(cleaned);
    await saveCosts(parsedCosts);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Insumos e Custos</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Cadastre as matérias-primas, unidades e custos (R$) por unidade. Usado no cálculo do custo unitário dos artefatos.
          </p>
        </div>
        <button onClick={addRow}
          className="flex items-center gap-2 bg-primary text-primary-foreground px-3 py-2 rounded-lg text-xs font-medium hover:bg-primary/90 transition-colors">
          <Plus className="w-4 h-4" /> Adicionar
        </button>
      </div>

      <div className="space-y-2">
        <div className="grid grid-cols-[1fr_6rem_8rem_2.5rem] gap-3 px-1 text-xs font-medium text-muted-foreground">
          <span>Nome</span>
          <span>Unidade</span>
          <span>Custo (R$)</span>
          <span />
        </div>
        {list.map((m, i) => (
          <div key={m.key} className="grid grid-cols-[1fr_6rem_8rem_2.5rem] gap-3 items-center">
            <input
              className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
              value={m.name}
              onChange={e => updateRow(i, 'name', e.target.value)}
              placeholder="ex: Cimento"
            />
            <input
              className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
              value={m.unit}
              onChange={e => updateRow(i, 'unit', e.target.value)}
              placeholder="kg"
            />
            <input
              type="number" min="0" step="0.01"
              disabled={!canEditCost}
              className={`w-full border border-input rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring ${canEditCost ? 'bg-background' : 'bg-muted text-muted-foreground cursor-not-allowed'}`}
              value={costs[m.key] ?? ''}
              onChange={e => updateCost(m.key, e.target.value)}
              placeholder={canEditCost ? '0,00' : 'Admin'}
            />
            <button onClick={() => removeRow(i)}
              className="p-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors justify-self-center">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
        {list.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-8">Nenhuma matéria-prima cadastrada.</p>
        )}
      </div>

      <div className="flex items-center gap-3 justify-end">
        {saved && (
          <span className="flex items-center gap-1.5 text-xs text-green-600 font-medium">
            <CheckCircle2 className="w-4 h-4" /> Salvo com sucesso!
          </span>
        )}
        <button onClick={handleSave} disabled={saving}
          className="flex items-center gap-2 bg-primary text-primary-foreground px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-60">
          <Save className="w-4 h-4" />
          {saving ? 'Salvando...' : 'Salvar'}
        </button>
      </div>
    </div>
  );
}