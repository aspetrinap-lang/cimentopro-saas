// Composição do infográfico 4:5 (1080×1350) no canvas: print real da aba
// (capturado com html2canvas) dentro de uma moldura rica — cabeçalho de
// marca navy, título em destaque, cards de conceitos, seção de exemplo
// prático (stats coloridos + tabela, valores ilustrativos) e rodapé.

function roundRectPath(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function wrapLines(ctx, text, maxWidth) {
  const words = String(text || '').split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (ctx.measureText(candidate).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  return lines;
}

const COLORS = {
  navy: '#1E293B',
  body: '#334155',
  muted: '#64748B',
  soft: '#94A3B8',
  bg: '#F8FAFC',
  border: '#E2E8F0',
  green: '#16A34A',
  greenSoft: '#ECFDF5',
  greenBorder: '#A7F3D0',
  tableHead: '#F1F5F9',
};

const STAT_COLORS = {
  green: { bg: '#ECFDF5', border: '#10B981', text: '#065F46' },
  blue: { bg: '#EFF6FF', border: '#3B82F6', text: '#1E3A8A' },
  orange: { bg: '#FFF7ED', border: '#F97316', text: '#7C2D12' },
  purple: { bg: '#F5F3FF', border: '#8B5CF6', text: '#4C1D95' },
};

export function composeInfographic({ screenshot, tab, companyName }) {
  const W = 1080;
  const H = 1350;
  const MARGIN = 80;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  ctx.textBaseline = 'alphabetic';

  ctx.fillStyle = COLORS.bg;
  ctx.fillRect(0, 0, W, H);

  const showcase = tab?.showcase || { stats: [], table: null };

  // ── Cabeçalho (faixa navy) ──
  ctx.fillStyle = COLORS.navy;
  ctx.fillRect(0, 0, W, 130);
  ctx.fillStyle = COLORS.green;
  roundRectPath(ctx, 70, 40, 52, 52, 12);
  ctx.fill();
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(80, 74, 7, 12);
  ctx.fillRect(92, 64, 7, 22);
  ctx.fillRect(104, 54, 7, 32);
  ctx.fillStyle = '#FFFFFF';
  ctx.font = '800 38px Inter, sans-serif';
  ctx.fillText('CimentoPro', 142, 68);
  ctx.fillStyle = COLORS.soft;
  ctx.font = '600 13px Inter, sans-serif';
  ctx.fillText('GESTÃO INTELIGENTE PARA FÁBRICAS DE ARTEFATOS DE CONCRETO', 143, 98);

  // Chip à direita: empresa ativa (ou slogan padrão)
  let chipText = (companyName || 'DECISÕES MAIS SEGURAS').toUpperCase();
  ctx.font = '700 20px Inter, sans-serif';
  let chipW = ctx.measureText(chipText).width + 48;
  if (chipW > 360) {
    while (chipText.length > 4 && ctx.measureText(`${chipText}…`).width + 48 > 360) {
      chipText = chipText.slice(0, -1);
    }
    chipText = `${chipText}…`;
    chipW = 360;
  }
  const chipX = W - 80 - chipW;
  ctx.fillStyle = 'rgba(255,255,255,0.14)';
  roundRectPath(ctx, chipX, 45, chipW, 44, 22);
  ctx.fill();
  ctx.fillStyle = '#FFFFFF';
  ctx.textAlign = 'center';
  ctx.fillText(chipText, chipX + chipW / 2, 74);
  ctx.textAlign = 'left';

  // ── Título ──
  ctx.fillStyle = COLORS.navy;
  ctx.font = '800 56px Inter, sans-serif';
  const titleLines = wrapLines(ctx, tab?.title || '', W - MARGIN * 2).slice(0, 2);
  let titleY = 200;
  titleLines.forEach((line) => {
    ctx.fillText(line, MARGIN, titleY);
    titleY += 62;
  });
  titleY -= 62;
  ctx.fillStyle = COLORS.green;
  ctx.fillRect(MARGIN, titleY + 16, 140, 10);

  // ── Cards de conceitos (bullets da aba) ──
  const cardsY = titleY + 52;
  const cardH = 215;
  const cardW = 450;

  // Card 1 — O QUE É
  ctx.fillStyle = '#FFFFFF';
  roundRectPath(ctx, MARGIN, cardsY, cardW, cardH, 16);
  ctx.fill();
  ctx.strokeStyle = COLORS.border;
  ctx.lineWidth = 2;
  roundRectPath(ctx, MARGIN, cardsY, cardW, cardH, 16);
  ctx.stroke();
  ctx.fillStyle = COLORS.green;
  ctx.fillRect(MARGIN + 24, cardsY + 28, 14, 14);
  ctx.fillStyle = COLORS.navy;
  ctx.font = '800 17px Inter, sans-serif';
  ctx.fillText('O QUE É', MARGIN + 50, cardsY + 41);
  ctx.fillStyle = COLORS.body;
  ctx.font = '500 23px Inter, sans-serif';
  let bodyY = cardsY + 92;
  wrapLines(ctx, (tab?.bullets || [])[0] || '', cardW - 48).slice(0, 4).forEach((line) => {
    ctx.fillText(line, MARGIN + 24, bodyY);
    bodyY += 34;
  });

  // Card 2 — POR QUE USAR
  const card2X = MARGIN + cardW + 20;
  ctx.fillStyle = COLORS.greenSoft;
  roundRectPath(ctx, card2X, cardsY, cardW, cardH, 16);
  ctx.fill();
  ctx.strokeStyle = COLORS.greenBorder;
  roundRectPath(ctx, card2X, cardsY, cardW, cardH, 16);
  ctx.stroke();
  ctx.fillStyle = COLORS.green;
  ctx.fillRect(card2X + 24, cardsY + 28, 14, 14);
  ctx.fillStyle = COLORS.navy;
  ctx.font = '800 17px Inter, sans-serif';
  ctx.fillText('POR QUE USAR', card2X + 50, cardsY + 41);
  ctx.font = '500 20px Inter, sans-serif';
  let dotY = cardsY + 86;
  (tab?.bullets || []).slice(1, 3).forEach((bullet) => {
    const lines = wrapLines(ctx, bullet, cardW - 66).slice(0, 2);
    ctx.fillStyle = COLORS.green;
    ctx.beginPath();
    ctx.arc(card2X + 32, dotY - 7, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = COLORS.body;
    lines.forEach((line, idx) => {
      ctx.fillText(line, card2X + 50, dotY + idx * 28);
    });
    dotY += 28 * lines.length + 14;
  });

  // ── Painel do print real ──
  const SHOT_MARGIN = MARGIN;
  const sw = W - SHOT_MARGIN * 2;
  const sh = 380;
  const sy = cardsY + cardH + 35;
  if (screenshot && screenshot.width && screenshot.height) {
    const targetAspect = sw / sh;
    const cropH = Math.min(screenshot.width / targetAspect, screenshot.height);
    const cropY = 0;
    ctx.save();
    roundRectPath(ctx, SHOT_MARGIN, sy, sw, sh, 18);
    ctx.clip();
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(SHOT_MARGIN, sy, sw, sh);
    ctx.drawImage(screenshot, 0, cropY, screenshot.width, cropH, SHOT_MARGIN, sy, sw, sh);
    ctx.restore();
    ctx.strokeStyle = COLORS.border;
    ctx.lineWidth = 3;
    roundRectPath(ctx, SHOT_MARGIN, sy, sw, sh, 18);
    ctx.stroke();
  } else {
    ctx.fillStyle = '#FFFFFF';
    roundRectPath(ctx, SHOT_MARGIN, sy, sw, sh, 18);
    ctx.fill();
    ctx.strokeStyle = COLORS.border;
    ctx.lineWidth = 3;
    roundRectPath(ctx, SHOT_MARGIN, sy, sw, sh, 18);
    ctx.stroke();
    ctx.fillStyle = COLORS.soft;
    ctx.font = '600 26px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Print da aba indisponível', W / 2, sy + sh / 2);
    ctx.textAlign = 'left';
  }

  // ── Seção: exemplo prático (valores ilustrativos) ──
  const sectionY = sy + sh + 62;
  ctx.fillStyle = COLORS.green;
  ctx.fillRect(MARGIN, sectionY - 24, 8, 30);
  ctx.fillStyle = COLORS.navy;
  ctx.font = '800 26px Inter, sans-serif';
  const headLabel = 'EXEMPLO PRÁTICO';
  const headLabelW = ctx.measureText(headLabel).width;
  ctx.fillText(headLabel, MARGIN + 22, sectionY);
  ctx.fillStyle = COLORS.muted;
  ctx.font = '600 17px Inter, sans-serif';
  ctx.fillText('(valores ilustrativos)', MARGIN + 36 + headLabelW, sectionY);

  const table = showcase.table;
  const tableY = sectionY + 28;
  const tableW = 480;
  const headH = 40;
  const rowH = 44;

  if (table && Array.isArray(table.rows)) {
    ctx.fillStyle = COLORS.tableHead;
    ctx.fillRect(MARGIN, tableY, tableW, headH);
    ctx.fillStyle = COLORS.navy;
    ctx.font = '700 17px Inter, sans-serif';
    ctx.fillText(String(table.columns?.[0] || ''), MARGIN + 16, tableY + 26);
    ctx.textAlign = 'right';
    ctx.fillText(String(table.columns?.[1] || ''), MARGIN + tableW - 16, tableY + 26);
    ctx.textAlign = 'left';

    table.rows.slice(0, 4).forEach((row, idx) => {
      const rowY = tableY + headH + idx * rowH;
      if (idx > 0) {
        ctx.strokeStyle = COLORS.border;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(MARGIN, rowY);
        ctx.lineTo(MARGIN + tableW, rowY);
        ctx.stroke();
      }
      ctx.fillStyle = COLORS.body;
      ctx.font = '500 19px Inter, sans-serif';
      ctx.fillText(String(row[0] || ''), MARGIN + 16, rowY + 29);
      ctx.fillStyle = COLORS.navy;
      ctx.font = '700 19px Inter, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(String(row[1] || ''), MARGIN + tableW - 16, rowY + 29);
      ctx.textAlign = 'left';
    });
  }

  // Chips coloridos (stats ilustrativos) à direita da tabela
  const chipsX = MARGIN + tableW + 24;
  const chipsW = W - MARGIN - chipsX;
  const chipH = 61;
  const chipGap = 16;
  (showcase.stats || []).slice(0, 3).forEach((stat, idx) => {
    const palette = STAT_COLORS[stat.color] || STAT_COLORS.green;
    const chipY = tableY + idx * (chipH + chipGap);
    ctx.fillStyle = palette.bg;
    roundRectPath(ctx, chipsX, chipY, chipsW, chipH, 12);
    ctx.fill();
    ctx.fillStyle = palette.border;
    ctx.fillRect(chipsX, chipY + 8, 8, chipH - 16);
    ctx.fillStyle = COLORS.muted;
    ctx.font = '600 15px Inter, sans-serif';
    ctx.fillText(String(stat.label || ''), chipsX + 28, chipY + 24);
    ctx.fillStyle = palette.text;
    ctx.font = '800 24px Inter, sans-serif';
    ctx.fillText(String(stat.value || ''), chipsX + 28, chipY + 50);
  });

  // ── Rodapé (faixa navy) ──
  const footerY = H - 100;
  ctx.fillStyle = COLORS.navy;
  ctx.fillRect(0, footerY, W, 100);
  ctx.fillStyle = '#FFFFFF';
  ctx.font = '800 30px Inter, sans-serif';
  ctx.fillText('CimentoPro', MARGIN, footerY + 46);
  ctx.fillStyle = COLORS.soft;
  ctx.font = '500 15px Inter, sans-serif';
  ctx.fillText('Dados que transformam produção em lucro', MARGIN, footerY + 72);
  ctx.fillStyle = COLORS.green;
  ctx.fillRect(W - 330, footerY, 250, 100);
  ctx.fillStyle = '#FFFFFF';
  ctx.textAlign = 'center';
  ctx.font = '700 15px Inter, sans-serif';
  ctx.fillText('CONHEÇA O', W - 205, footerY + 40);
  ctx.font = '800 26px Inter, sans-serif';
  ctx.fillText('CIMENTOPRO', W - 205, footerY + 70);
  ctx.textAlign = 'left';

  return canvas;
}

export function canvasToPngBlob(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Falha ao gerar o PNG do infográfico.'));
    }, 'image/png');
  });
}