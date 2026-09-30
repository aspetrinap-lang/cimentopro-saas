// Rótulos e cores do módulo de Suporte — espelham os enums do backend
// (base44/shared/supportCore.ts). Fonte de exibição do cliente.
import { formatDateTimeBR } from '@/lib/dateFormat';

export const STATUS_LABELS = {
  OPEN: 'Aberto',
  IN_PROGRESS: 'Em atendimento',
  WAITING_CUSTOMER: 'Aguardando cliente',
  WAITING_INTERNAL: 'Aguardando interno',
  RESOLVED: 'Resolvido',
  CLOSED: 'Fechado',
};

export const STATUS_COLORS = {
  OPEN: 'bg-sky-100 text-sky-700',
  IN_PROGRESS: 'bg-indigo-100 text-indigo-700',
  WAITING_CUSTOMER: 'bg-amber-100 text-amber-700',
  WAITING_INTERNAL: 'bg-amber-100 text-amber-700',
  RESOLVED: 'bg-green-100 text-green-700',
  CLOSED: 'bg-slate-100 text-slate-500',
};

export const PRIORITY_LABELS = {
  LOW: 'Baixa',
  NORMAL: 'Normal',
  HIGH: 'Alta',
  URGENT: 'Urgente',
};

export const PRIORITY_COLORS = {
  LOW: 'bg-slate-100 text-slate-600',
  NORMAL: 'bg-sky-100 text-sky-700',
  HIGH: 'bg-amber-100 text-amber-700',
  URGENT: 'bg-red-100 text-red-700',
};

export const PRIORITY_OPTIONS = [
  { value: 'LOW', label: 'Baixa' },
  { value: 'NORMAL', label: 'Normal' },
  { value: 'HIGH', label: 'Alta' },
  { value: 'URGENT', label: 'Urgente' },
];

export const CATEGORY_OPTIONS = [
  { value: 'DUVIDA', label: 'Dúvida' },
  { value: 'ERRO_SISTEMA', label: 'Erro do sistema' },
  { value: 'PRODUCAO', label: 'Produção' },
  { value: 'QUALIDADE', label: 'Qualidade' },
  { value: 'MANUTENCAO', label: 'Manutenção' },
  { value: 'CUSTOS', label: 'Custos' },
  { value: 'DRE', label: 'DRE' },
  { value: 'SIMULADOR_PRECOS', label: 'Simulador de Preços' },
  { value: 'PONTO_EQUILIBRIO', label: 'Ponto de Equilíbrio' },
  { value: 'LAUDOS', label: 'Laudos' },
  { value: 'IA', label: 'Inteligência Artificial' },
  { value: 'USUARIOS_PERMISSOES', label: 'Usuários e permissões' },
  { value: 'ASSINATURA', label: 'Assinatura' },
  { value: 'SUGESTAO', label: 'Sugestão' },
  { value: 'OUTROS', label: 'Outros' },
];

export const SOURCE_LABELS = {
  IN_APP: 'No aplicativo',
  HELP_CENTER: 'Central de Ajuda',
  ERROR_REPORT: 'Relato de problema',
  EMAIL: 'E-mail',
  WHATSAPP: 'WhatsApp',
  SYSTEM: 'Sistema',
};

export const STATUS_OPTIONS = [
  { value: 'OPEN', label: 'Aberto' },
  { value: 'IN_PROGRESS', label: 'Em atendimento' },
  { value: 'WAITING_CUSTOMER', label: 'Aguardando cliente' },
  { value: 'WAITING_INTERNAL', label: 'Aguardando interno' },
  { value: 'RESOLVED', label: 'Resolvido' },
  { value: 'CLOSED', label: 'Fechado' },
];

export const APP_VERSION = 'web 0.0.0';

export const padTicketNumber = (n) => `#${String(Number(n) || 0).padStart(6, '0')}`;

export const fmtDateTime = (iso) => formatDateTimeBR(iso);