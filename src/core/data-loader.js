/**
 * Data Loader — única porta de entrada de dados do OChart.
 * Fluxo: Cloudflare Data API → cache local de último sucesso.
 */

import { fetchDataset, refreshDataset } from './api-source.js';

const cacheKey = (datasetId) => `ochart:lastPayload:${datasetId}`;

function saveCache(datasetId, payload) {
  try { localStorage.setItem(cacheKey(datasetId), JSON.stringify(payload)); } catch (_) {}
}

function readCache(datasetId) {
  try {
    const raw = localStorage.getItem(cacheKey(datasetId));
    return raw ? JSON.parse(raw) : null;
  } catch (_) { return null; }
}

export async function fetchSeries(datasetId, options = {}) {
  const forceRefresh = options?.forceRefresh === true;
  try {
    const payload = forceRefresh
      ? await refreshDataset(datasetId)
      : await fetchDataset(datasetId);
    saveCache(datasetId, payload);
    return payload;
  } catch (error) {
    const cached = readCache(datasetId);
    if (cached?.data?.length) {
      cached.meta = { ...(cached.meta || {}), source: 'cache', staleFallback: true };
      return cached;
    }
    throw error;
  }
}
