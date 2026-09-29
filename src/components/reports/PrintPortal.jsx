import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

// Renderiza o relatório fora da árvore do app (portal direto no <body>, em
// #print-overlay) e marca o <body> com a classe print-mode enquanto montado.
// O CSS @media print usa essa classe para ocultar #root e imprimir apenas o
// relatório — sem depender de :has(), funcionando em qualquer navegador.
export default function PrintPortal({ children }) {
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
    return () => {
      document.body.classList.remove('print-mode');
      container.remove();
    };
  }, [container]);

  if (!container) return null;
  return createPortal(children, container);
}