import { DATA_API_URL } from './api-config.js';

export function isDataApiConfigured() {
  return Boolean(DATA_API_URL);
}

export async function fetchDataset(datasetId = 'btc-usd', options = {}) {
  if (!DATA_API_URL) {
    throw new Error('Oraculum Data API não configurada');
  }

  const url = new URL('/api/datasets/' + encodeURIComponent(datasetId), DATA_API_URL);
  if (options?.forceRefresh) url.searchParams.set('refresh', '1');

  const response = await fetch(url, {
    headers: { 'Accept': 'application/json' },
    cache: 'no-store'
  });

  const text = await response.text();
  let json = null;

  try {
    json = text ? JSON.parse(text) : null;
  } catch (_) {
    throw new Error('Data API retornou JSON inválido');
  }

  if (!response.ok) {
    throw new Error(
      (json && (json.message || json.error)) || `Data API HTTP ${response.status}`
    );
  }

  if (!json?.data || !Array.isArray(json.data)) {
    throw new Error('Data API retornou dataset inválido');
  }

  return json;
}
