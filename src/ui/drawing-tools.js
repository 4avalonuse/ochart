// src/ui/drawing-tools.js
// ============================================================
// Arquivo principal - Orquestra os módulos de ferramentas de desenho
// ============================================================

import { DrawingToolbar } from './drawing-tools/toolbar.js';
import { DrawingManager } from './drawing-tools/drawing-manager.js';
import { EventHandlers } from './drawing-tools/event-handlers.js';
import { OverlayManager } from './drawing-tools/overlay-manager.js';
import { StorageManager } from './drawing-tools/storage-manager.js';

export class DrawingTools {
  constructor(chartEngine, options = {}) {
    this.engine = chartEngine;
    this.options = options;

    // Estado principal
    this.currentTool = null;
    this.isDrawing = false;
    this.isDragging = false;
    this.startPoint = null;
    this.endPoint = null;
    this.selectedDrawing = null;
    this.hoveredDrawing = null;
    this.dragStartPoint = null;
    this.dragOriginal = null;

    // Ferramentas disponíveis
    this.tools = {
      cursor:  { id:'cursor',  icon:'↖️', label:'Selecionar',       type:'navigation' },
      trend:   { id:'trend',   icon:'📈', label:'Tendência',         type:'drawing'    },
      hline:   { id:'hline',   icon:'➖', label:'Linha Horizontal',  type:'drawing'    },
      vline:   { id:'vline',   icon:'│',  label:'Linha Vertical',    type:'drawing'    },
      rect:    { id:'rect',    icon:'▭',  label:'Retângulo',         type:'drawing'    },
      fib:     { id:'fib',     icon:'🌀', label:'Fibonacci',         type:'drawing'    },
      text:    { id:'text',    icon:'T',  label:'Texto',             type:'annotation' },
      measure: { id:'measure', icon:'📏', label:'Medir',             type:'tool'       }
    };

    // Inicializa módulos
    this.toolbar = new DrawingToolbar(this);
    this.drawingManager = new DrawingManager(this);
    this.eventHandlers = new EventHandlers(this);
    this.overlayManager = new OverlayManager(this);
    this.storageManager = new StorageManager(this);

    // Histórico
    this.history = [];
    this.historyIndex = -1;
    this.maxHistorySize = 80;

    // Medição
    this.measureTooltipEl = null;
    this.measureStart = null;
  }

  // =========================================================
  // Inicialização / Destruição
  // =========================================================
  init() {
    this.toolbar.render();
    this.selectTool('cursor');
    this.eventHandlers.attach();
    this._ensureMeasureTooltip();
  }

  destroy() {
    this.eventHandlers.detach();
    this.toolbar.destroy();
    if (this.measureTooltipEl) {
      this.measureTooltipEl.remove();
    }
  }

  // =========================================================
  // Seleção de Ferramenta
  // =========================================================
  selectTool(toolId) {
    this.toolbar.setActiveTool(toolId);
    this.currentTool = this.tools[toolId];
    this._updateCanvasCursor();
    this._updateChartInteraction();
  }

  _updateCanvasCursor() {
    if (!this.engine?.canvas) return;
    const c = this.engine.canvas.classList;
    c.remove('chart-cursor-crosshair','chart-cursor-pointer','chart-cursor-move');

    if (this.currentTool?.type === 'drawing' || this.currentTool?.id === 'measure') {
      c.add('chart-cursor-crosshair');
    } else if (this.currentTool?.id === 'cursor') {
      c.add('chart-cursor-pointer');
    }
  }

  _updateChartInteraction() {
    if (!this.engine?.chart) return;
    const chart = this.engine.chart;
    const drawingMode = this.currentTool?.type === 'drawing' || this.currentTool?.id === 'measure';
    const z = chart.options?.plugins?.zoom;
    const hasHammer = !!(window.Hammer && window.Hammer.Manager);

    if (z) {
      if (z.zoom?.drag)  z.zoom.drag.enabled  = !drawingMode;
      if (z.zoom?.wheel) z.zoom.wheel.enabled = !drawingMode;
      if (z.zoom?.pinch) z.zoom.pinch.enabled = hasHammer ? !drawingMode : false;
      if (z.pan)         z.pan.enabled        = hasHammer ? !drawingMode : false;
    }

    chart.update('none');
  }

  // =========================================================
  // Histórico (Undo/Redo)
  // =========================================================
  pushHistory(action) {
    this.history = this.history.slice(0, this.historyIndex + 1);
    this.history.push({
      action, 
      ts: Date.now(),
      state: {
        drawings: JSON.parse(JSON.stringify(this.drawingManager.drawings)),
        overlays: JSON.parse(JSON.stringify(this.overlayManager.overlays))
      }
    });
    
    if (this.history.length > this.maxHistorySize) {
      this.history.shift();
      this.historyIndex = this.history.length - 1;
    } else {
      this.historyIndex++;
    }
    
    this.toolbar.updateHistoryButtons(this.historyIndex, this.history.length);
  }

  undo() {
    if (this.historyIndex <= 0) return;
    this.historyIndex--;
    this._restoreState(this.history[this.historyIndex].state);
  }

  redo() {
    if (this.historyIndex >= this.history.length - 1) return;
    this.historyIndex++;
    this._restoreState(this.history[this.historyIndex].state);
  }

  _restoreState(state) {
    this.drawingManager.drawings = JSON.parse(JSON.stringify(state.drawings));
    this.overlayManager.overlays = JSON.parse(JSON.stringify(state.overlays));
    this.selectedDrawing = null;
    
    this.drawingManager.sendToEngine();
    this.overlayManager.sendToEngine();
    this.toolbar.refreshDrawList();
    this.toolbar.refreshMAList();
    this.toolbar.updateHistoryButtons(this.historyIndex, this.history.length);
  }

  // =========================================================
  // Medição
  // =========================================================
  _ensureMeasureTooltip() {
    if (this.measureTooltipEl) return;
    const el = document.createElement('div');
    el.className = 'measure-tooltip';
    el.style.display = 'none';
    document.body.appendChild(el);
    this.measureTooltipEl = el;
  }

  showMeasureTooltip(clientX, clientY, { p2=null, reset=false } = {}) {
    if (!this.measureTooltipEl) return;
    const el = this.measureTooltipEl;

    if (reset) {
      el.style.display = 'block';
      el.textContent = 'Selecione o segundo ponto…';
      el.style.left = `${clientX + 10}px`;
      el.style.top  = `${clientY + 10}px`;
      return;
    }

    if (this.measureStart && p2) {
      const dx = p2.x - this.measureStart.x;
      const dy = p2.y - this.measureStart.y;

      const xScale = this.engine.chart.scales.x;
      const pxDist = Math.abs(xScale.getPixelForValue(p2.x) - xScale.getPixelForValue(this.measureStart.x));
      const barW = Math.max(1, (xScale.width / Math.max(1, xScale.ticks?.length || 50)));
      const bars = Math.round(pxDist / barW);
      const pct = (dy / (this.measureStart.y || 1)) * 100;

      el.textContent = `Δpreço: ${dy.toFixed(2)} (${pct.toFixed(2)}%) | Δtempo: ${dx.toFixed(2)} (≈ ${bars} barras)`;
      el.style.display = 'block';
      el.style.left = `${clientX + 10}px`;
      el.style.top  = `${clientY + 10}px`;
    }
  }

  hideMeasureTooltip() {
    if (this.measureTooltipEl) {
      this.measureTooltipEl.style.display = 'none';
    }
  }

  // =========================================================
  // Utilitários
  // =========================================================
  clearAll() {
    if (!confirm('Remover todos os desenhos?')) return;
    this.drawingManager.drawings = [];
    this.selectedDrawing = null;
    this.drawingManager.sendToEngine();
    this.toolbar.refreshDrawList();
    this.pushHistory('clear');
  }

  flash(msg) {
    const el = document.createElement('div');
    el.style.cssText = 'position:fixed;right:14px;bottom:14px;background:var(--surface-alt);border:1px solid var(--border);padding:8px 12px;border-radius:8px;box-shadow:0 2px 10px rgba(0,0,0,.12);z-index:99999;font-size:12px;color:var(--text)';
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 1600);
  }
}