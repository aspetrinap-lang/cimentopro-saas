// Definição da campanha de infográficos: uma peça 4:5 por aba do CimentoPro.
// Usada apenas pelo backend (marketingInfographics) — o frontend recebe esta
// lista pela ação 'list', sem duplicação.

const STYLE = {
  palette: 'azul-escuro #1E293B, cinza neutro #64748B, verde #16A34A como acento, fundo off-white #F8FAFC',
};

export const CAMPAIGN_GROUPS = ['Produção', 'Qualidade e IA', 'Gestão financeira'];

export const CAMPAIGN_TABS = [
  // ── Produção ──
  {
    key: 'dashboard',
    group: 'Produção',
    order: 1,
    title: 'Controle de Fábrica',
    bullets: [
      'Acompanhe produção, consumo e custos em tempo real',
      'Indicadores de eficiência e refugo da fábrica',
      'Alertas de manutenção e desvios de traço',
    ],
  },
  {
    key: 'orders',
    group: 'Produção',
    order: 2,
    title: 'Ordens de Produção',
    bullets: [
      'Crie e acompanhe ordens por artefato e traço',
      'Registre paradas e falhas de máquina na ordem',
      'Status claro: planejada, em produção e concluída',
    ],
  },
  {
    key: 'operator-panel',
    group: 'Produção',
    order: 3,
    title: 'Painel do Operador',
    bullets: [
      'Apontamento rápido direto do chão de fábrica',
      'Produção, moldadas e ciclos por máquina',
      'Acesso simples por PIN, sem digitar e-mail',
    ],
  },
  {
    key: 'history',
    group: 'Produção',
    order: 4,
    title: 'Histórico',
    bullets: [
      'Todo o histórico de produção da fábrica',
      'Filtros por período, produto e máquina',
      'Base auditável para decisões e relatórios',
    ],
  },
  {
    key: 'analysis',
    group: 'Produção',
    order: 5,
    title: 'Análise',
    bullets: [
      'Consumo específico por produto e traço',
      'Desvios de insumo com causa provável',
      'Estabilidade do processo dia a dia',
    ],
  },
  // ── Qualidade e IA ──
  {
    key: 'quality',
    group: 'Qualidade e IA',
    order: 6,
    title: 'Qualidade e Laudos',
    bullets: [
      'Laudos de resistência com curvas de crescimento',
      'Rupturas 7 e 28 dias organizadas por lote',
      'Calibração de prensas e equipamentos',
    ],
  },
  {
    key: 'stats',
    group: 'Qualidade e IA',
    order: 7,
    title: 'Controle Estatístico',
    bullets: [
      'Limites de controle por produto e insumo',
      'Rankings de refugo e estabilidade',
      'Comparação de máquinas e lotes',
    ],
  },
  {
    key: 'virtual-engineer',
    group: 'Qualidade e IA',
    order: 8,
    title: 'Engenheiro Virtual (IA)',
    bullets: [
      'IA que interpreta os dados da sua fábrica',
      'Achados com evidências e nível de confiança',
      'Recomendações práticas de ajuste de traço',
    ],
  },
  {
    key: 'executive-summary',
    group: 'Qualidade e IA',
    order: 9,
    title: 'Resumo Executivo',
    bullets: [
      'Panorama do período em uma única tela',
      'Problemas críticos priorizados automaticamente',
      'Pronto para levar à reunião de diretoria',
    ],
  },
  // ── Gestão financeira ──
  {
    key: 'costs',
    group: 'Gestão financeira',
    order: 10,
    title: 'Análise de Custos',
    bullets: [
      'Custeio industrial completo por artefato',
      'DRE integrada com classificação por conta',
      'Evolução do custo unitário ao longo do tempo',
    ],
  },
  {
    key: 'pricing',
    group: 'Gestão financeira',
    order: 11,
    title: 'Simulador de Preços',
    bullets: [
      'Preço mínimo e ideal por produto',
      'Simule cenários de volume e insumo',
      'Margem de contribuição em tempo real',
    ],
  },
  {
    key: 'break-even',
    group: 'Gestão financeira',
    order: 12,
    title: 'Ponto de Equilíbrio',
    bullets: [
      'PEC, PEF e PEE calculados por período',
      'Margem de segurança do negócio',
      'Faturamento necessário para o lucro desejado',
    ],
  },
];

export function buildPrompt(tab) {
  return [
    'Infográfico vertical para post de Instagram, proporção 4:5, estilo clean minimalista de alta qualidade:',
    'fundo off-white claro, tipografia sans-serif moderna e perfeitamente legível, ícones grandes de traço fino,',
    'muito espaço em branco, hierarquia visual clara, design elegante e profissional.',
    `Produto: CimentoPro — plataforma de gestão para fábricas de artefatos de concreto (blocos, pavimentos, meio-fios).`,
    `Título grande no topo: "${tab.title}". Subtítulo pequeno abaixo do título: "CimentoPro".`,
    `Seção central com exatamente 3 itens, cada um com um ícone e um texto curto em português do Brasil:`,
    tab.bullets.map((b) => `- ${b}`).join(' '),
    `Rodapé discreto com o texto "cimentopro".`,
    `Paleta: ${STYLE.palette}.`,
    'Sem fotos de pessoas, sem marca d\'água, sem lorem ipsum; todos os textos em português do Brasil, curtos e corretos.',
  ].join(' ');
}