import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { jsPDF } from 'jspdf';
import { Sparkles, FileDown, Loader2, Megaphone } from 'lucide-react';
import InfographicCard from '@/components/marketing/InfographicCard';

const GROUPS = ['Produção', 'Qualidade e IA', 'Gestão financeira'];

async function fetchAsDataUrl(url) {
  const res = await fetch(url);
  const blob = await res.blob();
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve({ data: reader.result, type: blob.type });
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

async function downloadUrl(url, filename) {
  const res = await fetch(url);
  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = objectUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(objectUrl);
}

const IMG_FORMAT = (type) => (type && type.includes('png') ? 'PNG' : 'JPEG');

export default function Marketing() {
  const { toast } = useToast();
  const [tabs, setTabs] = useState([]);
  const [items, setItems] = useState({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState({});
  const [bulkBusy, setBulkBusy] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);

  const load = async () => {
    try {
      const res = await base44.functions.invoke('marketingInfographics', { action: 'list' });
      setTabs(res.data?.tabs || []);
      const map = {};
      (res.data?.items || []).forEach((i) => { map[i.key] = i; });
      setItems(map);
    } catch (error) {
      toast({ title: 'Erro ao carregar', description: error?.response?.data?.error || error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const generate = async (key) => {
    setBusy((b) => ({ ...b, [key]: true }));
    try {
      const res = await base44.functions.invoke('marketingInfographics', { action: 'generate', key });
      const item = res.data?.item;
      if (item) setItems((prev) => ({ ...prev, [key]: item }));
    } catch (error) {
      toast({
        title: 'Falha na geração',
        description: error?.response?.data?.error || error.message,
        variant: 'destructive',
      });
    } finally {
      setBusy((b) => ({ ...b, [key]: false }));
    }
  };

  const generateAll = async () => {
    setBulkBusy(true);
    try {
      for (const tab of tabs) {
        if (items[tab.key]?.image_url) continue;
        await generate(tab.key);
      }
      toast({ title: 'Geração concluída', description: 'Todos os infográficos pendentes foram gerados.' });
    } finally {
      setBulkBusy(false);
    }
  };

  const downloadImage = async (item) => {
    try {
      await downloadUrl(item.image_url, `cimentopro-${item.key}-instagram.png`);
    } catch (error) {
      toast({ title: 'Erro ao baixar imagem', description: error.message, variant: 'destructive' });
    }
  };

  const downloadPdf = async () => {
    const ready = tabs.filter((t) => items[t.key]?.image_url);
    if (!ready.length) {
      toast({ title: 'Nada para exportar', description: 'Gere pelo menos um infográfico antes de baixar o PDF.' });
      return;
    }
    setPdfBusy(true);
    try {
      const doc = new jsPDF({ orientation: 'portrait', unit: 'px', format: [1080, 1350] });
      for (let i = 0; i < ready.length; i++) {
        const { data, type } = await fetchAsDataUrl(items[ready[i].key].image_url);
        if (i > 0) doc.addPage([1080, 1350], 'portrait');
        doc.addImage(data, IMG_FORMAT(type), 0, 0, 1080, 1350);
      }
      doc.save('cimentopro-infograficos-instagram.pdf');
    } catch (error) {
      toast({ title: 'Erro ao gerar PDF', description: error.message, variant: 'destructive' });
    } finally {
      setPdfBusy(false);
    }
  };

  const pending = tabs.filter((t) => !items[t.key]?.image_url).length;
  const readyCount = tabs.length - pending;

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[50vh]">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-foreground flex items-center gap-2">
            <Megaphone className="w-5 h-5 text-primary" /> Marketing — Infográficos Instagram
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Um infográfico 4:5 por aba do CimentoPro, pronto para a campanha. {readyCount} de {tabs.length} gerados.
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={generateAll} disabled={bulkBusy || pending === 0}>
            {bulkBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {pending > 0 ? `Gerar tudo (${pending})` : 'Tudo gerado'}
          </Button>
          <Button variant="outline" onClick={downloadPdf} disabled={pdfBusy || readyCount === 0}>
            {pdfBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
            Baixar PDF
          </Button>
        </div>
      </div>

      {GROUPS.map((group) => {
        const groupTabs = tabs.filter((t) => t.group === group);
        if (!groupTabs.length) return null;
        return (
          <section key={group} className="space-y-3">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">{group}</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {groupTabs.map((tab) => (
                <InfographicCard
                  key={tab.key}
                  tab={tab}
                  item={items[tab.key]}
                  busy={!!busy[tab.key]}
                  onGenerate={generate}
                  onDownload={downloadImage}
                />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}