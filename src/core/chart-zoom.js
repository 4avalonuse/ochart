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
    this._gestureTarget = null;
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

  /**
   * Enquadra somente os preços do período atualmente visível,
   * preservando exatamente o zoom temporal (X).
   */
  fitVisiblePriceScale() {
    if (!this.chart) return false;

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
      if (Number.isFinite(low)) lows.push(low);
      if (Number.isFinite(high)) highs.push(high);
    }

    if (!lows.length || !highs.length) return false;

    let min = Math.min(...lows);
    let max = Math.max(...highs);
    if (!Number.isFinite(min) || !Number.isFinite(max)) return false;

    if (this.chart.options.scales.y.type === 'logarithmic') {
      const positiveLows = lows.filter(value => value > 0);
      const positiveHighs = highs.filter(value => value > 0);
      if (!positiveLows.length || !positiveHighs.length) return false;
      min = Math.min(...positiveLows);
      max = Math.max(...positiveHighs);
      const ratio = Math.max(1.005, Math.pow(Math.max(max / min, 1.005), 0.05));
      min /= ratio;
      max *= ratio;
    } else {
      const span = Math.max(max - min, Math.abs(max) * 0.001, 1e-9);
      const padding = span * 0.05;
      min -= padding;
      max += padding;
    }

    if (!(max > min)) return false;

    yOptions.min = min;
    yOptions.max = max;
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
          const touch = event.touches[0];
          const rect = canvas.getBoundingClientRect();
          const yScale = this.chart?.scales?.y;
          const chartArea = this.chart?.chartArea;
          const localX = touch.clientX - rect.left;
          const yPosition = this.chart?.options?.scales?.y?.position || 'right';

          // O eixo Y fica fora da área útil do plot. Usamos o chartArea
          // para separar claramente "arrastar gráfico" de "alterar escala".
          const inPriceScale =
            yPosition === 'left'
              ? Number.isFinite(chartArea?.left) && localX <= chartArea.left
              : Number.isFinite(chartArea?.right) && localX >= chartArea.right;

          this._beginPan(
            touch,
            canvas,
            inPriceScale ? 'price-scale' : 'plot'
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
            const touch = event.touches[0];
            const rect = canvas.getBoundingClientRect();
            const chartArea = this.chart?.chartArea;
            const yPosition = this.chart?.options?.scales?.y?.position || 'right';
            const localX = touch.clientX - rect.left;
            const inPriceScale =
              yPosition === 'left'
                ? Number.isFinite(chartArea?.left) && localX <= chartArea.left
                : Number.isFinite(chartArea?.right) && localX >= chartArea.right;
            this._beginPan(touch, canvas, inPriceScale ? 'price-scale' : 'plot');
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

          /*
           * EIXO VERTICAL — ESCALA DE PREÇO
           *
           * Aqui o gesto não "arrasta" o preço. O ponto onde o dedo
           * começou vira a âncora e o movimento abre/fecha a escala de
           * forma contínua. Isso deixa o gesto mais parecido com ajustar
           * uma régua de preço do que empurrar o gráfico para cima/baixo.
           */
          if (this._gestureTarget === 'plot-y') {
            this._panPrice(dy, event);
            return;
          }

          if (this._gestureTarget === 'plot-x') {
            this._panTime(dx, event);
            return;
          }

          /*
           * EIXO HORIZONTAL — TEMPO (legado; não deve ser alcançado
           * quando o gesto já foi classificado como plot-x).
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
        this._gestureTarget = null;

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

  _beginPan(touch, canvas, target = 'plot') {
    const scale = this.chart?.scales?.x;
    if (!scale) return;

    const canvasRect = canvas.getBoundingClientRect();
    const yScale = this.chart?.scales?.y;

    this._gestureTarget = target === 'price-scale' ? 'price-scale' : null;

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

  _scalePrice(touch, canvas, dy, event) {
    const span = this._pan.yMax - this._pan.yMin;
    if (!Number.isFinite(span) || span <= 0) return;

    const yScale = this.chart?.scales?.y;
    const yOptions = this.chart?.options?.scales?.y;
    if (!yScale || !yOptions) return;

    const height = Math.max(1, this._pan.height);
    const travel = dy / height;
    const factor = Math.exp(travel * 2.2);

    const canvasRect = canvas.getBoundingClientRect();
    const canvasLocalY = touch.clientY - canvasRect.top;
    const anchorPixel = canvasLocalY - yScale.top;
    const ratio = Math.max(0, Math.min(1, anchorPixel / Math.max(1, yScale.height)));
    const anchorValue = this._pan.yMax - ratio * span;

    let newSpan = span * factor;
    if (this._yBounds) {
      const boundSpan = this._yBounds.max - this._yBounds.min;
      if (Number.isFinite(boundSpan) && boundSpan > 0) {
        newSpan = Math.max(boundSpan / 10000, Math.min(boundSpan * 8, newSpan));
      }
    }

    let min = anchorValue - (1 - ratio) * newSpan;
    let max = anchorValue + ratio * newSpan;

    if (this._yBounds) {
      const boundSpan = this._yBounds.max - this._yBounds.min;
      const slack = Math.max(boundSpan, newSpan) * 2;
      const floor = this._yBounds.min - slack;
      const ceil = this._yBounds.max + slack;

      if (min < floor) {
        const correction = floor - min;
        min += correction;
        max += correction;
      }
      if (max > ceil) {
        const correction = max - ceil;
        min -= correction;
        max -= correction;
      }
    }

    yOptions.min = min;
    yOptions.max = max;
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
    const span = this._pan.yMax - this._pan.yMin;
    if (!Number.isFinite(span) || span <= 0) return;

    const delta = -(dy / Math.max(1, this._pan.height)) * span;
    const yOptions = this.chart?.options?.scales?.y;
    if (!yOptions) return;

    let min = this._pan.yMin + delta;
    let max = this._pan.yMax + delta;

    if (this._yBounds) {
      const boundSpan = Math.max(this._yBounds.max - this._yBounds.min, span);
      const slack = boundSpan * 2;
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
    }

    yOptions.min = min;
    yOptions.max = max;
    event.preventDefault();
    this.chart.update('none');
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
