import { sync } from '../core/sync.js';
import { themeManager } from './theme-manager.js';
import { pushLog } from './dev-hud.js';

let currentScale = 'logarithmic';
let currentType  = 'line';
let currentRows  = [];

export function setupControls(engine, tableModal){
  function setScale(scale){
    currentScale = (scale === 'linear') ? 'linear' : 'logarithmic';
    document.getElementById('btn-scale-linear').classList.toggle('active', currentScale === 'linear');
    document.getElementById('btn-scale-log').classList.toggle('active', currentScale === 'logarithmic');
    if (engine) engine.setScale(currentScale);
    pushLog({ level:'info', msg:'scale_change', ts:Date.now(), data:{ scale:currentScale }});
    document.getElementById('status').textContent =
      `OK (${currentScale === 'logarithmic' ? 'Log' : 'Linear'})`;
  }

  function setType(type){
    currentType = (type === 'candlestick') ? 'candlestick' : 'line';
    document.getElementById('btn-type-line').classList.toggle('active', currentType === 'line');
    document.getElementById('btn-type-candle').classList.toggle('active', currentType === 'candlestick');
    if (engine) engine.setType(currentType);
    pushLog({ level:'info', msg:'chart_type_change', ts:Date.now(), data:{ type:currentType }});
    document.getElementById('status').textContent =
      `OK (${currentType === 'candlestick' ? 'Candle' : 'Line'})`;
  }

  document.getElementById('btn-scale-linear').addEventListener('click', ()=> setScale('linear'));
  document.getElementById('btn-scale-log').addEventListener('click', ()=> setScale('logarithmic'));
  document.getElementById('btn-type-line').addEventListener('click', ()=> setType('line'));
  document.getElementById('btn-type-candle').addEventListener('click', ()=> setType('candlestick'));

  // Atualização manual: força uma nova leitura da fonte antes de usar cache.
  document.getElementById('btn-sync').addEventListener('click', () =>
    sync(engine, document.getElementById('sel-tf').value, currentScale, currentType, {
      forceRefresh: true
    })
  );

  document.getElementById('sel-tf').addEventListener('change', (e) =>
    sync(engine, e.target.value, currentScale, currentType)
  );

  document.getElementById('btn-table').addEventListener('click', ()=> {
    tableModal.show(currentRows);
    tableModal.el.querySelector('#tm-export').onclick = () => tableModal.exportCSV();
  });

  document.getElementById('btn-theme').addEventListener('click', ()=> themeManager.toggleTheme());

  // Primeira carga: segue a política normal de cache/fonte.
  sync(engine, document.getElementById('sel-tf').value, currentScale, currentType);
}

// Mantido temporariamente para compatibilidade com o fluxo atual.
// Será removido quando o estado dos datasets deixar de ser responsabilidade da UI.
export function setCurrentRows(rows) {
  currentRows = Array.isArray(rows) ? rows : [];
}
