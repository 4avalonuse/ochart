// Fonte única da identidade/versionamento do OChart.
export const APP_NAME = 'OChart';
export const VERSION = '0.7.0';
export const VERSION_LABEL = `v${VERSION}`;
export const APP_TITLE = `${APP_NAME} ${VERSION_LABEL}`;

export function applyVersionUI(root = document) {
  root.querySelectorAll('[data-ochart-version]').forEach(el => {
    el.textContent = el.classList.contains('brand-version') ? VERSION_LABEL : APP_TITLE;
  });
  if (typeof document !== 'undefined') {
    document.title = `${APP_TITLE} — terminal de pesquisa`;
  }
}
