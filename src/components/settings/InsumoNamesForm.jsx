import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { DEFAULT_INSUMO_NAMES, INSUMO_KEYS } from '@/lib/insumos';
import { useConfig } from '@/lib/ConfigContext';
import { Save } from 'lucide-react';

const LABELS = {
  cement: '1. Cimento',
  sand_artificial: '2. Areia Artificial',
  sand_medium: '3. Areia Média',
  sand_fine: '4. Areia Fina',
  gravel: '5. Brita',
  additive: '6. Aditivo',
  pigment: '7. Pigmento',
  water: '8. Água',
};

export default function InsumoNamesForm() {
  const { insumoNames, saveNames } = useConfig();
  const [names, setNames] = useState(DEFAULT_INSUMO_NAMES);
  const [settingId, setSettingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    base44.entities.AppSettings.filter({ key: 'insumo_names' }).then(rows => {
      if (rows.length > 0 && rows[0].value) {
        setNames({ ...DEFAULT_INSUMO_NAMES, ...rows[0].value });
        setSettingId(rows[0].id);
      } else {
        setNames({ ...insumoNames });
      }
    });
  }, []);

  async function handleSave() {
    setSaving(true);
    await saveNames(names, settingId);
    if (!settingId) {
      const rows = await base44.entities.AppSettings.filter({ key: 'insumo_names' });
      if (rows.length > 0) setSettingId(rows[0].id);
    }
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="p-6 space-y-5">
      <div>
        <h2 className="text-sm font-semibold text-foreground">Nomes dos Insumos</h2>
        <p className="text-xs text-muted-foreground mt-0.5">Personalize os nomes exibidos em toda a aplicação.</p>
      </div>
      <div className="grid grid-cols-2 gap-4">
        {INSUMO_KEYS.map(key => (
          <div key={key}>
            <label className="block text-xs font-medium text-muted-foreground mb-1">{LABELS[key]}</label>
            <input
              className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
              value={names[key]}
              onChange={e => setNames(n => ({ ...n, [key]: e.target.value }))}
            />
          </div>
        ))}
      </div>
      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 bg-primary text-primary-foreground px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-60"
        >
          <Save className="w-4 h-4" />
          {saved ? 'Salvo!' : saving ? 'Salvando...' : 'Salvar Nomes'}
        </button>
      </div>
    </div>
  );
}