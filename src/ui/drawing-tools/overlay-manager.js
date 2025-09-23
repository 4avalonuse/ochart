// src/ui/drawing-tools/overlay-manager.js
// ============================================================
// Módulo responsável pelo gerenciamento de overlays (médias móveis)
// ============================================================

export class OverlayManager {
  constructor(drawingTools) {
    this.dt = drawingTools;
    this.overlays = [];
  }

  add(overlay) {
    this.overlays.push(overlay);
    this.sendToEngine();
  }

  remove(index) {
    if (index >= 0 && index < this.overlays.length) {
      this.overlays.splice(index, 1);
      this.sendToEngine();
    }
  }

  sendToEngine() {
    if (this.dt.engine) {
      this.dt.engine.setOverlays(this.overlays);
    }
  }

  clear() {
    this.overlays = [];
    this.sendToEngine();
  }

  getOverlays() {
    return this.overlays;
  }

  setOverlays(overlays) {
    this.overlays = overlays;
    this.sendToEngine();
  }
}