// Logo oficial do aplicativo (PNG hospedado em URL pública — enviada pelo
// usuário). O compositor de infográficos carrega esta imagem e a exibe no
// cabeçalho/rodapé; com a URL vazia ou falha de carregamento, usa a marca
// desenhada como fallback.
export const APP_LOGO_URL = 'https://media.base44.com/images/public/6aa1a331da2c69a76e81454f/42d1670ed_image.png';

// Carrega a logo para uso no canvas (crossOrigin para não "sujar" o canvas).
export function loadAppLogo() {
  if (!APP_LOGO_URL) return Promise.resolve(null);
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = APP_LOGO_URL;
  });
}