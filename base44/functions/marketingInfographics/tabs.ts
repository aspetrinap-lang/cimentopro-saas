// Definição da campanha de infográficos: uma peça 4:5 por aba do CimentoPro.
// Usada apenas pelo backend (marketingInfographics) — o frontend recebe esta
// lista pela ação 'list', sem duplicação. O campo `showcase` alimenta os
// blocos ilustrativos do compositor (stats coloridos + tabela de exemplo);
// TODOS os valores são fictícios e exibidos como "valores ilustrativos".

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
    showcase: {
      stats: [
        { label: 'Produção no mês', value: '128.400 peças', color: 'green' },
        { label: 'Eficiência das linhas', value: '92,4%', color: 'blue' },
        { label: 'Refugo', value: '2,1%', color: 'orange' },
      ],
      table: {
        columns: ['Indicador', 'Mês'],
        rows: [
          ['Peças produzidas', '128.400'],
          ['Cimento consumido', '412 t'],
          ['Custo de insumos', 'R$ 184.300'],
          ['Custo médio/peça', 'R$ 1,44'],
        ],
      },
    },
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
    showcase: {
      stats: [
        { label: 'Ordens ativas', value: '18', color: 'green' },
        { label: 'Concluídas no mês', value: '64', color: 'blue' },
        { label: 'Pontualidade', value: '95%', color: 'orange' },
      ],
      table: {
        columns: ['Produto', 'Planejado (mês)'],
        rows: [
          ['Bloco 9', '48.000 pç'],
          ['Bloco 11,5', '36.000 pç'],
          ['Paver', '24.000 pç'],
          ['Meio-fio', '12.000 pç'],
        ],
      },
    },
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
    showcase: {
      stats: [
        { label: 'Apontamentos hoje', value: '96', color: 'green' },
        { label: 'Moldadas no dia', value: '310', color: 'blue' },
        { label: 'Paradas registradas', value: '3', color: 'orange' },
      ],
      table: {
        columns: ['Turno', 'Produção'],
        rows: [
          ['Manhã', '18.200 pç'],
          ['Tarde', '16.400 pç'],
          ['Noite', '9.800 pç'],
          ['Tempo parado', '46 min'],
        ],
      },
    },
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
    showcase: {
      stats: [
        { label: 'Registros no mês', value: '1.240', color: 'green' },
        { label: 'Dias de produção', value: '26', color: 'blue' },
        { label: 'Lotes rastreados', value: '310', color: 'orange' },
      ],
      table: {
        columns: ['Semana', 'Produção'],
        rows: [
          ['1ª semana', '31.500 pç'],
          ['2ª semana', '29.800 pç'],
          ['3ª semana', '33.100 pç'],
          ['4ª semana', '34.000 pç'],
        ],
      },
    },
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
    showcase: {
      stats: [
        { label: 'Consumo específico', value: '5,8 kg/pç', color: 'green' },
        { label: 'Estabilidade', value: '94%', color: 'blue' },
        { label: 'Desvio de traço', value: '+1,2%', color: 'orange' },
      ],
      table: {
        columns: ['Insumo', 'Desvio'],
        rows: [
          ['Cimento', '+1,2%'],
          ['Areia média', '−0,8%'],
          ['Brita', '+2,1%'],
          ['Aditivo', '+0,4%'],
        ],
      },
    },
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
    showcase: {
      stats: [
        { label: 'Laudos no mês', value: '46', color: 'green' },
        { label: 'Ruptura média (28d)', value: '6,8 MPa', color: 'blue' },
        { label: 'Aprovação', value: '97%', color: 'orange' },
      ],
      table: {
        columns: ['Produto', '28 dias'],
        rows: [
          ['Bloco 9', '6,9 MPa'],
          ['Bloco 11,5', '6,4 MPa'],
          ['Paver', '8,2 MPa'],
          ['Meio-fio', '7,1 MPa'],
        ],
      },
    },
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
    showcase: {
      stats: [
        { label: 'CpK médio', value: '1,42', color: 'green' },
        { label: 'Máquinas monitoradas', value: '8', color: 'blue' },
        { label: 'Lotes fora do controle', value: '3', color: 'orange' },
      ],
      table: {
        columns: ['Equipamento', 'Desvio médio'],
        rows: [
          ['Prensa 1', '+0,6%'],
          ['Prensa 2', '+1,1%'],
          ['Dosadora A', '−0,4%'],
          ['Dosadora B', '+0,9%'],
        ],
      },
    },
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
    showcase: {
      stats: [
        { label: 'Análises no mês', value: '12', color: 'green' },
        { label: 'Achados com evidência', value: '9', color: 'blue' },
        { label: 'Confiança média', value: 'Alta', color: 'orange' },
      ],
      table: {
        columns: ['Achado', 'Prioridade'],
        rows: [
          ['Desvio de traço', 'Alta'],
          ['Consumo de cimento', 'Alta'],
          ['Manutenção preventiva', 'Média'],
          ['Refugo acima da meta', 'Média'],
        ],
      },
    },
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
    showcase: {
      stats: [
        { label: 'Oportunidades', value: '7', color: 'green' },
        { label: 'Ações sugeridas', value: '11', color: 'blue' },
        { label: 'Problemas críticos', value: '4', color: 'orange' },
      ],
      table: {
        columns: ['Indicador', 'Período'],
        rows: [
          ['Eficiência geral', '92,4%'],
          ['Refugo', '2,1%'],
          ['Custo/peça', 'R$ 1,44'],
          ['Margem bruta', '38%'],
        ],
      },
    },
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
    showcase: {
      stats: [
        { label: 'Custo médio/peça', value: 'R$ 1,44', color: 'green' },
        { label: 'Margem bruta', value: '38%', color: 'blue' },
        { label: 'Custo industrial', value: 'R$ 247.500', color: 'orange' },
      ],
      table: {
        columns: ['Conta (DRE)', 'Mês'],
        rows: [
          ['Matéria-prima', 'R$ 184.300'],
          ['Mão de obra', 'R$ 41.000'],
          ['Energia', 'R$ 12.400'],
          ['Manutenção', 'R$ 9.800'],
        ],
      },
    },
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
    showcase: {
      stats: [
        { label: 'Preço ideal Bloco 9', value: 'R$ 2,10', color: 'green' },
        { label: 'Margem aplicada', value: '30%', color: 'blue' },
        { label: 'Preço mínimo', value: 'R$ 1,62', color: 'orange' },
      ],
      table: {
        columns: ['Produto', 'Preço ideal'],
        rows: [
          ['Bloco 9', 'R$ 2,10'],
          ['Bloco 11,5', 'R$ 2,40'],
          ['Paver', 'R$ 5,00'],
          ['Meio-fio', 'R$ 4,30'],
        ],
      },
    },
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
    showcase: {
      stats: [
        { label: 'PEC', value: 'R$ 300.000', color: 'green' },
        { label: 'PEF', value: 'R$ 240.000', color: 'blue' },
        { label: 'PEE', value: 'R$ 400.000', color: 'orange' },
      ],
      table: {
        columns: ['Item', 'Valor'],
        rows: [
          ['Receita líquida', 'R$ 500.000'],
          ['Custos variáveis', 'R$ 250.000'],
          ['Margem de contribuição', 'R$ 250.000'],
          ['Custos fixos', 'R$ 150.000'],
        ],
      },
    },
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