/**
 * ChartZoom — controle isolado do viewport horizontal do gráfico.
 * Inclui interação touch nativa para celular, sem depender de Hammer.js.
 */
export class ChartZoom {
  constructor(chart = null) {
    this.chart = null;
    this._touches = new Map();
    this._touchStart = null;
    this._bound = false;
    this.attach(chart);
  }

  attach(chart) {
    this._unbindTouch();
    this.chart = chart;
    this._bindTouch();
    return this;
  }

  reset() {
    if (!this.chart?.resetZoom) return false;
    this.chart.resetZoom();
    return true;
  }

  zoomBy(factor = 1) {
    const scale = this.chart?.scales?.x;
    if (!scale || !this.chart?.zoomScale || !Number.isFinite(factor) || factor <= 0) return false;
    const min = Number(scale.min);
    const max = Number(scale.max);
    if (!Number.isFinite(min) || !Number.isFinite(max) || max <= min) return false;
    const center = (min + max) / 2;
    const half = (max - min) * factor / 2;
    const nextMin = center - half;
    const nextMax = center + half;
    if (nextMax <= nextMin) return false;
    this.chart.zoomScale('x', { min: nextMin, max: nextMax }, 'none');
    return true;
  }

  getState() {
    const scale = this.chart?.scales?.x;
    return scale ? { min: scale.min, max: scale.max } : null;
  }

  setState(state) {
    if (!this.chart || !state || !this.chart.zoomScale) return;
    this.chart.zoomScale('x', { min: state.min, max: state.max }, 'none');
  }

  hardenWithoutHammer() {
    const zoom = this.chart?.options?.plugins?.zoom;
    if (zoom) {
      // O touch é tratado nativamente abaixo. O plugin fica responsável
      // pelo wheel/drag no desktop, evitando dependência de Hammer.js.
      if (zoom.zoom?.pinch) zoom.zoom.pinch.enabled = false;
      if (zoom.pan) zoom.pan.enabled = false;
    }
  }

  _bindTouch() {
    const canvas = this.chart?.canvas;
    if (!canvas || this._bound) return;

    this._onTouchStart = event => {
      if (!event.touches?.length) return;
      event.preventDefault();
      this._touches = new Map(
        [...event.touches].map(t => [t.identifier, { x: t.clientX, y: t.clientY }])
      );
      const scale = this.chart?.scales?.x;
      this._touchStart = scale ? {
        min: scale.min,
        max: scale.max,
        distance: this._touchDistance(event.touches)
      } : null;
    };

    this._onTouchMove = event => {
      if (!this.chart || !this._touchStart || !event.touches?.length) return;
      event.preventDefault();
      const scale = this.chart.scales?.x;
      if (!scale) return;

      if (event.touches.length >= 2) {
        const distance = this._touchDistance(event.touches);
        const startDistance = this._touchStart.distance;
        if (!Number.isFinite(distance) || distance <= 0 || !Number.isFinite(startDistance) || startDistance <= 0) return;

        const ratio = startDistance / distance;
        const rect = canvas.getBoundingClientRect();
        const centerX = this._touchCenterX(event.touches) - rect.left;
        const centerValue = scale.getValueForPixel(centerX);
        const startMin = Number(this._touchStart.min);
        const startMax = Number(this._touchStart.max);
        if (!Number.isFinite(centerValue)) return;

        const nextMin = centerValue - (centerValue - startMin) * ratio;
        const nextMax = centerValue + (startMax - centerValue) * ratio;
        if (nextMax > nextMin) this.chart.zoomScale('x', { min: nextMin, max: nextMax }, 'none');
        return;
      }

      const touch = event.touches[0];
      const previous = this._touches.get(touch.identifier);
      if (!previous) return;

      const dx = touch.clientX - previous.x;
      const rect = canvas.getBoundingClientRect();
      const px = touch.clientX - rect.left;
      const previousValue = scale.getValueForPixel(px);
      const currentValue = scale.getValueForPixel(px - dx);
      const delta = Number(currentValue) - Number(previousValue);

      if (Number.isFinite(delta)) {
        this.chart.zoomScale('x', {
          min: Number(scale.min) + delta,
          max: Number(scale.max) + delta
        }, 'none');
      }
      this._touches.set(touch.identifier, { x: touch.clientX, y: touch.clientY });
    };

    this._onTouchEnd = event => {
      event.preventDefault();
      if (!event.touches?.length) {
        this._touches.clear();
        this._touchStart = null;
      } else {
        this._touches = new Map(
          [...event.touches].map(t => [t.identifier, { x: t.clientX, y: t.clientY }])
        );
      }
    };

    canvas.addEventListener('touchstart', this._onTouchStart, { passive: false });
    canvas.addEventListener('touchmove', this._onTouchMove, { passive: false });
    canvas.addEventListener('touchend', this._onTouchEnd, { passive: false });
    canvas.addEventListener('touchcancel', this._onTouchEnd, { passive: false });
    canvas.style.touchAction = 'none';
    this._bound = true;
  }

  _unbindTouch() {
    const canvas = this.chart?.canvas;
    if (canvas && this._bound) {
      canvas.removeEventListener('touchstart', this._onTouchStart);
      canvas.removeEventListener('touchmove', this._onTouchMove);
      canvas.removeEventListener('touchend', this._onTouchEnd);
      canvas.removeEventListener('touchcancel', this._onTouchEnd);
      canvas.style.touchAction = '';
    }
    this._touches.clear();
    this._touchStart = null;
    this._bound = false;
  }

  _touchDistance(touches) {
    if (touches.length < 2) return 0;
    const a = touches[0], b = touches[1];
    return Math.hypot(b.clientX - a.clientX, b.clientY - a.clientY);
  }

  _touchCenterX(touches) {
    if (touches.length < 2) return touches[0]?.clientX || 0;
    return (touches[0].clientX + touches[1].clientX) / 2;
  }
}