import { themeManager } from '../ui/theme-manager.js';

function formatPrice(value){
  if (!Number.isFinite(value)) return '—';
  return Math.round(value).toLocaleString('en-US');
}

export function render(engine, rows, currentScale, currentType){
  engine.create(rows, { type: currentType, scale: currentScale });

  const theme = document.documentElement.getAttribute('data-theme');
  if (theme) themeManager.applyTheme(theme);

  const last = rows[rows.length-1];
  document.getElementById('k-close').textContent = formatPrice(last?.c);
  const highs = rows.map(r=>r.h).filter(Number.isFinite);
  const lows  = rows.map(r=>r.l).filter(Number.isFinite);
  document.getElementById('k-max').textContent = highs.length ? formatPrice(Math.max(...highs)) : '—';
  document.getElementById('k-min').textContent = lows.length  ? formatPrice(Math.min(...lows)) : '—';
}
