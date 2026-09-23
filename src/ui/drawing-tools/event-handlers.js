// src/ui/drawing-tools/event-handlers.js
// ============================================================
// Interação das ferramentas de desenho.
// Um único pipeline de Pointer Events controla mouse + touch.
// ChartZoom continua responsável apenas pelos gestos do gráfico.
// ============================================================

export class EventHandlers {
  constructor(drawingTools) {
    this.dt = drawingTools;
    this.pointerHandlers = { down: null, move: null, up: null, cancel: null };
    this.mouseHandlers = { dblclick: null };
    this.keyboardHandler = null;
    this.activePointerId = null;
  }

  attach() {
    const canvas = this.dt.engine?.canvas;
    if (!canvas) return;

    this.pointerHandlers.down = this.onPointerDown.bind(this);
    this.pointerHandlers.move = this.onPointerMove.bind(this);
    this.pointerHandlers.up = this.onPointerUp.bind(this);
    this.pointerHandlers.cancel = this.onPointerCancel.bind(this);
    this.mouseHandlers.dblclick = this.onDoubleClick.bind(this);

    canvas.addEventListener('pointerdown', this.pointerHandlers.down, { passive: false });
    canvas.addEventListener('pointermove', this.pointerHandlers.move, { passive: false });
    canvas.addEventListener('pointerup', this.pointerHandlers.up, { passive: false });
    canvas.addEventListener('pointercancel', this.pointerHandlers.cancel, { passive: false });
    canvas.addEventListener('dblclick', this.mouseHandlers.dblclick);

    this.keyboardHandler = this.onKeyDown.bind(this);
    document.addEventListener('keydown', this.keyboardHandler);
  }

  detach() {
    const canvas = this.dt.engine?.canvas;
    if (canvas) {
      canvas.removeEventListener('pointerdown', this.pointerHandlers.down);
      canvas.removeEventListener('pointermove', this.pointerHandlers.move);
      canvas.removeEventListener('pointerup', this.pointerHandlers.up);
      canvas.removeEventListener('pointercancel', this.pointerHandlers.cancel);
      canvas.removeEventListener('dblclick', this.mouseHandlers.dblclick);
    }

    if (this.keyboardHandler) {
      document.removeEventListener('keydown', this.keyboardHandler);
      this.keyboardHandler = null;
    }

    this._clearInteractionCapture();
    this.activePointerId = null;
  }

  onKeyDown(e) {
    if (e.ctrlKey && e.key === 'z' && !e.shiftKey) {
      e.preventDefault();
      this.dt.undo();
      return;
    }

    if ((e.ctrlKey && e.key === 'y') ||
        (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'z')) {
      e.preventDefault();
      this.dt.redo();
      return;
    }

    if (e.ctrlKey && e.key.toLowerCase() === 's') {
      e.preventDefault();
      this.dt.storageManager.saveJSON();
      return;
    }

    if (e.ctrlKey && e.key.toLowerCase() === 'o') {
      e.preventDefault();
      this.dt.storageManager.loadJSON();
      return;
    }

    if (e.key === 'Delete' && this.dt.selectedDrawing) {
      this.dt.drawingManager.remove(this.dt.selectedDrawing);
      return;
    }

    if (e.key === 'Escape') {
      this.cancelCurrentOperation();
      return;
    }

    if (e.altKey) {
      const shortcuts = {
        f: 'fib',
        t: 'trend',
        r: 'rect',
        h: 'hline',
        v: 'vline',
        m: 'measure'
      };
      const toolId = shortcuts[e.key.toLowerCase()];
      if (toolId) this.dt.selectTool(toolId);
    }
  }

  onPointerDown(ev) {
    const tool = this.dt.currentTool;
    if (!tool) return;

    if (ev.pointerType === 'touch') ev.preventDefault();

    this.activePointerId = ev.pointerId;
    try { ev.currentTarget.setPointerCapture(ev.pointerId); } catch {}

    const p = this.eventToChartPoint(ev);
    if (!p) return;

    // Cursor: se houver objeto sob o dedo/mouse, o desenho captura a interação
    // e o ChartZoom não deve mover o gráfico ao mesmo tempo.
    if (tool.id === 'cursor') {
      const hit = this.dt.drawingManager.findDrawingAtPoint(p);

      if (hit) {
        this.dt.selectedDrawing = hit;
        this.dt.isDragging = true;
        this.dt.dragStartPoint = p;
        this.dt.dragOriginal = JSON.parse(JSON.stringify(hit));
        this.dt.toolbar.refreshDrawList();
        this._setInteractionCapture(true);
      } else {
        this._setInteractionCapture(false);
      }

      return;
    }

    // A partir daqui a interação pertence à ferramenta.
    this._setInteractionCapture(true);
    this.beginOperation(ev, p);
  }

  onPointerMove(ev) {
    if (this.activePointerId !== null && ev.pointerId !== this.activePointerId) return;

    // Hover continua útil no desktop.
    if (this.dt.currentTool?.id === 'cursor' && !this.dt.isDragging) {
      const p = this.eventToChartPoint(ev);
      if (p) {
        const hovered = this.dt.drawingManager.findDrawingAtPoint(p);
        if (this.dt.engine?.canvas && ev.pointerType !== 'touch') {
          this.dt.engine.canvas.style.cursor = hovered ? 'move' : 'default';
        }
      }
      return;
    }

    if (!this.dt.isDrawing && !this.dt.isDragging) return;

    if (ev.pointerType === 'touch') ev.preventDefault();

    const p = this.eventToChartPoint(ev);
    if (!p) return;

    this.updateOperation(ev, p);
  }

  onPointerUp(ev) {
    if (this.activePointerId !== null && ev.pointerId !== this.activePointerId) return;

    if (ev.pointerType === 'touch') ev.preventDefault();

    if (this.dt.isDrawing || this.dt.isDragging) {
      this.finishOperation();
    }

    try { ev.currentTarget.releasePointerCapture(ev.pointerId); } catch {}

    this.activePointerId = null;
    this._clearInteractionCapture();
  }

  onPointerCancel(ev) {
    if (this.activePointerId !== null && ev.pointerId !== this.activePointerId) return;

    if (ev.pointerType === 'touch') ev.preventDefault();

    this.cancelCurrentOperation();
    try { ev.currentTarget.releasePointerCapture(ev.pointerId); } catch {}

    this.activePointerId = null;
    this._clearInteractionCapture();
  }

  beginOperation(ev, p) {
    const tool = this.dt.currentTool;
    if (!tool) return;

    if (tool.id === 'measure') {
      this.dt.measureStart = p;
      this.dt.isDrawing = true;
      this.dt.showMeasureTooltip(ev.clientX, ev.clientY, { reset: true });
      return;
    }

    if (tool.type !== 'drawing') return;

    this.dt.isDrawing = true;
    this.dt.startPoint = p;
    this.dt.endPoint = null;

    if (tool.id === 'hline') {
      this.dt.drawingManager.add({
        id: `hline-${Date.now()}`,
        type: 'hline',
        y: p.y,
        color: '#3b82f6',
        visible: true
      });
      this.dt.isDrawing = false;
      return;
    }

    if (tool.id === 'vline') {
      this.dt.drawingManager.add({
        id: `vline-${Date.now()}`,
        type: 'vline',
        x: p.x,
        color: '#3b82f6',
        visible: true
      });
      this.dt.isDrawing = false;
    }
  }

  updateOperation(ev, p) {
    if (this.dt.isDragging && this.dt.selectedDrawing && this.dt.dragStartPoint) {
      const dx = p.x - this.dt.dragStartPoint.x;
      const dy = p.y - this.dt.dragStartPoint.y;
      const d = this.dt.selectedDrawing;

      switch (d.type) {
        case 'hline':
          d.y = this.dt.dragOriginal.y + dy;
          break;
        case 'vline':
          d.x = this.dt.dragOriginal.x + dx;
          break;
        case 'trend':
        case 'rect':
        case 'fib':
          d.x1 = this.dt.dragOriginal.x1 + dx;
          d.y1 = this.dt.dragOriginal.y1 + dy;
          d.x2 = this.dt.dragOriginal.x2 + dx;
          d.y2 = this.dt.dragOriginal.y2 + dy;
          break;
      }

      this.dt.drawingManager.sendToEngine();
      return;
    }

    if (this.dt.currentTool?.id === 'measure' && this.dt.isDrawing) {
      this.dt.showMeasureTooltip(ev.clientX, ev.clientY, { p2: p });
      return;
    }

    if (this.dt.isDrawing && this.dt.startPoint) {
      this.dt.endPoint = p;
      this.dt.drawingManager.updatePreview();
    }
  }

  finishOperation() {
    if (this.dt.isDragging && this.dt.selectedDrawing) {
      this.dt.pushHistory('move');
      this.dt.isDragging = false;
      this.dt.dragStartPoint = null;
      this.dt.dragOriginal = null;
    }

    if (this.dt.currentTool?.id === 'measure' && this.dt.isDrawing) {
      this.dt.isDrawing = false;
      this.dt.measureStart = null;
      setTimeout(() => this.dt.hideMeasureTooltip(), 900);
      return;
    }

    if (this.dt.isDrawing && this.dt.startPoint && this.dt.endPoint) {
      const tool = this.dt.currentTool?.id;

      if (tool === 'trend') {
        this.dt.drawingManager.add({
          id: `trend-${Date.now()}`,
          type: 'trend',
          x1: this.dt.startPoint.x,
          y1: this.dt.startPoint.y,
          x2: this.dt.endPoint.x,
          y2: this.dt.endPoint.y,
          color: '#3b82f6',
          visible: true
        });
      } else if (tool === 'rect') {
        this.dt.drawingManager.add({
          id: `rect-${Date.now()}`,
          type: 'rect',
          x1: Math.min(this.dt.startPoint.x, this.dt.endPoint.x),
          y1: Math.min(this.dt.startPoint.y, this.dt.endPoint.y),
          x2: Math.max(this.dt.startPoint.x, this.dt.endPoint.x),
          y2: Math.max(this.dt.startPoint.y, this.dt.endPoint.y),
          color: '#3b82f6',
          fillColor: 'rgba(59,130,246,.12)',
          visible: true
        });
      } else if (tool === 'fib') {
        this.dt.drawingManager.add({
          id: `fib-${Date.now()}`,
          type: 'fib',
          x1: this.dt.startPoint.x,
          y1: this.dt.startPoint.y,
          x2: this.dt.endPoint.x,
          y2: this.dt.endPoint.y,
          levels: this.dt.toolbar.readFibLevelsChecked(),
          color: '#6b7280',
          visible: true
        });
      }
    }

    this.dt.isDrawing = false;
    this.dt.startPoint = null;
    this.dt.endPoint = null;
    this.dt.drawingManager.clearPreview();
  }

  cancelCurrentOperation() {
    this.dt.isDrawing = false;
    this.dt.isDragging = false;
    this.dt.startPoint = null;
    this.dt.endPoint = null;
    this.dt.dragStartPoint = null;
    this.dt.dragOriginal = null;
    this.dt.measureStart = null;
    this.dt.hideMeasureTooltip();
    this.dt.drawingManager.clearPreview();
    this._clearInteractionCapture();
  }

  onDoubleClick(ev) {
    const p = this.eventToChartPoint(ev);
    if (!p) return;

    const hit = this.dt.drawingManager.findDrawingAtPoint(p);
    if (!hit) return;

    const newColor = prompt(
      'Cor (hex) para o objeto selecionado:',
      hit.color || '#3b82f6'
    );

    if (newColor) {
      hit.color = newColor;
      this.dt.drawingManager.sendToEngine();
      this.dt.pushHistory('edit');
    }
  }

  eventToChartPoint(ev) {
    const canvas = this.dt.engine?.canvas;
    const chart = this.dt.engine?.chart;
    if (!canvas || !chart) return null;

    const rect = canvas.getBoundingClientRect();
    const x = ev.clientX - rect.left;
    const y = ev.clientY - rect.top;

    const xs = chart.scales?.x;
    const ys = chart.scales?.y;
    if (!xs || !ys) return null;

    const valueX = xs.getValueForPixel(x);
    const valueY = ys.getValueForPixel(y);

    if (!Number.isFinite(Number(valueX)) || !Number.isFinite(Number(valueY))) {
      return null;
    }

    return { x: Number(valueX), y: Number(valueY) };
  }

  _setInteractionCapture(active) {
    const canvas = this.dt.engine?.canvas;
    if (!canvas) return;
    canvas.dataset.ochartDrawingCapture = active ? 'true' : 'false';
  }

  _clearInteractionCapture() {
    this._setInteractionCapture(false);
  }
}
