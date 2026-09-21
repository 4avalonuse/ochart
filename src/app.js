// Ponto de entrada do OChart.
// Responsabilidade: montar os módulos e iniciar a aplicação.
import { ChartEngine } from './core/chart-engine.js';
import { applyVersionUI } from './core/version.js';
import { checkDataApi } from './core/api-health.js';
import { mountHUD } from './ui/dev-hud.js';
import { DrawingTools } from './ui/drawing-tools.js';
import { TableModal } from './ui/table-modal.js';
import { themeManager } from './ui/theme-manager.js';
import { setupControls } from './ui/controls.js';

const $ = selector => document.querySelector(selector);

function boot() {
  applyVersionUI();
  mountHUD(document.getElementById('dev-hud-root'));

  const engine = new ChartEngine($('#ch'));
  const drawingTools = new DrawingTools(engine);
  drawingTools.init();

  const shell = document.querySelector('.chart-shell');
  const toolbar = document.getElementById('drawing-toolbar');
  if (shell && toolbar && toolbar.parentElement !== shell) shell.appendChild(toolbar);

  themeManager.init(engine);
  setupControls(engine, new TableModal());

  // Controles compactos para celular.
  document.getElementById('chart-zoom-out')?.addEventListener('click', () => engine.zoom.zoomBy(1.25));
  document.getElementById('chart-zoom-in')?.addEventListener('click', () => engine.zoom.zoomBy(0.8));
  document.getElementById('chart-zoom-fit')?.addEventListener('click', () => engine.resetZoom());

  // Modo foco: página simples -> gráfico ampliado com todas as opções.
  const focusBtn = document.getElementById('chart-open-focus');
  const toolsBtn = document.getElementById('chart-open-tools');
  const chartMain = document.querySelector('.chart-main');

  const setFocus = open => {
    document.body.classList.toggle('chart-focus', open);
    if (!open) document.body.classList.remove('chart-tools-open');
    requestAnimationFrame(() => engine.chart?.resize());
  };

  focusBtn?.addEventListener('click', () => setFocus(true));
  toolsBtn?.addEventListener('click', () => {
    if (!document.body.classList.contains('chart-focus')) setFocus(true);
    document.body.classList.toggle('chart-tools-open');
  });

  chartMain?.addEventListener('dblclick', () => {
    setFocus(!document.body.classList.contains('chart-focus'));
  });

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') setFocus(false);
  });

  // Verifica o backend sem bloquear a inicialização do gráfico.
  checkDataApi();
}

boot();
