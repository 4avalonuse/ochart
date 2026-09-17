/**
 * Data Loader — acesso a dados.
 *
 * Fluxo: Yahoo direto (teste CORS) → Yahoo/PHP → API pública → JSON estático → último cache local.
 * O loader não sanitiza: entrega o payload ao pipeline de normalização.
 *
 * O acesso direto ao Yahoo é um teste experimental de CORS; em caso de bloqueio, o PHP continua como proxy.\n *\n * "forceRefresh" existe para que a ação Atualizar realmente tente uma
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

async function fetchFromYahooDirect(tf, scale) {
  const interval = mapInterval(tf);
  const range = requestRange(tf);
  const url = new URL('https://query1.finance.yahoo.com/v8/finance/chart/BTC-USD');
  url.searchParams.set('interval', interval);
  url.searchParams.set('range', range);

  try {
    const { json } = await fetchJSON(url.toString());

    const result = json?.chart?.result?.[0];
    const timestamps = result?.timestamp || [];
    const quote = result?.indicators?.quote?.[0];

    if (!timestamps.length || !quote) {
      throw new Error('Yahoo direto retornou payload sem candles');
    }

    const data = timestamps.map((t, i) => ({
      t: Number(t) * 1000,
      o: Number(quote.open?.[i]),
      h: Number(quote.high?.[i]),
      l: Number(quote.low?.[i]),
      c: Number(quote.close?.[i]),
      v: Number(quote.volume?.[i])
    }));

    const payload = {
      data,
      meta: {
        source: 'yahoo-direct',
        provider: 'yahoo',
        symbol: 'BTC-USD',
        interval,
        range,
        scale,
        fetchedAt: Date.now()
      }
    };

    window.__HUD__?.pushLog?.({
      level: 'info',
      msg: 'yahoo_direct_ok',
      ts: Date.now(),
      data: { interval, range, bars: data.length }
    });

    return payload;
  } catch (e) {
    window.__HUD__?.pushLog?.({
      level: 'warn',
      msg: 'yahoo_direct_fail',
      ts: Date.now(),
      data: {
        interval,
        range,
        error: String(e?.message || e),
        likelyCors: e instanceof TypeError
      }
    });
    throw e;
  }
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

  // 1. Teste direto: Yahoo pelo JavaScript do navegador.
  try {
    const payload = await fetchFromYahooDirect(tf, scale);
    saveCache(tf, payload);
    return payload;
  } catch (e) {
    errors.push(e);
    console.warn('Yahoo direto indisponível (possível CORS). Tentando PHP...', e.message);
  }

  // 2. Fonte principal de produção: Yahoo através do PHP proxy.
  try {
    const payload = await fetchFromPHP(tf, scale, forceRefresh);
    saveCache(tf, payload);
    return payload;
  } catch (e) {
    errors.push(e);
    console.warn('Yahoo/PHP indisponível. Tentando API pública...', e.message);
  }

  // 3. Fonte intermediária: API pública.
  try {
    const payload = await fetchFromAPI(tf);
    saveCache(tf, payload);
    return payload;
  } catch (e) {
    errors.push(e);
    console.warn('API pública indisponível. Tentando JSON estático...', e.message);
  }

  // 4. Fallback histórico: JSON estático.
  try {
    const payload = await fetchFromStatic(tf);
    saveCache(tf, payload);
    return payload;
  } catch (e) {
    errors.push(e);
    console.warn('JSON estático indisponível. Tentando cache local...', e.message);
  }

  // 5. Último recurso: último sucesso local.
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
