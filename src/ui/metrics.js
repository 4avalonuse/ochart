/** Atualiza métricas simples exibidas abaixo/acima do gráfico. */
function formatPrice(value) {
  if (!Number.isFinite(value)) return '—';
  return Math.round(value).toLocaleString('en-US');
}

export function renderMetrics(rows) {
  const last = rows?.[rows.length - 1];
  const highs = (rows || []).map(r => r.h).filter(Number.isFinite);
  const lows = (rows || []).map(r => r.l).filter(Number.isFinite);

  const close = document.getElementById('k-close');
  const max = document.getElementById('k-max');
  const min = document.getElementById('k-min');

  if (close) close.textContent = formatPrice(last?.c ?? last?.close);
  if (max) max.textContent = highs.length ? formatPrice(Math.max(...highs)) : '—';
  if (min) min.textContent = lows.length ? formatPrice(Math.min(...lows)) : '—';
}
