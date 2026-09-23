/**
 * ChartZoom — controle isolado do viewport horizontal do gráfico.
 * Zoom por gesto de dois dedos é tratado aqui para não depender de Hammer.js.
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
    this._captureBounds();
    this._bindTouch();
    return this;
  }

  /**
   * Chame isto sempre que os dados subjacentes mudarem (novos candles,
   * troca de timeframe, etc.) para que os limites de pan/zoom acompanhem
   * o intervalo real dos dados em vez de ficarem presos ao valor
   * capturado em attach().
   *
   * Sem argumentos: relê os limites a partir da escala atual (só é
   * confiável se o gráfico estiver totalmente "zoomed out" no momento
   * da chamada). Com argumentos: define os limites explicitamente a
   * partir do intervalo real dos dados — preferível.
   */
  refreshBounds(xMin, xMax) {
    if (xMin !== undefined && xMax !== undefined) {
      this._bounds = { min: Number(xMin), max: Number(xMax) };
      return;
    }
    this._captureBounds();
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

  _captureBounds() {
    const xScale = this.chart?.scales?.x;
    if (xScale) {
      const min = Number(xScale.min);
      const max = Number(xScale.max);
      // Amplia em vez de substituir, para nunca perder um intervalo já
      // conhecido caso a captura ocorra enquanto o gráfico está com zoom.
      this._bounds = this._bounds
        ? { min: Math.min(this._bounds.min, min), max: Math.max(this._bounds.max, max) }
        : { min, max };
    }

    const yScale = this.chart?.scales?.y;
    if (yScale) {
      const min = Number(yScale.min);
      const max = Number(yScale.max);
      if (Number.isFinite(min) && Number.isFinite(max)) {
        this._yBounds = { min, max };
      }
    }
  }

  _bindTouch() {
    const canvas = this.chart?.canvas;
    if (!canvas || this._touch) return;

    this._touch = {
      start: event => {
        // Amplia os limites com o que a escala souber agora — cobre o
        // caso de dados novos terem chegado desde o último attach().
        this._captureBounds();

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
          // Transição de 2 dedos -> 1 dedo em pleno gesto: inicia um
          // novo pan imediatamente em vez de esperar touchend/touchstart,
          // para o gesto não "cair" no meio do movimento.
          if (!this._pan) {
            this._pinchState = null;
            this._beginPan(event.touches[0], canvas);
            return;
          }

          const t = event.touches[0];

          const dx = t.clientX - this._pan.startX;
          const dy = t.clientY - this._pan.startY;

          if (!this._panAxis && Math.hypot(dx, dy) > 6) {
            this._panAxis =
              Math.abs(dy) > Math.abs(dx) ? 'y' : 'x';
          }

          /*
           * EIXO VERTICAL — PREÇO
           */
          if (this._panAxis === 'y') {
            const span = this._pan.yMax - this._pan.yMin;

            if (!Number.isFinite(span) || span <= 0) return;

            const delta =
              -(dy / Math.max(1, this._pan.height)) * span;

            let min = this._pan.yMin + delta;
            let max = this._pan.yMax + delta;

            const yScale = this.chart?.scales?.y;
            if (!yScale) return;

            const yOptions = this.chart?.options?.scales?.y;
            if (!yOptions) return;

            // Limita o pan vertical a uma janela generosa em torno do
            // range inicial (capturado em attach/_captureBounds), para
            // não deixar o usuário arrastar o preço para valores
            // arbitrariamente distantes ou negativos sem limite.
            if (this._yBounds) {
              const boundSpan = this._yBounds.max - this._yBounds.min;
              const slack = Math.max(boundSpan, span) * 2;
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

          const delta =
            -(dx / Math.max(1, this._pan.width)) * span;

          let min = this._pan.min + delta;
          let max = this._pan.max + delta;

          const boundMin =
            Number.isFinite(this._bounds?.min)
              ? this._bounds.min
              : min;

          const boundMax =
            Number.isFinite(this._bounds?.max)
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

          this.chart.zoomScale(
            'x',
            { min, max },
            'none'
          );

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

        const centerPixel =
          state.centerX - state.rect.left;

        const ratio =
          Math.max(
            0,
            Math.min(
              1,
              centerPixel /
                Math.max(1, state.rect.width)
            )
          );

        const centerValue =
          state.min +
          (state.max - state.min) * ratio;

        let min =
          centerValue -
          (centerValue - state.min) * factor;

        let max =
          centerValue +
          (state.max - centerValue) * factor;

        const boundMin =
          Number.isFinite(this._bounds?.min)
            ? this._bounds.min
            : state.min;

        const boundMax =
          Number.isFinite(this._bounds?.max)
            ? this._bounds.max
            : state.max;

        const minSpan =
          Math.max(
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

        this.chart.zoomScale(
          'x',
          { min, max },
          'none'
        );
      },

      end: event => {
        this._pinchState = null;
        this._panAxis = null;

        // Se ainda sobra um dedo na tela (saiu de 2 para 1), retoma o
        // pan a partir da posição atual desse dedo em vez de zerar tudo.
        if (event?.touches?.length === 1) {
          this._beginPan(event.touches[0], canvas);
        } else {
          this._pan = null;
        }
      }
    };

    canvas.addEventListener(
      'touchstart',
      this._touch.start,
      { passive: true }
    );

    canvas.addEventListener(
      'touchmove',
      this._touch.move,
      { passive: false }
    );

    canvas.addEventListener(
      'touchend',
      this._touch.end,
      { passive: true }
    );

    canvas.addEventListener(
      'touchcancel',
      this._touch.end,
      { passive: true }
    );
  }

  _beginPan(touch, canvas) {
    const scale = this.chart?.scales?.x;
    if (!scale) return;

    this._pan = {
      startX: touch.clientX,
      startY: touch.clientY,
      min: Number(scale.min),
      max: Number(scale.max),
      yMin: Number(this.chart?.scales?.y?.min),
      yMax: Number(this.chart?.scales?.y?.max),
      height: canvas.getBoundingClientRect().height,
      width: canvas.getBoundingClientRect().width
    };
  }

  _detachTouch() {
    const canvas = this.chart?.canvas;

    if (!canvas || !this._touch) return;

    canvas.removeEventListener(
      'touchstart',
      this._touch.start
    );

    canvas.removeEventListener(
      'touchmove',
      this._touch.move
    );

    canvas.removeEventListener(
      'touchend',
      this._touch.end
    );

    canvas.removeEventListener(
      'touchcancel',
      this._touch.end
    );

    this._touch = null;
    this._pinchState = null;
    this._panAxis = null;
    this._pan = null;
  }
}
