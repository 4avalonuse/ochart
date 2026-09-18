/**
 * Data Loader — acesso aos datasets do Oraculum.
 *
 * Fluxo primário:
 *   Oraculum Data API → dataset normalizado
 *
 * Enquanto o backend não está configurado:
 *   JSON estático → cache local
 *
 * Yahoo direto e PHP antigo ficam fora do fluxo principal e serão removidos
 * depois que o novo backend estiver validado.
 */

import { fetchDataset, isDataApiConfigured } from './data-api.js';

const QS = new URLSearchParams(location.search);

const STATIC_MAP = {
  '1h': './api/cache/BTC-USD_60m_3mo.json',
  '1d': './api/cache/BTC-USD_1d_max.json',
  '1w': './api/cache/BTC-USD_1wk_max.json',
  '1mo': './api/cache/BTC-USD_1mo_max.json'
};

const staticUrlFor = tf => QS.get('file') || STATIC_MAP[tf] || STATIC_MAP['1d'];
const cacheKey = tf => `ochart:lastPayload:BTC-USD:${tf}`;

function saveCache(tf, payload) {
  try { localStorage.setItem(cacheKey(tf), JSON.stringify(payload)); } catch (_) {}
}

function readCache(tf) {
  try {
    const raw = localStorage.getItem(cacheKey(tf));
    return raw ? JSON.parse(raw) : null;
  } catch (_) {
    return null;
  }
}

async function fetchJSON(url) {
  const res = await fetch(url, {
    headers: { 'Accept': 'application/json' },
    cache: 'no-store'
  });

  const text = await res.text();
  let json;

  try { json = text ? JSON.parse(text) : null; }
  catch (_) { throw new Error(`JSON malformado em ${url}`); }

  if (!res.ok) {
    throw new Error(
      (json && (json.message || json.error)) || `HTTP ${res.status} em ${url}`
    );
  }

  if (!json || typeof json !== 'object') {
    throw new Error(`Payload vazio em ${url}`);
  }

  return json;
}

async function fetchFromStatic(tf) {
  const url = staticUrlFor(tf);
  const json = await fetchJSON(url);
  json.meta = { ...(json.meta || {}), source: 'static' };
  return json;
}

export async function fetchSeries(tf = '1d', scale = 'logarithmic', options = {}) {
  const forceRefresh = options?.forceRefresh === true;
  const errors = [];

  if (isDataApiConfigured()) {
    try {
      const datasetId = `btc-usd-${tf}`;
      const payload = await fetchDataset(datasetId, { forceRefresh });
      payload.meta = {
        ...(payload.meta || {}),
        source: 'oraculum-api',
        forcedRefresh: forceRefresh,
        scale
      };
      saveCache(tf, payload);
      return payload;
    } catch (e) {
      errors.push(e);
      window.__HUD__?.pushLog?.({
        level: 'warn',
        msg: 'data_api_fetch_fail',
        ts: Date.now(),
        data: { tf, error: String(e?.message || e) }
      });
    }
  }

  try {
    const payload = await fetchFromStatic(tf);
    saveCache(tf, payload);
    return payload;
  } catch (e) {
    errors.push(e);
  }

  const cached = readCache(tf);

  if (cached && Array.isArray(cached.data) && cached.data.length) {
    cached.meta = {
      ...(cached.meta || {}),
      source: 'cache',
      staleFallback: true
    };
    return cached;
  }

  const msg =
    'Não foi possível carregar o dataset do Oraculum.\n' +
    errors.map((e, i) => `[${i + 1}] ${e.message}`).join('\n');

  throw new Error(msg);
}
