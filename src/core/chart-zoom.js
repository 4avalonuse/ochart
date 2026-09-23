/**
 * ChartZoom — controle isolado do viewport do gráfico.
 *
 * Gestos:
 * - 1 dedo horizontal = navegação temporal
 * - 1 dedo vertical = navegação de preço
 * - 2 dedos = zoom temporal
 *
 * O ChartZoom não descobre limites de dados sozinho. O ChartEngine
 * fornece os bounds reais do dataset sempre que os dados mudam.
 */
export class ChartZoom {
  constructor(chart = null) {
    this.chart = chart;
    this._touch = null;
    this._pan = null;
    this._panAxis = null;
    this._bounds = null;
    this._yBounds = null;
  }

  attach(chart) {
    this._detachTouch();
    this.chart = chart;
    this._bounds = null;
    this._yBounds = null;
    this._captureScaleBounds();
    this._bindTouch();
    return this;
  }

  /**
   * Atualiza os limites reais do dataset.
   * Preferível passar os quatro valores explicitamente.
   */
  refreshBounds(xMin, xMax, yMin, yMax) {
    const hasX = Number.isFinite(Number(xMin)) && Number.isFinite(Number(xMax));
    const hasY = Number.isFinite(Number(yMin)) && Number.isFinite(Number(yMax));

    if (hasX && Number(xMax) > Number(xMin)) {
      this._bounds = {
        min: Number(xMin),
        max: Number(xMax)
      };
    }

    if (hasY && Number(yMax) > Number(yMin)) {
      this._yBounds = {
        min: Number(yMin),
        max: Number(yMax)
      };
    }

    if (!hasX || !hasY) this._captureScaleBounds();
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

    // Os bounds do dataset continuam sendo os limites de navegação.
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

  _captureScaleBounds() {
    const xScale = this.chart?.scales?.x;
    if (xScale && !this._bounds) {
      const min = Number(xScale.min);
      const max = Number(xScale.max);
      if (Number.isFinite(min) && Number.isFinite(max) && max > min) {
        this._bounds = { min, max };
      }
    }

    const yScale = this.chart?.scales?.y;
    if (yScale && !this._yBounds) {
      const min = Number(yScale.min);
      const max = Number(yScale.max);
      if (Number.isFinite(min) && Number.isFinite(max) && max > min) {
        this._yBounds = { min, max };
      }
    }
  }

  _bindTouch() {
    const canvas = this.chart?.canvas;
    if (!canvas || this._touch) return;

    this._touch = {
      start: event => {
        if (event.touches?.length === 1) {
          this._beginPan(event.touches[0], canvas);
          return;
        }

        if (event.touches?.length !== 2) return;

        this._pan = null;
        this._panAxis = null;

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
        if (event.touches?.length === 1) {
          // Transição de 2 dedos -> 1 dedo.
          if (!this._pan) {
            this._pinchState = null;
            this._beginPan(event.touches[0], canvas);
            return;
          }

          const t = event.touches[0];
          const dx = t.clientX - this._pan.startX;
          const dy = t.clientY - this._pan.startY;

          if (!this._panAxis && Math.hypot(dx, dy) > 6) {
            this._panAxis = Math.abs(dy) > Math.abs(dx) ? 'y' : 'x';
          }

          /*
           * EIXO VERTICAL — PREÇO
           */
          if (this._panAxis === 'y') {
            const span = this._pan.yMax - this._pan.yMin;
            if (!Number.isFinite(span) || span <= 0) return;

            const delta = -(dy / Math.max(1, this._pan.height)) * span;

            let min = this._pan.yMin + delta;
            let max = this._pan.yMax + delta;

            const yScale = this.chart?.scales?.y;
            const yOptions = this.chart?.options?.scales?.y;
            if (!yScale || !yOptions) return;

            // O usuário pode navegar livremente dentro de uma janela
            // controlada ao redor do range real dos dados.
            if (this._yBounds) {
              const dataSpan = this._yBounds.max - this._yBounds.min;
              const slack = Math.max(dataSpan, span) * 2;
              const floor = this._yBounds.min - slack;
              const ceil = this._yBounds.max + slack;

              if (min < floor) {
                max += floor - min;
                min = floor;
              }

              if (max > ceil) {
                min -= max - ceil;
                max = ceil;
              }

              min = Math.max(floor, min);
              max = Math.min(ceil, max);
            }

            yOptions.min = min;
            yOptions.max = max;

            event.preventDefault();
            this.chart.update('none');
            return;
          }

          /*
           * EIXO HORIZONTAL — TEMPO
           */
          const span = this._pan.max - this._pan.min;
          if (!Number.isFinite(span) || span <= 0) return;

          const delta = -(dx / Math.max(1, this._pan.width)) * span;

          let min = this._pan.min + delta;
          let max = this._pan.max + delta;

          const boundMin = Number.isFinite(this._bounds?.min)
            ? this._bounds.min
            : min;

          const boundMax = Number.isFinite(this._bounds?.max)
            ? this._bounds.max
            : max;

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
          return;
        }

        /*
         * ZOOM — DOIS DEDOS
         */
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
        const ratio = Math.max(
          0,
          Math.min(1, centerPixel / Math.max(1, state.rect.width))
        );

        const centerValue =
          state.min + (state.max - state.min) * ratio;

        let min =
          centerValue -
          (centerValue - state.min) * factor;

        let max =
          centerValue +
          (state.max - centerValue) * factor;

        const boundMin = Number.isFinite(this._bounds?.min)
          ? this._bounds.min
          : state.min;

        const boundMax = Number.isFinite(this._bounds?.max)
          ? this._bounds.max
          : state.max;

        const minSpan = Math.max(
          (boundMax - boundMin) / 10000,
          1
        );

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
        this._pinchState = null;
        this._panAxis = null;

        if (event?.touches?.length === 1) {
          this._beginPan(event.touches[0], canvas);
        } else {
          this._pan = null;
        }
      }
    };

    canvas.addEventListener('touchstart', this._touch.start, { passive: true });
    canvas.addEventListener('touchmove', this._touch.move, { passive: false });
    canvas.addEventListener('touchend', this._touch.end, { passive: true });
    canvas.addEventListener('touchcancel', this._touch.end, { passive: true });
  }

  _beginPan(touch, canvas) {
    const scale = this.chart?.scales?.x;
    const yScale = this.chart?.scales?.y;
    if (!scale || !yScale) return;

    const rect = canvas.getBoundingClientRect();

    this._pan = {
      startX: touch.clientX,
      startY: touch.clientY,
      min: Number(scale.min),
      max: Number(scale.max),
      yMin: Number(yScale.min),
      yMax: Number(yScale.max),
      height: rect.height,
      width: rect.width
    };
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
  }
}
