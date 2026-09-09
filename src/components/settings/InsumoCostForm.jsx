import { useState, useEffect } from 'react';
import { useInsumoCosts } from '@/hooks/useInsumoCosts';
import { useInsumoNames } from '@/hooks/useInsumoNames';
import { INSUMO_KEYS, INSUMO_FIELDS } from '@/lib/insumos';
import { CheckCircle2 } from 'lucide-react';

export default function InsumoCostForm() {
  const { costs, loading, saveCosts } = useInsumoCosts();
  const { names } = useInsumoNames();
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!loading) setForm({ ...costs });
  }, [loading]);

  async function handleSave() {
    setSaving(true);
    const parsed = Object.fromEntries(
      Object.entries(form).map(([k, v]) => [k, parseFloat(v) || 0])
    );
    await saveCosts(parsed);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  if (loading) return (
    <div className="flex items-center justify-center h-32">
      <div className="w-6 h-6 border-4 border-muted border-t-primary rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="p-5 space-y-5">
      <div>
        <h3 className="text-sm font-semibold text-foreground">Custo de Matéria-Prima por Insumo</h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          Informe o custo por unidade de cada insumo (R$/kg ou R$/L). Usado para calcular o custo unitário dos artefatos.
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {INSUMO_KEYS.map(key => {
          const { unit } = INSUMO_FIELDS[key];
          return (
            <div key={key}>
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                {names[key]} <span className="text-muted-foreground/60">(R$/{unit})</span>
              </label>
              <input
                type="number" min="0" step="0.01"
                className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                value={form[key] ?? ''}
                onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                placeholder="0,00"
              />
            </div>
          );
        })}
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className="bg-primary text-primary-foreground px-5 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-60"
        >
          {saving ? 'Salvando...' : 'Salvar Custos'}
        </button>
        {saved && (
          <span className="flex items-center gap-1.5 text-xs text-green-600 font-medium">
            <CheckCircle2 className="w-4 h-4" /> Salvo com sucesso!
          </span>
        )}
      </div>
    </div>
  );
}