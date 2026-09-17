// Fonte única da identidade/versionamento do OChart.
// Para lançar uma nova versão, altere apenas VERSION e, se necessário, APP_NAME.

export const APP_NAME = 'OChart';
export const VERSION = '0.4.0';
export const VERSION_LABEL = `v${VERSION}`;
export const APP_TITLE = `${APP_NAME} ${VERSION_LABEL}`;

export function applyVersionUI(root = document) {
  root.querySelectorAll('[data-ochart-version]').forEach(el => {
    el.textContent = APP_TITLE;
  });

  if (typeof document !== 'undefined') {
    document.title = `${APP_TITLE} — visualizador`;
  }
}
