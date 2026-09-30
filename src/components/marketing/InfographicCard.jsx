import React from 'react';
import { Sparkles, RefreshCw, Download, Loader2, ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';

const GROUP_BADGE = {
  'Produção': 'bg-blue-50 text-blue-700 border-blue-200',
  'Qualidade e IA': 'bg-violet-50 text-violet-700 border-violet-200',
  'Gestão financeira': 'bg-emerald-50 text-emerald-700 border-emerald-200',
};

export default function InfographicCard({ tab, item, busy, onGenerate, onDownload }) {
  const ready = !!(item && item.image_url);
  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden flex flex-col">
      <div className="relative aspect-[4/5] bg-muted">
        {ready ? (
          <img src={item.image_url} alt={`Infográfico ${tab.title}`} className="w-full h-full object-cover" />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-muted-foreground">
            {busy ? (
              <Loader2 className="w-6 h-6 animate-spin" />
            ) : (
              <ImageIcon className="w-6 h-6" />
            )}
            <span className="text-xs">{busy ? 'Capturando tela...' : 'Ainda não gerado'}</span>
          </div>
        )}
        {busy && ready && (
          <div className="absolute inset-0 bg-background/70 flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        )}
      </div>
      <div className="p-3 space-y-2.5 flex-1 flex flex-col">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-sm font-semibold text-foreground leading-tight">{tab.title}</h3>
          <span className={`shrink-0 text-[10px] px-2 py-0.5 rounded-full border ${GROUP_BADGE[tab.group] || 'bg-muted text-muted-foreground border-border'}`}>
            {tab.group}
          </span>
        </div>
        <div className="mt-auto flex gap-2">
          <Button
            variant={ready ? 'outline' : 'default'}
            size="sm"
            className="flex-1"
            disabled={busy}
            onClick={() => onGenerate(tab.key)}
          >
            {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : ready ? <RefreshCw className="w-3.5 h-3.5" /> : <Sparkles className="w-3.5 h-3.5" />}
            {ready ? 'Regerar' : 'Gerar'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            disabled={!ready}
            onClick={() => onDownload(item)}
          >
            <Download className="w-3.5 h-3.5" /> Baixar
          </Button>
        </div>
      </div>
    </div>
  );
}