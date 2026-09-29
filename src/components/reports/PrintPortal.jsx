import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

// Renderiza o relatório fora da árvore do app (portal direto no <body>, em
// #print-overlay) e marca o <body> com a classe print-mode enquanto montado.
// O CSS @media print usa essa classe para ocultar #root e imprimir apenas o
// relatório — sem depender de :has(), funcionando em qualquer navegador.
// Ao receber `title`, o document.title é trocado pelo título do relatório
// enquanto ele está aberto — o Chrome/navegador sugere o nome do arquivo PDF
// a partir do título do documento (restaurado ao fechar).
export default function PrintPortal({ children, title }) {
  const [container] = useState(() => {
    if (typeof document === 'undefined') return null;
    const el = document.createElement('div');
    el.id = 'print-overlay';
    return el;
  });

  useEffect(() => {
    if (!container) return undefined;
    document.body.appendChild(container);
    document.body.classList.add('print-mode');
    let previousTitle = null;
    if (title && typeof document !== 'undefined') {
      previousTitle = document.title;
      document.title = title;
    }
    return () => {
      if (previousTitle !== null) document.title = previousTitle;
      document.body.classList.remove('print-mode');
      container.remove();
    };
  }, [container, title]);

  if (!container) return null;
  return createPortal(children, container);
}