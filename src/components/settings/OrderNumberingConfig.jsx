import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { activeCompanyId } from '@/lib/companyScope';
import { Save, Hash, Info } from 'lucide-react';

const DEFAULT_CONFIG = { prefix: 'OS', digits: 6, initial_number: 1, reset_annually: true };

export default function OrderNumberingConfig() {
  const [config, setConfig] = useState(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState('');
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const res = await base44.functions.invoke('orderNumbering', {
        action: 'get_config',
        company_id: activeCompanyId(),
      });
      const cfg = res.data?.config || DEFAULT_CONFIG;
      setConfig(cfg);
      await refreshPreview(cfg);
    } catch (e) {
      setError('Não foi possível carregar a configuração.');
    }
    setLoading(false);
  }

  async function refreshPreview(cfg) {
    try {
      const res = await base44.functions.invoke('orderNumbering', {
        action: 'preview',
        company_id: activeCompanyId(),
      });
      setPreview(res.data?.order_number || '');
    } catch (e) {
      setPreview('');
    }
  }

  function update(field, value) {
    setConfig((prev) => {
      const next = { ...prev, [field]: value };
      refreshPreview(next);
      return next;
    });
    setSaved(false);
  }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const res = await base44.functions.invoke('orderNumbering', {
        action: 'save_config',
        company_id: activeCompanyId(),
        prefix: config.prefix,
        digits: config.digits,
        initial_number: config.initial_number,
        reset_annually: config.reset_annually,
      });
      if (res.data?.config) setConfig(res.data.config);
      if (res.data?.preview) setPreview(res.data.preview);
      setSaved(true);
    } catch (e) {
      setError(e?.response?.data?.error || e?.message || 'Erro ao salvar configuração.');
    }
    setSaving(false);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="w-7 h-7 border-4 border-muted border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="bg-card rounded-xl border border-border shadow-sm p-6 max-w-2xl">
      <div className="flex items-center gap-2 mb-1">
        <Hash className="w-5 h-5 text-primary" />
        <h3 className="text-lg font-semibold text-foreground">Numeração das Ordens de Produção</h3>
      </div>
      <p className="text-sm text-muted-foreground mb-5">
        Configure o formato da numeração das novas ordens. As ordens existentes não são alteradas.
      </p>

      <form onSubmit={handleSave} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Prefixo</label>
            <input
              type="text"
              maxLength={10}
              value={config.prefix}
              onChange={(e) => update('prefix', e.target.value.toUpperCase())}
              className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring uppercase font-mono"
              placeholder="OS"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Dígitos</label>
            <input
              type="number"
              min={1}
              max={10}
              value={config.digits}
              onChange={(e) => update('digits', parseInt(e.target.value, 10) || 6)}
              className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Número Inicial</label>
            <input
              type="number"
              min={1}
              value={config.initial_number}
              onChange={(e) => update('initial_number', parseInt(e.target.value, 10) || 1)}
              className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
              required
            />
          </div>
          <div className="flex items-center gap-3 pt-5">
            <button
              type="button"
              onClick={() => update('reset_annually', !config.reset_annually)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${config.reset_annually ? 'bg-primary' : 'bg-muted-foreground/30'}`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${config.reset_annually ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
            <span className="text-sm text-foreground">Reiniciar por ano</span>
          </div>
        </div>

        <div className="bg-muted/50 rounded-lg p-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground mb-0.5">Próxima Ordem</p>
            <p className="text-xl font-bold font-mono text-foreground">{preview || '—'}</p>
          </div>
          <span className="text-xs text-muted-foreground">prévia sem reserva</span>
        </div>

        <div className="flex items-start gap-2 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
          <Info className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
          <p className="text-xs text-blue-700 dark:text-blue-300">
            Ordens existentes mantêm sua numeração atual. A nova numeração se aplica apenas às
            próximas ordens criadas. Números não são reutilizados, mesmo em caso de cancelamento ou exclusão.
          </p>
        </div>

        {error && (
          <p className="text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded-lg px-3 py-2">{error}</p>
        )}

        <div className="flex items-center gap-3 pt-1">
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 bg-primary text-primary-foreground px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-60"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Salvando...' : 'Salvar configuração'}
          </button>
          {saved && <span className="text-sm text-green-600 font-medium">Configuração salva.</span>}
        </div>
      </form>
    </div>
  );
}