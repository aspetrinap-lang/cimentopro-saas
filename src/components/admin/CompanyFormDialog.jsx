import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';

const EMPTY = {
  name: '', legal_name: '', document: '', email: '',
  phone: '', address: '', city: '', state: '', zip_code: '',
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

  useEffect(() => {
    if (open) {
      setForm(company
        ? FIELDS.reduce((acc, [key]) => ({ ...acc, [key]: company[key] || '' }), { ...EMPTY })
        : { ...EMPTY });
    }
  }, [open, company]);

  function set(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.name.trim()) {
      toast({ title: 'Informe o nome da empresa', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      await base44.functions.invoke('adminCompanies', {
        action: company ? 'update' : 'create',
        company_id: company?.id,
        ...form,
      });
      toast({ title: company ? 'Empresa atualizada' : 'Empresa criada com status ativo' });
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
          <DialogFooter className="sm:col-span-2 gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}