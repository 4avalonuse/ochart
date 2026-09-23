/**
 * ChartZoom — controle isolado do viewport horizontal do gráfico.
 * Zoom por gesto de dois dedos é tratado aqui para não depender de Hammer.js.
 */
export class ChartZoom {
  constructor(chart = null) {
    this.chart = chart;
    this._touch = null;
    this._pan = null;
  }

  attach(chart) {
    this._detachTouch();
    this.chart = chart;
    const scale = chart?.scales?.x;
    this._bounds = scale ? { min: Number(scale.min), max: Number(scale.max) } : null;
    this._bindTouch();
    return this;
  }

  reset() {
    if (!this.chart?.resetZoom) return false;
    this.chart.resetZoom();
    return true;
  }

  getState() {
    const scale = this.chart?.scales?.x;
    return scale ? { min: scale.min, max: scale.max } : null;
  }

  setState(state) {
    if (!this.chart || !state || !this.chart.zoomScale) return;
    this.chart.zoomScale('x', { min: state.min, max: state.max });
  }

  hardenWithoutHammer() {
    const zoom = this.chart?.options?.plugins?.zoom;
    if (zoom) {
      if (zoom.zoom?.pinch) zoom.zoom.pinch.enabled = false;
      if (zoom.pan) zoom.pan.enabled = false;
    }
  }

  _bindTouch() {
    const canvas = this.chart?.canvas;
    if (!canvas || this._touch) return;

    this._touch = {
      start: event => {
        if (event.touches?.length === 1) {
          const scale = this.chart?.scales?.x;
          if (!scale) return;
          const t = event.touches[0];
          this._pan = {
            startX: t.clientX,
            min: Number(scale.min),
            max: Number(scale.max),
            width: canvas.getBoundingClientRect().width
          };
          return;
        }
        if (event.touches?.length !== 2) return;
        this._pan = null;
        const scale = this.chart?.scales?.x;
        if (!scale) return;

        const a = event.touches[0];
        const b = event.touches[1];
        const dx = b.clientX - a.clientX;
        const dy = b.clientY - a.clientY;
        const distance = Math.hypot(dx, dy);
        if (!Number.isFinite(distance) || distance <= 0) return;

        this._pinchState = {
          distance,
          min: Number(scale.min),
          max: Number(scale.max),
          centerX: (a.clientX + b.clientX) / 2,
          rect: canvas.getBoundingClientRect()
        };
      },
      move: event => {
        if (event.touches?.length === 1 && this._pan) {
          const t = event.touches[0];
          const dx = t.clientX - this._pan.startX;
          const span = this._pan.max - this._pan.min;
          if (!Number.isFinite(span) || span <= 0) return;
          const delta = -(dx / Math.max(1, this._pan.width)) * span;
          let min = this._pan.min + delta;
          let max = this._pan.max + delta;
          const boundMin = Number.isFinite(this._bounds?.min) ? this._bounds.min : min;
          const boundMax = Number.isFinite(this._bounds?.max) ? this._bounds.max : max;
          if (min < boundMin) { max += boundMin - min; min = boundMin; }
          if (max > boundMax) { min -= max - boundMax; max = boundMax; }
          min = Math.max(boundMin, min); max = Math.min(boundMax, max);
          event.preventDefault();
          this.chart.zoomScale('x', { min, max }, 'none');
          return;
        }
        const state = this._pinchState;
        if (!state || event.touches?.length !== 2) return;

        const a = event.touches[0];
        const b = event.touches[1];
        const dx = b.clientX - a.clientX;
        const dy = b.clientY - a.clientY;
        const distance = Math.hypot(dx, dy);
        if (!Number.isFinite(distance) || distance <= 0) return;

        const span = state.max - state.min;
        if (!Number.isFinite(span) || span <= 0) return;

        const factor = state.distance / distance;
        const xScale = this.chart?.scales?.x;
        if (!xScale) return;

        const centerPixel = state.centerX - state.rect.left;
        const ratio = Math.max(0, Math.min(1, centerPixel / Math.max(1, state.rect.width)));
        const centerValue = state.min + (state.max - state.min) * ratio;

        let min = centerValue - (centerValue - state.min) * factor;
        let max = centerValue + (state.max - centerValue) * factor;

        const boundMin = Number.isFinite(this._bounds?.min) ? this._bounds.min : state.min;
        const boundMax = Number.isFinite(this._bounds?.max) ? this._bounds.max : state.max;

        const minSpan = Math.max((boundMax - boundMin) / 10000, 1);
        if (max - min < minSpan) {
          const mid = (min + max) / 2;
          min = mid - minSpan / 2;
          max = mid + minSpan / 2;
        }
        if (min < boundMin) {
          max += boundMin - min;
          min = boundMin;
        }
        if (max > boundMax) {
          min -= max - boundMax;
          max = boundMax;
        }
        min = Math.max(boundMin, min);
        max = Math.min(boundMax, max);

        event.preventDefault();
        this.chart.zoomScale('x', { min, max }, 'none');
      },
      end: () => {
        this._pinchState = null;
        this._pan = null;
      }
    };

    canvas.addEventListener('touchstart', this._touch.start, { passive: true });
    canvas.addEventListener('touchmove', this._touch.move, { passive: false });
    canvas.addEventListener('touchend', this._touch.end, { passive: true });
    canvas.addEventListener('touchcancel', this._touch.end, { passive: true });
  }

  _detachTouch() {
    const canvas = this.chart?.canvas;
    if (!canvas || !this._touch) return;
    canvas.removeEventListener('touchstart', this._touch.start);
    canvas.removeEventListener('touchmove', this._touch.move);
    canvas.removeEventListener('touchend', this._touch.end);
    canvas.removeEventListener('touchcancel', this._touch.end);
    this._touch = null;
    this._pinchState = null;
  }
}
