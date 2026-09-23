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

  // FIT duplo: toque curto enquadra só o período visível; pressão longa
  // volta ao histórico completo. Mantemos um único botão para não poluir o celular.
  const fitBtn = document.getElementById('chart-zoom-fit');
  let fitPressTimer = null;
  let ignoreNextFitClick = false;

  const clearFitTimer = () => {
    if (fitPressTimer) {
      clearTimeout(fitPressTimer);
      fitPressTimer = null;
    }
  };

  fitBtn?.addEventListener('pointerdown', event => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    ignoreNextFitClick = false;
    clearFitTimer();
    fitPressTimer = setTimeout(() => {
      fitPressTimer = null;
      ignoreNextFitClick = true;
      engine.resetZoom();
    }, 550);
  });

  fitBtn?.addEventListener('pointerup', event => {
    clearFitTimer();
    if (!ignoreNextFitClick) {
      ignoreNextFitClick = true;
      engine.zoom.fitVisiblePriceScale();
    }
  });

  fitBtn?.addEventListener('pointercancel', clearFitTimer);
  fitBtn?.addEventListener('pointerleave', event => {
    if (event.pointerType === 'mouse') clearFitTimer();
  });
  fitBtn?.addEventListener('contextmenu', event => event.preventDefault());

  fitBtn?.addEventListener('click', event => {
    if (ignoreNextFitClick) {
      ignoreNextFitClick = false;
      return;
    }
    // Acessibilidade: teclado continua usando o toque curto.
    engine.zoom.fitVisiblePriceScale();
  });

  // Interface de pesquisa: gaveta independente do modo tela cheia.
  const focusBtn = document.getElementById('chart-open-focus');
  const toolsBtn = document.getElementById('chart-open-tools');
  const drawer = document.getElementById('research-drawer');
  const drawerClose = document.getElementById('drawer-close');
  const chartMain = document.querySelector('.chart-main');

  const setFocus = open => {
    document.body.classList.toggle('chart-focus', open);
    requestAnimationFrame(() => engine.chart?.resize());
  };

  const setDrawer = (open, panel = 'market') => {
    drawer?.classList.toggle('open', open);
    drawer?.setAttribute('aria-hidden', String(!open));
    document.body.classList.toggle('drawer-open', open);
    if (open) selectPanel(panel);
    requestAnimationFrame(() => engine.chart?.resize());
  };

  const selectPanel = panel => {
    document.querySelectorAll('.research-nav-item').forEach(button => {
      button.classList.toggle('active', button.dataset.panel === panel);
    });
    document.querySelectorAll('[data-drawer-panel]').forEach(section => {
      section.hidden = section.dataset.drawerPanel !== panel;
    });
    const title = document.getElementById('drawer-title');
    if (title) title.textContent = panel === 'studies' ? 'Estudos' : panel === 'data' ? 'Dados' : panel === 'tools' ? 'Ferramentas' : 'Mercado';
  };

  focusBtn?.addEventListener('click', () => setFocus(!document.body.classList.contains('chart-focus')));
  toolsBtn?.addEventListener('click', () => setDrawer(true, 'tools'));
  drawerClose?.addEventListener('click', () => setDrawer(false));

  document.querySelectorAll('.research-nav-item').forEach(button => {
    button.addEventListener('click', () => {
      const panel = button.dataset.panel;
      setDrawer(true, panel);
    });
  });

  document.querySelectorAll('[data-coming]').forEach(button => {
    button.addEventListener('click', () => {
      const name = button.dataset.coming;
      const event = new CustomEvent('ochart:toast', { detail: { message: name + ' será incorporado à camada de Estudos.', type: 'info' } });
      document.dispatchEvent(event);
    });
  });

  document.getElementById('open-diagnostics')?.addEventListener('click', () => {
    const hudToggle = document.getElementById('hud-toggle');
    if (hudToggle) {
      setDrawer(false);
      hudToggle.click();
    }
  });

  document.getElementById('open-drawings')?.addEventListener('click', () => {
    setDrawer(false);
    document.body.classList.add('chart-tools-open');
    const toolbar = document.getElementById('drawing-toolbar');
    if (toolbar) toolbar.style.display = 'block';
  });

  document.addEventListener('ochart:toast', event => {
    window.dispatchEvent(new CustomEvent('ochart:show-toast', { detail: event.detail }));
  });

  chartMain?.addEventListener('dblclick', () => setFocus(!document.body.classList.contains('chart-focus')));

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      if (document.body.classList.contains('drawer-open')) setDrawer(false);
      else setFocus(false);
    }
  });

  // Verifica o backend sem bloquear a inicialização do gráfico.
  checkDataApi();
}

boot();
