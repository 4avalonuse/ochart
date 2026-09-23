/**
 * ChartZoom — viewport e interação do gráfico.
 *
 * X (tempo) continua linear em sua própria geometria.
 * Y delega toda a matemática para YViewport, que conhece a diferença
 * entre escala linear e logarítmica.
 */
import { YViewport } from './y-viewport.js';

export class ChartZoom {
  constructor(chart = null) {
    this.chart = chart;
    this._touch = null;
    this._pan = null;
    this._panAxis = null;
    this._gestureTarget = null;
    this._bounds = null;
    this._yBounds = null;
    this._yViewport = new YViewport('linear');
  }

  attach(chart) {
    this._detachTouch();
    this.chart = chart;
    this._syncYViewportType();
    this._captureBounds();
    // DOM gestures são roteados pelo InteractionManager.
    return this;
  }

  refreshBounds(xMin, xMax, yMin, yMax) {
    if (xMin !== undefined && xMax !== undefined) {
      const nextXMin = Number(xMin);
      const nextXMax = Number(xMax);
      if (Number.isFinite(nextXMin) && Number.isFinite(nextXMax) && nextXMax > nextXMin) {
        this._bounds = { min: nextXMin, max: nextXMax };
      }
    } else {
      this._captureBounds();
    }

    if (yMin !== undefined && yMax !== undefined) {
      const nextYMin = Number(yMin);
      const nextYMax = Number(yMax);
      if (this._yViewport.validRange(nextYMin, nextYMax)) {
        this._yBounds = { min: nextYMin, max: nextYMax };
      }
    }
  }

  setYScaleType(type) {
    // A troca de escala muda a geometria, mas não deve capturar o viewport
    // atual como se ele fosse o limite dos dados. O Engine fornece os
    // limites brutos logo depois da troca.
    this._yViewport.setType(type);
    return this._yViewport.type;
  }

  fitVisiblePriceScale() {
    if (!this.chart) return false;

    this._syncYViewportType();

    const xScale = this.chart.scales?.x;
    const yOptions = this.chart.options?.scales?.y;
    if (!xScale || !yOptions) return false;

    const minX = Number(xScale.min);
    const maxX = Number(xScale.max);
    if (!Number.isFinite(minX) || !Number.isFinite(maxX) || minX >= maxX) return false;

    const rows = Array.isArray(this.chart.$ochartData)
      ? this.chart.$ochartData
      : [];

    if (!rows.length) return false;

    const lows = [];
    const highs = [];

    for (const row of rows) {
      const t = Number(row?.t ?? row?.time ?? row?.timestamp);
      if (!Number.isFinite(t) || t < minX || t > maxX) continue;

      const low = Number(row?.l ?? row?.low ?? row?.c ?? row?.close);
      const high = Number(row?.h ?? row?.high ?? row?.c ?? row?.close);

      if (this._yViewport.isLog()) {
        if (Number.isFinite(low) && low > 0) lows.push(low);
        if (Number.isFinite(high) && high > 0) highs.push(high);
      } else {
        if (Number.isFinite(low)) lows.push(low);
        if (Number.isFinite(high)) highs.push(high);
      }
    }

    if (!lows.length || !highs.length) return false;

    const min = Math.min(...lows);
    const max = Math.max(...highs);
    const fitted = this._yViewport.fit(min, max, 0.05);
    const clamped = this._yViewport.clamp(fitted, this._yBounds);

    yOptions.min = clamped.min;
    yOptions.max = clamped.max;
    this.chart.update('none');
    return true;
  }

  reset() {
    if (!this.chart?.resetZoom) return false;

    this.chart.resetZoom();

    const y = this.chart.options?.scales?.y;
    if (y) {
      delete y.min;
      delete y.max;
    }

    this.chart.update('none');
    this._captureBounds();
    this._captureYBounds();
    return true;
  }

  getState() {
    const xScale = this.chart?.scales?.x;
    const yOptions = this.chart?.options?.scales?.y;
    if (!xScale) return null;

    const state = {
      x: { min: xScale.min, max: xScale.max }
    };

    const yMin = Number(yOptions?.min);
    const yMax = Number(yOptions?.max);
    if (Number.isFinite(yMin) && Number.isFinite(yMax) && yMax > yMin) {
      state.y = { min: yMin, max: yMax };
    }

    return state;
  }

  setState(state) {
    if (!this.chart || !state) return;

    if (this.chart.zoomScale) {
      const x = state.x || state;
      if (Number.isFinite(Number(x?.min)) && Number.isFinite(Number(x?.max)) && Number(x.max) > Number(x.min)) {
        this.chart.zoomScale('x', { min: Number(x.min), max: Number(x.max) }, 'none');
      }
    }

    const y = state.y;
    const yOptions = this.chart.options?.scales?.y;
    if (
      yOptions &&
      Number.isFinite(Number(y?.min)) &&
      Number.isFinite(Number(y?.max)) &&
      Number(y.max) > Number(y.min)
    ) {
      const clamped = this._yViewport.clamp(
        { min: Number(y.min), max: Number(y.max) },
        this._yBounds
      );
      yOptions.min = clamped.min;
      yOptions.max = clamped.max;
      this.chart.update('none');
    }
  }

  hardenWithoutHammer() {
    const zoom = this.chart?.options?.plugins?.zoom;
    if (zoom) {
      if (zoom.zoom?.pinch) zoom.zoom.pinch.enabled = false;
      if (zoom.pan) zoom.pan.enabled = false;
    }
  }

  _syncYViewportType() {
    const type = this.chart?.options?.scales?.y?.type;
    this._yViewport.setType(type);
  }

  _captureBounds() {
    const xScale = this.chart?.scales?.x;
    if (xScale) {
      const min = Number(xScale.min);
      const max = Number(xScale.max);
      if (Number.isFinite(min) && Number.isFinite(max) && max > min) {
        this._bounds = this._bounds
          ? { min: Math.min(this._bounds.min, min), max: Math.max(this._bounds.max, max) }
          : { min, max };
      }
    }

    this._captureYBounds();
  }

  _captureYBounds() {
    const yScale = this.chart?.scales?.y;
    if (!yScale) return;

    const min = Number(yScale.min);
    const max = Number(yScale.max);

    if (this._yViewport.validRange(min, max)) {
      this._yBounds = this._yBounds
        ? {
            min: Math.min(this._yBounds.min, min),
            max: Math.max(this._yBounds.max, max)
          }
        : { min, max };
    }
  }

  _isPriceScaleTouch(touch, canvas) {
    const rect = canvas.getBoundingClientRect();
    const chartArea = this.chart?.chartArea;
    const localX = touch.clientX - rect.left;
    const position = this.chart?.options?.scales?.y?.position || 'right';

    if (position === 'left') {
      return Number.isFinite(chartArea?.left) && localX <= chartArea.left;
    }

    return Number.isFinite(chartArea?.right) && localX >= chartArea.right;
  }

  _beginPan(touch, canvas, target = null) {
    const scale = this.chart?.scales?.x;
    if (!scale) return;

    this._syncYViewportType();

    const canvasRect = canvas.getBoundingClientRect();
    const yScale = this.chart?.scales?.y;

    this._gestureTarget =
      target === 'price-scale'
        ? 'price-scale'
        : target === 'pinch'
          ? 'pinch'
          : null;

    this._pan = {
      startX: touch.clientX,
      startY: touch.clientY,
      anchorY: touch.clientY - canvasRect.top,
      min: Number(scale.min),
      max: Number(scale.max),
      yMin: Number(yScale?.min),
      yMax: Number(yScale?.max),
      height: Number(yScale?.height) || canvasRect.height,
      width: canvasRect.width
    };
  }

  _bindTouch() {
    const canvas = this.chart?.canvas;
    if (!canvas || this._touch) return;

    this._touch = {
      start: event => {
        if (canvas.dataset.ochartDrawingMode === 'true' || canvas.dataset.ochartDrawingCapture === 'true') return;
        this._captureBounds();

        if (event.touches?.length === 1) {
          const touch = event.touches[0];
          this._beginPan(
            touch,
            canvas,
            this._isPriceScaleTouch(touch, canvas) ? 'price-scale' : 'plot'
          );
          return;
        }

        if (event.touches?.length !== 2) return;

        this._pan = null;
        this._panAxis = 'pinch';
        this._gestureTarget = 'pinch';

        const scale = this.chart?.scales?.x;
        if (!scale) return;

        const a = event.touches[0];
        const b = event.touches[1];
        const distance = Math.hypot(
          b.clientX - a.clientX,
          b.clientY - a.clientY
        );

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
        if (canvas.dataset.ochartDrawingMode === 'true' || canvas.dataset.ochartDrawingCapture === 'true') return;
        if (event.touches?.length === 1) {
          if (!this._pan) {
            this._pinchState = null;
            const touch = event.touches[0];
            this._beginPan(
              touch,
              canvas,
              this._isPriceScaleTouch(touch, canvas) ? 'price-scale' : 'plot'
            );
            return;
          }

          const t = event.touches[0];
          const dx = t.clientX - this._pan.startX;
          const dy = t.clientY - this._pan.startY;

          if (this._gestureTarget === 'price-scale') {
            this._scalePrice(t, canvas, dy, event);
            return;
          }

          if (!this._gestureTarget && Math.hypot(dx, dy) > 6) {
            this._gestureTarget =
              Math.abs(dx) >= Math.abs(dy) ? 'plot-x' : 'plot-y';
          }

          if (this._gestureTarget === 'plot-y') {
            this._panPrice(dy, event);
            return;
          }

          if (this._gestureTarget === 'plot-x') {
            this._panTime(dx, event);
            return;
          }

          return;
        }

        const state = this._pinchState;
        if (!state || event.touches?.length !== 2) return;

        const a = event.touches[0];
        const b = event.touches[1];
        const distance = Math.hypot(
          b.clientX - a.clientX,
          b.clientY - a.clientY
        );

        if (!Number.isFinite(distance) || distance <= 0) return;

        const span = state.max - state.min;
        if (!Number.isFinite(span) || span <= 0) return;

        const factor = state.distance / distance;
        const centerPixel = state.centerX - state.rect.left;
        const ratio = Math.max(
          0,
          Math.min(1, centerPixel / Math.max(1, state.rect.width))
        );

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

      end: event => {
        if (canvas.dataset.ochartDrawingMode === 'true' || canvas.dataset.ochartDrawingCapture === 'true') return;
        this._pinchState = null;
        this._panAxis = null;

        if (event?.touches?.length === 1) {
          const touch = event.touches[0];
          this._beginPan(
            touch,
            canvas,
            this._isPriceScaleTouch(touch, canvas) ? 'price-scale' : 'plot'
          );
        } else {
          this._gestureTarget = null;
          this._pan = null;
        }
      }
    };

    canvas.addEventListener('touchstart', this._touch.start, { passive: true });
    canvas.addEventListener('touchmove', this._touch.move, { passive: false });
    canvas.addEventListener('touchend', this._touch.end, { passive: true });
    canvas.addEventListener('touchcancel', this._touch.end, { passive: true });
  }

  isPriceScalePointer(ev) {
    const canvas = this.chart?.canvas;
    return !!canvas && this._isPriceScaleTouch(ev, canvas);
  }

  handlePointerDown(ev, pointers = [ev]) {
    if (!this.chart) return false;

    const canvas = this.chart.canvas;
    this._captureBounds();

    if (pointers.length >= 2) {
      const a = pointers[0];
      const b = pointers[1];
      const distance = Math.hypot(b.clientX - a.clientX, b.clientY - a.clientY);
      const scale = this.chart.scales?.x;
      if (!scale || !Number.isFinite(distance) || distance <= 0) return false;

      this._pan = null;
      this._gestureTarget = 'pinch';
      this._pinchState = {
        distance,
        min: Number(scale.min),
        max: Number(scale.max),
        centerX: (a.clientX + b.clientX) / 2,
        rect: canvas.getBoundingClientRect()
      };
      ev.preventDefault();
      return true;
    }

    const target = this._isPriceScaleTouch(ev, canvas) ? 'price-scale' : 'plot';
    this._beginPan(ev, canvas, target);
    return true;
  }

  handlePointerMove(ev, pointers = [ev]) {
    if (!this.chart) return false;

    if (pointers.length >= 2 && this._pinchState) {
      const a = pointers[0];
      const b = pointers[1];
      const state = this._pinchState;
      const distance = Math.hypot(b.clientX - a.clientX, b.clientY - a.clientY);
      if (!Number.isFinite(distance) || distance <= 0) return false;

      const span = state.max - state.min;
      if (!Number.isFinite(span) || span <= 0) return false;

      const factor = state.distance / distance;
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
      if (min < boundMin) { max += boundMin - min; min = boundMin; }
      if (max > boundMax) { min -= max - boundMax; max = boundMax; }

      min = Math.max(boundMin, min);
      max = Math.min(boundMax, max);

      ev.preventDefault();
      this.chart.zoomScale('x', { min, max }, 'none');
      return true;
    }

    if (!this._pan) return false;

    const dx = ev.clientX - this._pan.startX;
    const dy = ev.clientY - this._pan.startY;

    if (this._gestureTarget === 'price-scale') {
      this._scalePrice(ev, this.chart.canvas, dy, ev);
      return true;
    }

    if (!this._gestureTarget && Math.hypot(dx, dy) > 6) {
      this._gestureTarget = Math.abs(dx) >= Math.abs(dy) ? 'plot-x' : 'plot-y';
    }

    if (this._gestureTarget === 'plot-x') {
      this._panTime(dx, ev);
      return true;
    }

    if (this._gestureTarget === 'plot-y') {
      this._panPrice(dy, ev);
      return true;
    }

    return false;
  }

  handlePointerUp(ev, pointers = []) {
    if (pointers.length >= 1) {
      if (pointers.length === 1) {
        this._beginPan(pointers[0], this.chart.canvas, this._isPriceScaleTouch(pointers[0], this.chart.canvas) ? 'price-scale' : 'plot');
      }
      return true;
    }

    this._pinchState = null;
    this._pan = null;
    this._gestureTarget = null;
    this._panAxis = null;
    return true;
  }

  handlePointerCancel() {
    this._pinchState = null;
    this._pan = null;
    this._gestureTarget = null;
    this._panAxis = null;
  }

  _scalePrice(touch, canvas, dy, event) {
    this._syncYViewportType();

    const yScale = this.chart?.scales?.y;
    const yOptions = this.chart?.options?.scales?.y;
    if (!yScale || !yOptions) return;

    const canvasRect = canvas.getBoundingClientRect();
    const canvasLocalY = touch.clientY - canvasRect.top;
    const anchorPixel = canvasLocalY - yScale.top;
    const ratio = Math.max(
      0,
      Math.min(1, anchorPixel / Math.max(1, yScale.height))
    );

    const next = this._yViewport.scale(
      this._pan.yMin,
      this._pan.yMax,
      ratio,
      dy,
      this._pan.height
    );

    const clamped = this._yViewport.clamp(next, this._yBounds);

    yOptions.min = clamped.min;
    yOptions.max = clamped.max;

    event.preventDefault();
    this.chart.update('none');
  }

  _panTime(dx, event) {
    const span = this._pan.max - this._pan.min;
    if (!Number.isFinite(span) || span <= 0) return;

    const delta = -(dx / Math.max(1, this._pan.width)) * span;
    let min = this._pan.min + delta;
    let max = this._pan.max + delta;

    const boundMin = Number.isFinite(this._bounds?.min) ? this._bounds.min : min;
    const boundMax = Number.isFinite(this._bounds?.max) ? this._bounds.max : max;

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
  }

  _panPrice(dy, event) {
    this._syncYViewportType();

    const yOptions = this.chart?.options?.scales?.y;
    if (!yOptions) return;

    const next = this._yViewport.pan(
      this._pan.yMin,
      this._pan.yMax,
      dy,
      this._pan.height
    );

    const clamped = this._yViewport.clamp(next, this._yBounds);

    yOptions.min = clamped.min;
    yOptions.max = clamped.max;

    event.preventDefault();
    this.chart.update('none');
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
    this._panAxis = null;
    this._pan = null;
    this._gestureTarget = null;
    if (canvas) canvas.dataset.ochartDrawingCapture = 'false';
  }
}
