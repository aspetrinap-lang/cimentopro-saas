// Composição do infográfico 4:5 (1080×1350) no canvas: print real da aba
// (capturado com html2canvas) + título da aba + bullets informativos.
// Estilo clean minimalista — paleta azul-escuro/cinza/verde sobre off-white.

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
  bg: '#F8FAFC',
  accent: '#16A34A',
  title: '#1E293B',
  body: '#334155',
  muted: '#94A3B8',
};

export function composeInfographic({ screenshot, tab, companyName }) {
  const W = 1080;
  const H = 1350;
  const MARGIN = 80;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = COLORS.bg;
  ctx.fillRect(0, 0, W, H);

  // Cabeçalho
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = COLORS.accent;
  ctx.font = '700 26px Inter, sans-serif';
  ctx.fillText(`CIMENTOPRO${companyName ? ` · ${companyName}` : ''}`, MARGIN, 88);

  ctx.fillStyle = COLORS.title;
  ctx.font = '800 60px Inter, sans-serif';
  const titleLines = wrapLines(ctx, tab?.title || '', W - MARGIN * 2).slice(0, 2);
  let titleY = 168;
  titleLines.forEach((line) => {
    ctx.fillText(line, MARGIN, titleY);
    titleY += 70;
  });

  // Painel do print real (recorte proporcional do topo da tela capturada)
  const SHOT_MARGIN = MARGIN - 20;
  const sw = W - SHOT_MARGIN * 2;
  const sh = 600;
  const sy = Math.max(titleY + 30, 260);
  const sx = SHOT_MARGIN;

  if (screenshot && screenshot.width && screenshot.height) {
    const targetAspect = sw / sh;
    let cropH = Math.min(screenshot.width / targetAspect, screenshot.height);
    let cropY = Math.min(20, Math.max(0, screenshot.height - cropH));
    ctx.save();
    roundRectPath(ctx, sx, sy, sw, sh, 18);
    ctx.clip();
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(sx, sy, sw, sh);
    ctx.drawImage(screenshot, 0, cropY, screenshot.width, cropH, sx, sy, sw, sh);
    ctx.restore();
    ctx.strokeStyle = '#E2E8F0';
    ctx.lineWidth = 3;
    roundRectPath(ctx, sx, sy, sw, sh, 18);
    ctx.stroke();
  }

  // Bullets informativos da aba
  ctx.font = '500 32px Inter, sans-serif';
  let by = sy + sh + 78;
  const bullets = (tab?.bullets || []).slice(0, 3);
  bullets.forEach((bullet) => {
    const lines = wrapLines(ctx, bullet, W - MARGIN * 2 - 60).slice(0, 2);
    ctx.fillStyle = COLORS.accent;
    ctx.beginPath();
    ctx.arc(MARGIN + 10, by - 11, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = COLORS.body;
    lines.forEach((line, idx) => {
      ctx.fillText(line, MARGIN + 44, by + idx * 44);
    });
    by += 44 * lines.length + 26;
  });

  // Rodapé
  ctx.fillStyle = COLORS.muted;
  ctx.font = '600 26px Inter, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('cimentopro', W / 2, H - 48);
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