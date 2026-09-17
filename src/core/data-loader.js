/**
 * Data Loader — acesso a dados.
 *
 * Fluxo: fonte atual → API pública → JSON estático → último cache local.
 * O loader não sanitiza: entrega o payload ao pipeline de normalização.
 *
 * "forceRefresh" existe para que a ação Atualizar realmente tente uma
 * nova leitura da fonte, em vez de aceitar silenciosamente um cache válido.
 */

import { fetchFromAPI } from './api-source.js';

const QS = new URLSearchParams(location.search);

const STATIC_MAP = {
  '1h':  './api/cache/BTC-USD_60m_3mo.json',
  '1d':  './api/cache/BTC-USD_1d_max.json',
  '1w':  './api/cache/BTC-USD_1wk_max.json',
  '1mo': './api/cache/BTC-USD_1mo_max.json'
};

const staticUrlFor = (tf) => QS.get('file') || STATIC_MAP[tf] || STATIC_MAP['1d'];
const cacheKey = (tf) => `ochart:lastPayload:BTC-USD:${tf}`;

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

  try {
    json = text ? JSON.parse(text) : null;
  } catch (_) {
    throw new Error(`JSON malformado em ${url}`);
  }

  if (!res.ok) {
    throw new Error(
      (json && (json.message || json.error)) || `HTTP ${res.status} em ${url}`
    );
  }

  if (!json || typeof json !== 'object') {
    throw new Error(`Payload vazio em ${url}`);
  }

  return { json, headers: res.headers };
}

async function fetchFromPHP(tf, scale, forceRefresh = false) {
  const interval = mapInterval(tf);
  const range = requestRange(tf);
  const pos = scale === 'logarithmic' ? '1' : '0';

  const params = new URLSearchParams({
    symbol: 'BTC-USD',
    interval,
    range,
    sanitized: '1',
    pos
  });

  if (forceRefresh) params.set('refresh', '1');

  const { json, headers } = await fetchJSON(`./api/yahoo.php?${params.toString()}`);
  const xCache = (headers.get('X-Cache') || 'API').toUpperCase();

  console.info(
    `%c${xCache}%c via Yahoo/PHP • tf=${tf}${forceRefresh ? ' • refresh=1' : ''}`,
    'background:#2563eb;color:#fff;padding:2px 6px;border-radius:4px',
    'color:inherit'
  );

  json.meta = { ...(json.meta || {}), source: 'php', forcedRefresh: forceRefresh };
  return json;
}

async function fetchFromStatic(tf) {
  const url = staticUrlFor(tf);
  const { json } = await fetchJSON(url);

  console.info(
    `%cSTATIC%c ${url}`,
    'background:#16a34a;color:#fff;padding:2px 6px;border-radius:4px',
    'color:inherit'
  );

  json.meta = { ...(json.meta || {}), source: 'static' };
  return json;
}

/**
 * @param {string} tf - timeframe (1h, 1d, 1w, 1mo)
 * @param {string} scale - linear | logarithmic
 * @param {{forceRefresh?: boolean}} options
 */
export async function fetchSeries(tf = '1d', scale = 'logarithmic', options = {}) {
  const forceRefresh = options?.forceRefresh === true;
  const errors = [];

  // 1. Fonte principal: Yahoo através do PHP proxy.
  try {
    const payload = await fetchFromPHP(tf, scale, forceRefresh);
    saveCache(tf, payload);
    return payload;
  } catch (e) {
    errors.push(e);
    console.warn('Yahoo/PHP indisponível. Tentando API pública...', e.message);
  }

  // 2. Fonte intermediária: API pública.
  try {
    const payload = await fetchFromAPI(tf);
    saveCache(tf, payload);
    return payload;
  } catch (e) {
    errors.push(e);
    console.warn('API pública indisponível. Tentando JSON estático...', e.message);
  }

  // 3. Fallback histórico: JSON estático.
  try {
    const payload = await fetchFromStatic(tf);
    saveCache(tf, payload);
    return payload;
  } catch (e) {
    errors.push(e);
    console.warn('JSON estático indisponível. Tentando cache local...', e.message);
  }

  // 4. Último recurso: último sucesso local.
  const cached = readCache(tf);
  if (cached && Array.isArray(cached.data) && cached.data.length) {
    console.warn('Usando cache local (último sucesso).');
    cached.meta = {
      ...(cached.meta || {}),
      source: 'cache',
      staleFallback: true
    };
    return cached;
  }

  const msg =
    'Não foi possível carregar dados (Yahoo/PHP, API pública, estático ou cache local).\n' +
    errors.map((e, i) => `[${i + 1}] ${e.message}`).join('\n');

  throw new Error(msg);
}

function mapInterval(tf) {
  if (tf === '1h') return '60m';
  if (tf === '1w') return '1wk';
  return tf;
}

function requestRange(tf) {
  if (tf === '1h') return '3mo';
  return 'max';
}
