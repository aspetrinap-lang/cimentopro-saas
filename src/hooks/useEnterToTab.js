import { useEffect } from 'react';

// Intercepta o Enter em campos de formulário (input/textarea/select) dentro de
// elementos <form>, impede o envio do formulário e move o foco para o próximo
// campo focável — comportamento de "pular célula" em todo o sistema.
// Textareas usam Enter para quebra de linha e são ignorados.
export function useEnterToTab() {
  useEffect(() => {
    function handler(e) {
      if (e.key !== 'Enter') return;
      const el = e.target;
      if (!el || !el.closest || !el.closest('form')) return;
      const tag = el.tagName;
      if (tag === 'TEXTAREA') return; // Enter = quebra de linha
      // Permite Enter em botões submit
      if (tag === 'BUTTON' && el.type === 'submit') return;
      e.preventDefault();
      const form = el.closest('form');
      const focusable = Array.from(form.querySelectorAll(
        'input:not([type="hidden"]):not([disabled]):not([readonly]), select:not([disabled]):not([readonly]), textarea:not([disabled]):not([readonly]), button:not([disabled])'
      ));
      const idx = focusable.indexOf(el);
      if (idx >= 0 && idx < focusable.length - 1) {
        focusable[idx + 1].focus();
      }
    }
    document.addEventListener('keydown', handler, true);
    return () => document.removeEventListener('keydown', handler, true);
  }, []);
}