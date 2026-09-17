/**
 * Public API source — fonte intermediária do OChart.
 *
 * Usa Binance Spot para obter candles públicos de BTC/USDT.
 * Converte a resposta para o formato interno do OChart: {t,o,h,l,c,v}.
 */

const API_URL = 'https://api.binance.com/api/v3/klines';
const SYMBOL = 'BTCUSDT';

function mapInterval(tf) {
  if (tf === '1h') return '1h';
  if (tf === '1w') return '1w';
  if (tf === '1mo') return '1M';
  return '1d';
}

export async function fetchFromAPI(tf = '1d') {
  const interval = mapInterval(tf);
  const url = new URL(API_URL);
  url.searchParams.set('symbol', SYMBOL);
  url.searchParams.set('interval', interval);
  url.searchParams.set('limit', '1000');

  const res = await fetch(url.toString(), {
    headers: { 'Accept': 'application/json' },
    cache: 'no-store'
  });

  const text = await res.text();
  let raw;

  try {
    raw = text ? JSON.parse(text) : null;
  } catch (_) {
    throw new Error('API pública retornou JSON inválido');
  }

  if (!res.ok) {
    throw new Error(
      (raw && (raw.msg || raw.message)) || `API pública HTTP ${res.status}`
    );
  }

  if (!Array.isArray(raw) || !raw.length) {
    throw new Error('API pública retornou zero candles');
  }

  const data = raw.map(row => ({
    t: Number(row[0]),
    o: Number(row[1]),
    h: Number(row[2]),
    l: Number(row[3]),
    c: Number(row[4]),
    v: Number(row[5])
  }));

  return {
    data,
    meta: {
      source: 'api',
      provider: 'binance',
      symbol: SYMBOL,
      interval,
      fetchedAt: Date.now()
    }
  };
}
