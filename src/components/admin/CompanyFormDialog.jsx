import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import { ImagePlus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';

const EMPTY = {
  name: '', legal_name: '', document: '', email: '',
  phone: '', address: '', city: '', state: '', zip_code: '',
  logo_url: '',
  owner_email: '', owner_role: 'owner',
};

const FIELDS = [
  ['name', 'Nome comercial *'],
  ['legal_name', 'Razão social'],
  ['document', 'CNPJ'],
  ['email', 'E-mail de contato'],
  ['phone', 'Telefone'],
  ['address', 'Endereço'],
  ['city', 'Cidade'],
  ['state', 'UF'],
  ['zip_code', 'CEP'],
];

export default function CompanyFormDialog({ open, company, onClose, onSaved }) {
  const { toast } = useToast();
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(company
        ? {
          ...FIELDS.reduce((acc, [key]) => ({ ...acc, [key]: company[key] || '' }), { ...EMPTY }),
          logo_url: company.logo_url || '',
        }
        : { ...EMPTY });
    }
  }, [open, company]);

  function set(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  // Upload do logotipo: imagem pública permanente, vinculada ao cadastro.
  async function handleLogoChange(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast({ title: 'Selecione um arquivo de imagem (PNG, JPG...)', variant: 'destructive' });
      return;
    }
    setUploading(true);
    try {
      const res = await base44.integrations.Core.UploadPublicFile({ file });
      const url = res?.file_url || res?.data?.file_url;
      if (!url) throw new Error('Não foi possível obter a URL do logotipo');
      set('logo_url', url);
    } catch (err) {
      toast({ title: 'Erro ao enviar logotipo', description: err.message, variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.name.trim()) {
      toast({ title: 'Informe o nome da empresa', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const res = await base44.functions.invoke('adminCompanies', {
        action: company ? 'update' : 'create',
        company_id: company?.id,
        ...form,
      });
      // Nova empresa: vincula o primeiro usuário na mesma ação — e-mails sem
      // conta recebem o convite da plataforma e entram direto na empresa.
      if (!company && form.owner_email.trim()) {
        const newCompanyId = res.data?.company?.id;
        try {
          const linkRes = await base44.functions.invoke('companyMembers', {
            action: 'link', company_id: newCompanyId, email: form.owner_email.trim(), role: form.owner_role,
          });
          toast({
            title: linkRes.data?.invited ? 'Empresa criada e convite enviado' : 'Empresa criada e usuário vinculado',
            description: `${form.owner_email.trim()} ${linkRes.data?.invited ? 'recebeu o convite de acesso e já está vinculado' : 'já tem acesso'} a ${res.data?.company?.name || form.name}.`,
          });
        } catch (linkErr) {
          toast({
            title: 'Empresa criada, mas o vínculo falhou',
            description: linkErr.response?.data?.error || linkErr.message,
            variant: 'destructive',
          });
        }
      } else {
        toast({ title: company ? 'Empresa atualizada' : 'Empresa criada com status ativo' });
      }
      onSaved();
    } catch (err) {
      toast({ title: 'Erro ao salvar empresa', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{company ? 'Editar Empresa' : 'Nova Empresa'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
          {FIELDS.map(([key, label]) => (
            <div key={key} className={key === 'address' ? 'sm:col-span-2' : ''}>
              <Label htmlFor={`cf-${key}`} className="text-xs text-slate-500">{label}</Label>
              <Input
                id={`cf-${key}`}
                value={form[key]}
                onChange={(e) => set(key, e.target.value)}
                className="mt-1"
                maxLength={key === 'state' ? 2 : undefined}
              />
            </div>
          ))}
          <div className="sm:col-span-2 border border-border rounded-lg p-3 bg-muted/30">
            <p className="text-xs font-semibold text-foreground">Logotipo da empresa</p>
            <div className="flex items-center gap-3 mt-2">
              {form.logo_url ? (
                <img src={form.logo_url} alt="Logotipo da empresa" className="h-14 w-14 object-contain border border-border rounded-lg bg-white p-1" />
              ) : (
                <div className="h-14 w-14 border border-dashed border-border rounded-lg bg-white flex items-center justify-center">
                  <ImagePlus className="w-5 h-5 text-slate-300" />
                </div>
              )}
              <div className="flex items-center gap-2">
                <label className="inline-flex items-center gap-2 px-3 py-2 text-sm rounded-lg border border-input bg-background hover:bg-accent hover:text-accent-foreground transition-colors cursor-pointer">
                  <ImagePlus className="w-4 h-4" />
                  {uploading ? 'Enviando...' : 'Enviar imagem'}
                  <input type="file" accept="image/*" className="hidden" disabled={uploading} onChange={handleLogoChange} />
                </label>
                {form.logo_url && (
                  <Button type="button" variant="ghost" onClick={() => set('logo_url', '')} className="text-destructive hover:text-destructive">
                    <Trash2 className="w-4 h-4" /> Remover
                  </Button>
                )}
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground mt-2">
              Aparece no menu, no cabeçalho do aplicativo e nos relatórios e impressões da empresa.
            </p>
          </div>
          {!company && (
            <div className="sm:col-span-2 border border-border rounded-lg p-3 bg-muted/30 space-y-2">
              <p className="text-xs font-semibold text-foreground">Primeiro usuário (opcional)</p>
              <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-2">
                <Input
                  type="email"
                  value={form.owner_email}
                  onChange={(e) => set('owner_email', e.target.value)}
                  placeholder="E-mail do dono — sem conta, recebe convite de acesso"
                />
                <select
                  value={form.owner_role}
                  onChange={(e) => set('owner_role', e.target.value)}
                  className="border border-input rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring sm:w-40"
                >
                  <option value="owner">Dono</option>
                  <option value="admin">Administrador</option>
                  <option value="supervisor">Supervisor</option>
                </select>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Vinculado à empresa na criação — se ainda não tem conta no CimentoPro, recebe o convite e o primeiro acesso já entra na empresa.
              </p>
            </div>
          )}
          <DialogFooter className="sm:col-span-2 gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}