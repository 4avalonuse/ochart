// src/core/interaction-manager.js
// ============================================================
// Dono único da entrada física do gráfico.
// Uma interação recebe um único proprietário até terminar.
// ============================================================

export class InteractionManager {
  constructor(engine, drawingTools) {
    this.engine = engine;
    this.drawingTools = drawingTools;
    this.canvas = null;
    this.handlers = null;
    this.pointers = new Map();
    this.owner = null; // 'chart' | 'drawing'
  }

  attach() {
    const canvas = this.engine?.canvas;
    if (!canvas || this.canvas) return;

    this.canvas = canvas;
    this.handlers = {
      down: this.onPointerDown.bind(this),
      move: this.onPointerMove.bind(this),
      up: this.onPointerUp.bind(this),
      cancel: this.onPointerCancel.bind(this),
      dblclick: this.onDoubleClick.bind(this)
    };

    canvas.addEventListener('pointerdown', this.handlers.down, { passive: false });
    canvas.addEventListener('pointermove', this.handlers.move, { passive: false });
    canvas.addEventListener('pointerup', this.handlers.up, { passive: false });
    canvas.addEventListener('pointercancel', this.handlers.cancel, { passive: false });
    canvas.addEventListener('dblclick', this.handlers.dblclick);
  }

  detach() {
    if (!this.canvas || !this.handlers) return;

    this.canvas.removeEventListener('pointerdown', this.handlers.down);
    this.canvas.removeEventListener('pointermove', this.handlers.move);
    this.canvas.removeEventListener('pointerup', this.handlers.up);
    this.canvas.removeEventListener('pointercancel', this.handlers.cancel);
    this.canvas.removeEventListener('dblclick', this.handlers.dblclick);

    this.pointers.clear();
    this.owner = null;
    this.engine?.zoom?.handlePointerCancel();
    this.canvas = null;
    this.handlers = null;
  }

  onPointerDown(ev) {
    if (!this.canvas) return;

    const isTouch = ev.pointerType === 'touch' || ev.pointerType === 'pen';
    if (isTouch) ev.preventDefault();

    this.pointers.set(ev.pointerId, ev);

    // Uma ferramenta ativa ou um objeto selecionável ganha a interação.
    if (this.pointers.size === 1) {
      this.owner = this._resolveOwner(ev);
      this._capture(ev);
    } else if (this.owner !== 'chart') {
      // Desenho/objeto é sempre single-pointer.
      return;
    }

    const active = [...this.pointers.values()];

    if (this.owner === 'drawing') {
      this.drawingTools.eventHandlers.onPointerDown(ev);
      return;
    }

    this.engine.zoom.handlePointerDown(ev, active);
  }

  onPointerMove(ev) {
    if (!this.pointers.has(ev.pointerId)) return;

    this.pointers.set(ev.pointerId, ev);
    const active = [...this.pointers.values()];

    if (this.owner === 'drawing') {
      this.drawingTools.eventHandlers.onPointerMove(ev);
      return;
    }

    if (this.owner === 'chart') {
      this.engine.zoom.handlePointerMove(ev, active);
    }
  }

  onPointerUp(ev) {
    if (!this.pointers.has(ev.pointerId)) return;

    const wasOwner = this.owner;
    this.pointers.delete(ev.pointerId);

    if (wasOwner === 'drawing') {
      this.drawingTools.eventHandlers.onPointerUp(ev);
    } else if (wasOwner === 'chart') {
      this.engine.zoom.handlePointerUp(ev, [...this.pointers.values()]);
    }

    try { this.canvas.releasePointerCapture(ev.pointerId); } catch {}

    if (this.pointers.size === 0) {
      this.owner = null;
      this.engine.zoom.handlePointerCancel();
    }
  }

  onPointerCancel(ev) {
    if (!this.pointers.has(ev.pointerId)) return;

    this.pointers.delete(ev.pointerId);

    if (this.owner === 'drawing') {
      this.drawingTools.eventHandlers.onPointerCancel(ev);
    } else {
      this.engine.zoom.handlePointerCancel();
    }

    try { this.canvas.releasePointerCapture(ev.pointerId); } catch {}

    if (this.pointers.size === 0) {
      this.owner = null;
    }
  }

  onDoubleClick(ev) {
    // Duplo clique é uma ação de objeto, nunca um gesto de viewport.
    this.drawingTools.eventHandlers.onDoubleClick(ev);
  }

  _resolveOwner(ev) {
    const tool = this.drawingTools?.currentTool;
    if (!tool) return 'chart';

    if (tool.type === 'drawing' || tool.id === 'measure') {
      return 'drawing';
    }

    if (tool.id === 'cursor') {
      const p = this.drawingTools.eventHandlers.eventToChartPoint(ev);
      if (p && this.drawingTools.drawingManager.findDrawingAtPoint(p)) {
        return 'drawing';
      }
    }

    return 'chart';
  }

  _capture(ev) {
    try { this.canvas.setPointerCapture(ev.pointerId); } catch {}
  }
}
