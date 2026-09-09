import { useEffect, useRef } from 'react';

/**
 * Hooka um modal/drawer (renderizado condicionalmente pelo pai) ao botão voltar
 * do navegador/Android. Ao montar, empurra um estado de histórico; ao pressionar
 * "voltar", o popstate dispara o onClose. Ao fechar pelo botão X (sem voltar),
 * o estado órfão é removido para manter o histórico limpo.
 */
export function useBackButtonClose(onClose) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const closedByBack = useRef(false);

  useEffect(() => {
    closedByBack.current = false;
    window.history.pushState({ modal: true }, '');
    const handler = () => {
      closedByBack.current = true;
      onCloseRef.current();
    };
    window.addEventListener('popstate', handler);
    return () => {
      window.removeEventListener('popstate', handler);
      if (!closedByBack.current) {
        window.history.back();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}