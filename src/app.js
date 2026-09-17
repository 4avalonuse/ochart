// Ponto de entrada do OChart.
// Responsabilidade: montar os módulos e iniciar a aplicação.
import { ChartEngine } from './core/chart-engine.js';
import { applyVersionUI } from './core/version.js';
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
}

boot();
