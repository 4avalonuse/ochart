// src/app.js
// ============================================================
// Ponto de entrada do Ochart
// Responsável apenas por inicializar engine, HUD, tema,
// ferramentas de desenho, controles e sync inicial
// ============================================================

import { ChartEngine } from './core/chart-engine.js';
import { mountHUD } from './ui/dev-hud.js';
import { DrawingTools } from './ui/drawing-tools.js';
import { TableModal } from './ui/table-modal.js';
import { themeManager } from './ui/theme-manager.js';
import { setupControls } from './ui/controls.js';
import { sync } from './core/sync.js';

// Atalho rápido para seletores
const $ = (sel) => document.querySelector(sel);

let engine = null;
let drawingTools = null;
const tableModal = new TableModal();

// HUD
mountHUD(document.getElementById('dev-hud-root'));

// Boot
function boot() {
  // Engine principal
  engine = new ChartEngine($('#ch'), { bundlesEndpoint: './api/bundles.php' });

  // Ferramentas de desenho
  drawingTools = new DrawingTools(engine);
  drawingTools.init();
  const shell = document.querySelector('.chart-shell');
  const tb = document.getElementById('drawing-toolbar');
  if (shell && tb && tb.parentElement !== shell) {
    shell.appendChild(tb);
  }

  // Tema inicial
  themeManager.init(engine);

  // Controles (binds de UI)
  setupControls(engine, tableModal);

  // Primeira sync (default: 1d, log, line)
  sync(engine, '1d', 'logarithmic', 'line');
}

// Executa boot
boot();
