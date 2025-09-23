// src/ui/drawing-tools/event-handlers.js
// ============================================================
// Módulo responsável por gerenciar eventos de mouse e teclado
// ============================================================

export class EventHandlers {
  constructor(drawingTools) {
    this.dt = drawingTools;
    this.mouseHandlers = {
      down: null,
      move: null,
      up: null,
      dblclick: null
    };
  }

  attach() {
    if (!this.dt.engine?.canvas) return;
    const canvas = this.dt.engine.canvas;

    this.mouseHandlers.down = this.onMouseDown.bind(this);
    this.mouseHandlers.move = this.onMouseMove.bind(this);
    this.mouseHandlers.up = this.onMouseUp.bind(this);
    this.mouseHandlers.dblclick = this.onDoubleClick.bind(this);

    canvas.addEventListener('mousedown', this.mouseHandlers.down);
    canvas.addEventListener('mousemove', this.mouseHandlers.move);
    canvas.addEventListener('mouseup', this.mouseHandlers.up);
    canvas.addEventListener('dblclick', this.mouseHandlers.dblclick);
    canvas.addEventListener('mouseleave', this.mouseHandlers.up);

    this.attachKeyboardShortcuts();
  }

  detach() {
    if (!this.dt.engine?.canvas) return;
    const canvas = this.dt.engine.canvas;

    canvas.removeEventListener('mousedown', this.mouseHandlers.down);
    canvas.removeEventListener('mousemove', this.mouseHandlers.move);
    canvas.removeEventListener('mouseup', this.mouseHandlers.up);
    canvas.removeEventListener('dblclick', this.mouseHandlers.dblclick);
    canvas.removeEventListener('mouseleave', this.mouseHandlers.up);
  }

  attachKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      // Undo/Redo
      if (e.ctrlKey && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        this.dt.undo();
      }
      if ((e.ctrlKey && e.key === 'y') || (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'z')) {
        e.preventDefault();
        this.dt.redo();
      }
      
      // Save/Load
      if (e.ctrlKey && e.key.toLowerCase() === 's') {
        e.preventDefault();
        this.dt.storageManager.saveJSON();
      }
      if (e.ctrlKey && e.key.toLowerCase() === 'o') {
        e.preventDefault();
        this.dt.storageManager.loadJSON();
      }
      
      // Delete selected
      if (e.key === 'Delete' && this.dt.selectedDrawing) {
        this.dt.drawingManager.remove(this.dt.selectedDrawing);
      }
      
      // Escape - cancel operations
      if (e.key === 'Escape') {
        this.dt.isDrawing = false;
        this.dt.isDragging = false;
        this.dt.selectedDrawing = null;
        this.dt.measureStart = null;
        this.dt.hideMeasureTooltip();
        this.dt.toolbar.refreshDrawList();
        this.dt.drawingManager.clearPreview();
      }
      
      // Tool shortcuts (Alt + key)
      if (e.altKey) {
        const key = e.key.toLowerCase();
        const shortcuts = {
          'f': 'fib',
          't': 'trend',
          'r': 'rect',
          'h': 'hline',
          'v': 'vline',
          'm': 'measure',
          'x': 'text'
        };
        if (shortcuts[key]) {
          this.dt.selectTool(shortcuts[key]);
        }
      }
    });
  }

  onMouseDown(ev) {
    const p = this.eventToChartPoint(ev);

    // Cursor mode - selection/drag
    if (this.dt.currentTool?.id === 'cursor') {
      const hit = this.dt.drawingManager.findDrawingAtPoint(p);
      if (hit) {
        this.dt.selectedDrawing = hit;
        this.dt.isDragging = true;
        this.dt.dragStartPoint = p;
        this.dt.dragOriginal = JSON.parse(JSON.stringify(hit));
        this.dt.toolbar.refreshDrawList();
        return;
      }
    }

    // Measure tool
    if (this.dt.currentTool?.id === 'measure') {
      this.dt.measureStart = p;
      this.dt.isDrawing = true;
      this.dt.showMeasureTooltip(ev.clientX, ev.clientY, { reset: true });
      return;
    }

    // Drawing tools
    if (this.dt.currentTool?.type === 'drawing') {
      this.dt.isDrawing = true;
      this.dt.startPoint = p;

      // Horizontal line - create immediately
      if (this.dt.currentTool.id === 'hline') {
        this.dt.drawingManager.add({
          id: `hline-${Date.now()}`,
          type: 'hline',
          y: p.y,
          color: '#3b82f6',
          visible: true
        });
        this.dt.isDrawing = false;
      }
      
      // Vertical line - create immediately
      if (this.dt.currentTool.id === 'vline') {
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
  }

  onMouseMove(ev) {
    const p = this.eventToChartPoint(ev);

    // Hover cursor in selection mode
    if (this.dt.currentTool?.id === 'cursor' && !this.dt.isDragging && this.dt.engine?.canvas) {
      const hovered = this.dt.drawingManager.findDrawingAtPoint(p);
      this.dt.engine.canvas.style.cursor = hovered ? 'move' : 'default';
    }

    // Dragging selected item
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

    // Measuring
    if (this.dt.currentTool?.id === 'measure' && this.dt.isDrawing) {
      this.dt.showMeasureTooltip(ev.clientX, ev.clientY, { p2: p });
      return;
    }

    // Drawing preview
    if (this.dt.isDrawing && this.dt.startPoint) {
      this.dt.endPoint = p;
      this.dt.drawingManager.updatePreview();
    }
  }

  onMouseUp() {
    // Finish dragging
    if (this.dt.isDragging && this.dt.selectedDrawing) {
      this.dt.pushHistory('move');
      this.dt.isDragging = false;
      this.dt.dragStartPoint = null;
      this.dt.dragOriginal = null;
    }

    // Finish measuring
    if (this.dt.currentTool?.id === 'measure' && this.dt.isDrawing) {
      this.dt.isDrawing = false;
      this.dt.measureStart = null;
      setTimeout(() => this.dt.hideMeasureTooltip(), 900);
      return;
    }

    // Finish drawing
    if (this.dt.isDrawing && this.dt.startPoint && this.dt.endPoint) {
      switch (this.dt.currentTool.id) {
        case 'trend':
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
          break;
          
        case 'rect':
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
          break;
          
        case 'fib':
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
          break;
      }
    }

    this.dt.isDrawing = false;
    this.dt.startPoint = null;
    this.dt.endPoint = null;
    this.dt.drawingManager.clearPreview();
  }

  onDoubleClick(ev) {
    const p = this.eventToChartPoint(ev);
    const hit = this.dt.drawingManager.findDrawingAtPoint(p);
    if (!hit) return;

    const newColor = prompt('Cor (hex) para o objeto selecionado:', hit.color || '#3b82f6');
    if (newColor) {
      hit.color = newColor;
      this.dt.drawingManager.sendToEngine();
      this.dt.pushHistory('edit');
    }
  }

  eventToChartPoint(ev) {
    const rect = this.dt.engine.canvas.getBoundingClientRect();
    const x = ev.clientX - rect.left;
    const y = ev.clientY - rect.top;
    
    const xs = this.dt.engine?.chart?.scales?.x;
    const ys = this.dt.engine?.chart?.scales?.y;
    
    if (!xs || !ys) return { x: 0, y: 0 };
    
    return {
      x: xs.getValueForPixel(x),
      y: ys.getValueForPixel(y)
    };
  }
}