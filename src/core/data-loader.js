/**
 * Data Loader — única porta de entrada de dados do OChart.
 *
 * Fluxo normal: Data API → cache local do último sucesso.
 * O cache é somente fallback: nunca é consultado antes da API.
 */
import { fetchDataset, refreshDataset } from './api-source.js';
import { pushLog } from '../ui/dev-hud.js';

const cacheKey = datasetId => `ochart:lastPayload:${datasetId}`;

function saveCache(datasetId, payload) {
  try {
    localStorage.setItem(cacheKey(datasetId), JSON.stringify(payload));
  } catch (_) {
    // Cache é opcional; falha de armazenamento não pode quebrar o gráfico.
  }
}

function readCache(datasetId) {
  try {
    const raw = localStorage.getItem(cacheKey(datasetId));
    return raw ? JSON.parse(raw) : null;
  } catch (_) {
    return null;
  }
}

export async function fetchSeries(datasetId, options = {}) {
  if (!datasetId) throw new Error('datasetId ausente');

  const forceRefresh = options?.forceRefresh === true;
  const operation = forceRefresh ? 'dataset_refresh' : 'dataset_read';

  pushLog({
    level: 'info',
    msg: `${operation}_start`,
    ts: Date.now(),
    data: { datasetId }
  });

  try {
    const payload = forceRefresh
      ? await refreshDataset(datasetId)
      : await fetchDataset(datasetId);

    saveCache(datasetId, payload);

    pushLog({
      level: 'info',
      msg: `${operation}_ok`,
      ts: Date.now(),
      data: {
        datasetId,
        bars: payload.data.length,
        provider: payload.meta?.provider,
        interval: payload.meta?.interval
      }
    });

    return payload;
  } catch (error) {
    const cached = readCache(datasetId);

    if (cached?.data?.length) {
      const fallback = {
        ...cached,
        meta: {
          ...(cached.meta || {}),
          source: 'cache',
          staleFallback: true
        }
      };

      pushLog({
        level: 'warn',
        msg: 'dataset_cache_fallback',
        ts: Date.now(),
        data: {
          datasetId,
          requestedOperation: operation,
          error: String(error?.message || error)
        }
      });

      return fallback;
    }

    pushLog({
      level: 'error',
      msg: `${operation}_fail`,
      ts: Date.now(),
      data: { datasetId, error: String(error?.message || error) }
    });

    throw error;
  }
}
