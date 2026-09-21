import { sync } from '../core/sync.js';
import { fetchDatasets } from '../core/api-source.js';
import { themeManager } from './theme-manager.js';
import { pushLog } from './dev-hud.js';
import { findSiblingDataset, intervalToTf, tfToInterval } from '../core/dataset-utils.js';

let currentScale = 'logarithmic';
let currentType = 'line';
let currentRows = [];
let datasets = [];
let currentDatasetId = null;

function datasetLabel(d) {
  return d.name || d.id;
}

function populateDatasets(select) {
  select.replaceChildren();
  for (const d of datasets) {
    const option = document.createElement('option');
    option.value = d.id;
    option.textContent = datasetLabel(d);
    select.appendChild(option);
  }
}

export async function setupControls(engine, tableModal) {
  const datasetSelect = document.getElementById('sel-dataset');
  const tfSelect = document.getElementById('sel-tf');

  function selectDataset(id) {
    const dataset = datasets.find(d => d.id === id);
    if (!dataset) return;

    currentDatasetId = dataset.id;
    tfSelect.value = intervalToTf(dataset.interval);

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

  datasetSelect.addEventListener('change', e => selectDataset(e.target.value));

  tfSelect.addEventListener('change', e => {
    const interval = tfToInterval(e.target.value);
    const current = datasets.find(d => d.id === currentDatasetId);
    const match = current ? findSiblingDataset(datasets, current, interval) : null;

    if (match) {
      selectDataset(match.id);
    } else {
      pushLog({
        level: 'warn',
        msg: 'dataset_interval_unavailable',
        ts: Date.now(),
        data: { datasetId: currentDatasetId, requestedInterval: interval }
      });
      tfSelect.value = current ? intervalToTf(current.interval) : '1d';
    }
  });

  document.getElementById('btn-table').addEventListener('click', () => {
    tableModal.show(currentRows);
    tableModal.el.querySelector('#tm-export').onclick = () => tableModal.exportCSV();
  });

  document.getElementById('btn-theme').addEventListener('click', () => themeManager.toggleTheme());

  document.getElementById('status').textContent = 'Catálogo...';

  try {
    datasets = await fetchDatasets();
    populateDatasets(datasetSelect);

    const preferred = datasets.find(d => d.id === 'btc-usd-yahoo-1d') || datasets[0];
    if (!preferred) throw new Error('Catálogo de datasets vazio');

    datasetSelect.value = preferred.id;
    selectDataset(preferred.id);
  } catch (e) {
    document.getElementById('status').textContent = 'Falha no catálogo';
    pushLog({
      level: 'error',
      msg: 'dataset_catalog_fail',
      ts: Date.now(),
      data: { error: String(e?.message || e) }
    });
    alert('Erro ao carregar catálogo: ' + e.message);
  }
}

export function setCurrentRows(rows) {
  currentRows = Array.isArray(rows) ? rows : [];
}
