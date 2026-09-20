/**
 * Cliente da Oraculum Data API.
 *
 * Regra arquitetural: este módulo é a única camada do OChart que conhece
 * as rotas HTTP da Data API. Provider e símbolo pertencem ao catálogo do backend.
 */
import { DATA_API_URL } from './api-config.js';

async function fetchJSON(url, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: { Accept: 'application/json', ...(options.headers || {}) },
    cache: 'no-store'
  });

  const text = await res.text();
  let json;
  try {
    json = text ? JSON.parse(text) : null;
  } catch (_) {
    throw new Error('Data API retornou JSON inválido');
  }

  if (!res.ok) {
    throw new Error((json && (json.error || json.message)) || `Data API HTTP ${res.status}`);
  }
  return json;
}

export async function fetchDatasets() {
  const json = await fetchJSON(`${DATA_API_URL}/api/datasets`);
  if (!json?.ok || !Array.isArray(json.data)) {
    throw new Error('Contrato do catálogo inválido');
  }
  return json.data;
}

export async function fetchDataset(datasetId) {
  if (!datasetId) throw new Error('datasetId ausente');
  const json = await fetchJSON(`${DATA_API_URL}/api/datasets/${encodeURIComponent(datasetId)}`);
  if (!json?.ok || !Array.isArray(json.data) || !json.meta?.datasetId) {
    throw new Error('Contrato do dataset inválido');
  }
  return json;
}

export async function refreshDataset(datasetId) {
  if (!datasetId) throw new Error('datasetId ausente');
  const json = await fetchJSON(
    `${DATA_API_URL}/api/datasets/${encodeURIComponent(datasetId)}/refresh`,
    { method: 'POST' }
  );
  if (!json?.ok || !Array.isArray(json.data) || !json.meta?.datasetId) {
    throw new Error('Contrato do refresh inválido');
  }
  return json;
}

export async function checkDataApiHealth() {
  const json = await fetchJSON(`${DATA_API_URL}/api/health`);
  if (json?.ok !== true) throw new Error('Contrato de health inválido');
  return json;
}
