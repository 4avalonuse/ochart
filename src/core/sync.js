import { sanitizeLine } from './sanitizer.js';
import { fetchSeries } from './data-loader.js';
import { render } from './renderer.js';
import { pushLog } from '../ui/dev-hud.js';
import { OffsetWindow } from '../ui/offset-window.js';
import { setCurrentRows } from '../ui/controls.js';
import { showToast } from '../ui/toast.js';

let fullRows = [];
let ow = null;
let syncSequence = 0;
let activeRenderScale = 'logarithmic';
let activeRenderType = 'line';

export async function sync(engine, datasetId, currentScale, currentType, options = {}) {
  const forceRefresh = options?.forceRefresh === true;
  const sequence = ++syncSequence;
  activeRenderScale = currentScale;
  activeRenderType = currentType;
  document.getElementById('status').textContent = forceRefresh ? 'Atualizando...' : 'Carregando...';

  pushLog({
    level: 'info',
    msg: 'sync_start',
    ts: Date.now(),
    data: { datasetId, scale: currentScale, type: currentType, forceRefresh }
  });

  try {
    const payload = await fetchSeries(datasetId, { forceRefresh });
    if (sequence !== syncSequence) {
      pushLog({ level: 'info', msg: 'sync_stale_discard', ts: Date.now(), data: { datasetId } });
      return;
    }

    const data = Array.isArray(payload?.data) ? payload.data : [];
    const meta = payload?.meta || {};
    // Sanitização pertence aos dados, não à escala visual.
    // Valores incompatíveis com log são tratados pelo ChartEngine/viewport.
    const { data: rows, stats } = sanitizeLine(data);

    fullRows = rows;
    setCurrentRows(rows);

    if (stats) {
      pushLog({
        level: stats.droppedInvalid > 0 ? 'warn' : 'info',
        msg: 'sanitize_report',
        ts: Date.now(),
        data: { datasetId, ...stats }
      });
    }

    const max = Math.max(0, rows.length - 1);
    if (!ow) {
      ow = new OffsetWindow(document.getElementById('ow'), {
        max,
        finish: max,
        start: 0,
        onApply: ({ finish, start }) => {
          const sliced = sliceByOffsets(fullRows, finish, start);
          render(engine, sliced.data, activeRenderScale, activeRenderType);
          document.getElementById('status').textContent = `OK (janela: ${sliced.data.length})`;
        }
      });
    } else {
      ow.setMax(max);
      ow.setWindow({ finish: max, start: 0 });
    }

    const sliced = sliceByOffsets(rows, Math.max(0, rows.length - 1), 0);
    render(engine, sliced.data, currentScale, currentType);

    const last = rows[rows.length - 1];
    const updated = formatTimestamp(last?.t);
    const lastPrice = Number.isFinite(last?.c)
      ? last.c.toLocaleString('en-US', { maximumFractionDigits: 8 })
      : '—';

    const stale = meta.staleFallback === true;
    const stateLabel = stale ? 'CACHE (stale)' : 'OK';

    updateMarketHeader({ datasetId, meta, rows, last, updated, stale });

    document.getElementById('status').textContent = [
      stateLabel,
      meta.provider || 'provider?',
      meta.interval || 'interval?',
      `dataset: ${datasetId}`,
      `atualizado: ${updated}`,
      `candles: ${rows.length}`,
      `last: ${lastPrice}`
    ].join(' | ');

    pushLog({
      level: stale ? 'warn' : 'info',
      msg: stale ? 'sync_cache_fallback' : 'sync_ok',
      ts: Date.now(),
      data: {
        datasetId,
        provider: meta.provider || null,
        symbol: meta.symbol || null,
        interval: meta.interval || null,
        bars: rows.length,
        scale: currentScale,
        type: currentType,
        staleFallback: stale,
        updatedAt: meta.updatedAt || null,
        lastTimestamp: last?.t ?? null,
        lastClose: last?.c ?? null
      }
    });
  } catch (e) {
    console.error(e);
    document.getElementById('status').textContent = 'Falha';

    pushLog({
      level: 'error',
      msg: 'sync_fail',
      ts: Date.now(),
      data: { datasetId, error: String(e?.message || e), forceRefresh }
    });

    showToast(forceRefresh ? 'Não foi possível atualizar os dados.' : 'Não foi possível carregar os dados.', 'error', 4500);
  }
}

function updateMarketHeader({ datasetId, meta, rows, last, updated, stale }) {
  const datasetName = meta.name || datasetId || 'Mercado';
  const name = datasetName.split(' · ')[0] || datasetName;
  const symbol = meta.symbol || '—';
  const provider = meta.provider === 'binance-us' ? 'Binance.US' : meta.provider === 'yahoo' ? 'Yahoo Finance' : (meta.provider || '—');
  const interval = meta.interval || '—';
  const previous = rows.length > 1 ? rows[rows.length - 2]?.c : null;
  const change = Number.isFinite(last?.c) && Number.isFinite(previous) && previous !== 0
    ? ((last.c - previous) / previous) * 100
    : null;
  document.getElementById('market-name').textContent = name;
  document.getElementById('market-symbol').textContent = symbol;
  document.getElementById('market-provider').textContent = `Fonte · ${provider}${stale ? ' · cache' : ''}`;
  document.getElementById('market-interval').textContent = `Período · ${interval}`;
  document.getElementById('market-updated').textContent = `Atualizado · ${updated}`;
  document.getElementById('k-close').textContent = Number.isFinite(last?.c) ? last.c.toLocaleString('en-US', { maximumFractionDigits: 8 }) : '—';
  document.getElementById('k-change').textContent = change == null ? '—' : `${change >= 0 ? '+' : ''}${change.toFixed(2)}%`;
  document.getElementById('k-change').dataset.state = change == null ? 'neutral' : change >= 0 ? 'up' : 'down';
}

function formatTimestamp(value) {
  if (!Number.isFinite(value)) return '—';
  return new Date(value).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}

function sliceByOffsets(rows, finish, start) {
  const n = rows.length;
  if (!n) return { data: [], a: 0, b: 0, left: 0, right: 0 };

  const max = Math.max(0, n - 1);
  const F = Math.min(Math.max(0, finish | 0), max);
  const S = Math.min(Math.max(0, start | 0), max);
  const left = Math.max(F, S);
  const right = Math.min(F, S);
  const idxStart = (n - 1) - left;
  const idxEnd = (n - 1) - right;
  const a = Math.max(0, Math.min(idxStart, idxEnd));
  const b = Math.max(0, Math.max(idxStart, idxEnd));
  return { data: rows.slice(a, b + 1), a, b, left, right };
}
