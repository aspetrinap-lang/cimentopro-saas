import { useState, useEffect } from 'react';
import { useConfig } from '@/lib/ConfigContext';
import { DEFAULT_RAW_MATERIALS } from '@/lib/insumos';
import { Save, Plus, Trash2 } from 'lucide-react';

export default function RawMaterialsForm() {
  const { rawMaterials, saveRawMaterials } = useConfig();
  const [list, setList] = useState(DEFAULT_RAW_MATERIALS);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (rawMaterials?.length) setList(rawMaterials);
  }, [rawMaterials]);

  function updateRow(i, field, val) {
    setList(l => l.map((m, idx) => idx === i ? { ...m, [field]: val } : m));
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
    await saveRawMaterials(cleaned);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Matéria-Prima</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Cadastre as matérias-primas e suas unidades. Elas estarão disponíveis na configuração dos traços de concreto.
          </p>
        </div>
        <button onClick={addRow}
          className="flex items-center gap-2 bg-primary text-primary-foreground px-3 py-2 rounded-lg text-xs font-medium hover:bg-primary/90 transition-colors">
          <Plus className="w-4 h-4" /> Adicionar
        </button>
      </div>

      <div className="space-y-2">
        <div className="grid grid-cols-[1fr_7rem_2.5rem] gap-3 px-1 text-xs font-medium text-muted-foreground">
          <span>Nome</span>
          <span>Unidade</span>
          <span />
        </div>
        {list.map((m, i) => (
          <div key={m.key} className="grid grid-cols-[1fr_7rem_2.5rem] gap-3 items-center">
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
            <button onClick={() => removeRow(i)}
              className="p-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors justify-self-center">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3 justify-end">
        {saved && <span className="text-xs text-green-600 font-medium">Salvo com sucesso!</span>}
        <button onClick={handleSave} disabled={saving}
          className="flex items-center gap-2 bg-primary text-primary-foreground px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-60">
          <Save className="w-4 h-4" />
          {saving ? 'Salvando...' : 'Salvar'}
        </button>
      </div>
    </div>
  );
}