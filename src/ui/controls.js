import { sync } from '../core/sync.js';
import { fetchDatasets } from '../core/api-source.js';
import { themeManager } from './theme-manager.js';
import { pushLog } from './dev-hud.js';
import { findSiblingDataset } from '../core/dataset-utils.js';
import { showToast } from './toast.js';

let currentScale = 'logarithmic';
let currentType = 'line';
let currentRows = [];
let datasets = [];
let currentDatasetId = null;

function providerLabel(provider) {
  return provider === 'binance-us' ? 'Binance.US' : provider === 'yahoo' ? 'Yahoo Finance' : provider;
}

function populateProviders(select) {
  select.replaceChildren();
  const providers = [...new Set(datasets.map(d => d.provider))];
  for (const provider of providers) {
    const option = document.createElement('option');
    option.value = provider;
    option.textContent = providerLabel(provider);
    select.appendChild(option);
  }
}

function populateTimeframes(currentInterval) {
  document.querySelectorAll('#tf-buttons button[data-interval]').forEach(button => {
    const active = button.dataset.interval === currentInterval;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  });
}

export async function setupControls(engine, tableModal) {
  const providerSelect = document.getElementById('sel-provider');

  function selectDataset(id) {
    const dataset = datasets.find(d => d.id === id);
    if (!dataset) return;

    currentDatasetId = dataset.id;
    providerSelect.value = dataset.provider;
    populateTimeframes(dataset.interval);

    pushLog({
      level: 'info',
      msg: 'dataset_change',
      ts: Date.now(),
      data: {
        datasetId: dataset.id,
        provider: dataset.provider,
        symbol: dataset.symbol,
        interval: dataset.interval
      }
    });

    void sync(engine, currentDatasetId, currentScale, currentType);
  }

  function selectProvider(provider) {
    const current = datasets.find(d => d.id === currentDatasetId);
    const match = datasets.find(d =>
      d.provider === provider &&
      (!current ||
        (d.kind === current.kind &&
         d.currency === current.currency &&
         d.interval === current.interval))
    );

    if (match) {
      selectDataset(match.id);
    } else {
      pushLog({
        level: 'warn',
        msg: 'provider_unavailable',
        ts: Date.now(),
        data: { provider, interval: current?.interval || null }
      });
    }
  }

  function selectInterval(interval) {
    const current = datasets.find(d => d.id === currentDatasetId);
    if (!current) return;

    const match = findSiblingDataset(datasets, current, interval);

    if (match) {
      selectDataset(match.id);
      return;
    }

    pushLog({
      level: 'warn',
      msg: 'dataset_interval_unavailable',
      ts: Date.now(),
      data: { datasetId: currentDatasetId, requestedInterval: interval }
    });
  }

  function setScale(scale) {
    currentScale = scale === 'linear' ? 'linear' : 'logarithmic';
    document.getElementById('btn-scale-linear').classList.toggle('active', currentScale === 'linear');
    document.getElementById('btn-scale-log').classList.toggle('active', currentScale === 'logarithmic');
    engine?.setScale(currentScale);
    pushLog({ level: 'info', msg: 'scale_change', ts: Date.now(), data: { scale: currentScale } });
  }

  function setType(type) {
    currentType = type === 'candlestick' ? 'candlestick' : 'line';
    document.getElementById('btn-type-line').classList.toggle('active', currentType === 'line');
    document.getElementById('btn-type-candle').classList.toggle('active', currentType === 'candlestick');
    engine?.setType(currentType);
    pushLog({ level: 'info', msg: 'chart_type_change', ts: Date.now(), data: { type: currentType } });
  }

  document.getElementById('btn-scale-linear').addEventListener('click', () => setScale('linear'));
  document.getElementById('btn-scale-log').addEventListener('click', () => setScale('logarithmic'));
  document.getElementById('btn-type-line').addEventListener('click', () => setType('line'));
  document.getElementById('btn-type-candle').addEventListener('click', () => setType('candlestick'));

  document.getElementById('btn-sync').addEventListener('click', () => {
    void sync(engine, currentDatasetId, currentScale, currentType, { forceRefresh: true });
  });

  providerSelect.addEventListener('change', e => selectProvider(e.target.value));

  document.querySelectorAll('#tf-buttons button[data-interval]').forEach(button => {
    button.addEventListener('click', () => selectInterval(button.dataset.interval));
  });

  document.getElementById('btn-table').addEventListener('click', () => {
    tableModal.show(currentRows);
    tableModal.el.querySelector('#tm-export').onclick = () => tableModal.exportCSV();
  });

  document.getElementById('btn-theme').addEventListener('click', () => themeManager.toggleTheme());

  document.getElementById('status').textContent = 'Catálogo...';

  try {
    datasets = await fetchDatasets();
    populateProviders(providerSelect);

    const preferred = datasets.find(d => d.id === 'btc-usd-yahoo-1d') || datasets[0];
    if (!preferred) throw new Error('Catálogo de datasets vazio');

    selectDataset(preferred.id);
  } catch (e) {
    document.getElementById('status').textContent = 'Falha no catálogo';
    pushLog({
      level: 'error',
      msg: 'dataset_catalog_fail',
      ts: Date.now(),
      data: { error: String(e?.message || e) }
    });
    showToast('Não foi possível carregar o catálogo.', 'error', 4500);
  }
}

export function setCurrentRows(rows) {
  currentRows = Array.isArray(rows) ? rows : [];
}
