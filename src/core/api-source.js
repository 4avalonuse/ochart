import { DATA_API_URL } from './api-config.js';

async function fetchJSON(url, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: { Accept: 'application/json', ...(options.headers || {}) },
    cache: 'no-store'
  });

  const text = await res.text();
  let json;
  try { json = text ? JSON.parse(text) : null; }
  catch (_) { throw new Error('Data API retornou JSON inválido'); }

  if (!res.ok) {
    throw new Error((json && (json.error || json.message)) || `Data API HTTP ${res.status}`);
  }
  return json;
}

export async function fetchDatasets() {
  const json = await fetchJSON(`${DATA_API_URL}/api/datasets`);
  if (!json?.ok || !Array.isArray(json.datasets)) throw new Error('Catálogo de datasets inválido');
  return json.datasets;
}

export async function fetchDataset(datasetId) {
  if (!datasetId) throw new Error('datasetId ausente');
  const json = await fetchJSON(`${DATA_API_URL}/api/datasets/${encodeURIComponent(datasetId)}`);
  if (!json?.ok || !Array.isArray(json.data)) throw new Error('Dataset retornou dados inválidos');
  return json;
}

export async function refreshDataset(datasetId) {
  if (!datasetId) throw new Error('datasetId ausente');
  const json = await fetchJSON(`${DATA_API_URL}/api/datasets/${encodeURIComponent(datasetId)}/refresh`, { method: 'POST' });
  if (!json?.ok || !Array.isArray(json.data)) throw new Error('Refresh retornou dados inválidos');
  return json;
}

export async function checkDataApiHealth() {
  return fetchJSON(`${DATA_API_URL}/api/health`);
}
