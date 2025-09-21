// Registro otimizado de plugins (UMD)
(function ensurePlugins(){
  if (typeof Chart === 'undefined') {
    console.error("⚠️ Chart.js não foi carregado!");
    return;
  }

  const plugins = [
    { name: 'chartjs-plugin-zoom', global: 'ChartZoom', register: (p) => Chart.register(p) },
    { name: 'chartjs-plugin-annotation', global: 'chartjs-plugin-annotation', register: (p) => Chart.register(p) }
  ];

  plugins.forEach(({ name, global, register }) => {
    if (window[global]) {
      register(window[global]);
      console.log(`✅ ${name} registrado`);
    } else {
      console.warn(`⚠️ ${name} não encontrado em window.${global}`);
    }
  });

  // Financial (candlestick/ohlc) - O plugin se auto-registra ao carregar
  // Verificação silenciosa - se funcionar, está ok
  setTimeout(() => {
    try {
      // Testa se consegue criar um gráfico candlestick temporário
      const testCanvas = document.createElement('canvas');
      const testCtx = testCanvas.getContext('2d');
      const testChart = new Chart(testCtx, {
        type: 'candlestick',
        data: { datasets: [{ data: [] }] }
      });
      testChart.destroy();
      console.log("✅ chartjs-chart-financial registrado e funcionando");
    } catch (e) {
      // Só avisa se realmente não funcionar
      if (!Chart.registry?.controllers?.candlestick) {
        console.warn("⚠️ chartjs-chart-financial pode não estar disponível");
      }
    }
  }, 500);
})();

/**
 * ChartEngine - Motor de renderização de gráficos financeiros
 * Gerencia a criação, atualização e interação com gráficos Chart.js
 */
export class ChartEngine {
  constructor(canvasEl) {
    if (!canvasEl) throw new Error('Canvas element é obrigatório');
    
    this.canvas = canvasEl;
    this.chart = null;
    this.currentData = [];
    this.currentConfig = { 
      type: 'line', 
      scale: 'logarithmic', 
      showVolume: false,
      animationDuration: 0
    };
    this.callbacks = { 
      onZoom: null, 
      onPan: null, 
      onDataClick: null, 
      onReset: null 
    };
    this._overlays = []; 
    this._drawings = [];
    this._cache = new Map();
  }

  create(data, config = {}) {
    this._cleanupOrphanChart();
    
    this.destroy();
    this.currentConfig = { ...this.currentConfig, ...config };
    this.currentData = this._validateData(data);

    try {
      const cfg = this._buildChartConfig(
        this._datasetFromState(),
        this._maDatasets(),
        this._annotations()
      );

      const ctx = this.canvas.getContext('2d');
      this.chart = new Chart(ctx, cfg);
      
      this._applyCustomStyles();
      return this.chart;
    } catch (error) {
      console.error('Erro ao criar gráfico:', error);
      throw error;
    }
  }

  update(data) {
    if (!this.chart) {
      console.warn('Nenhum gráfico existe para atualizar');
      return;
    }
    
    this.currentData = this._validateData(data);
    
    this.chart.data.datasets = [
      ...this._datasetFromState(), 
      ...this._maDatasets()
    ];
    
    if (this.chart.options.scales.y) {
      this.chart.options.scales.y.type = this._getScaleType();
    }
    
    if (!this.chart.options.plugins.annotation) {
      this.chart.options.plugins.annotation = {};
    }
    this.chart.options.plugins.annotation.annotations = this._annotations();
    
    this.chart.update('none');
  }

  destroy() {
    if (this.chart) {
      this.chart.destroy();
      this.chart = null;
      this._cache.clear();
    }
  }

  setScale(scale) {
    if (!this.chart) return;
    
    if (scale === 'logarithmic') {
      const hasInvalidValues = this.currentData.some(d => {
        const close = d.c ?? d.close ?? 0;
        return close <= 0;
      });
      
      if (hasInvalidValues) {
        console.warn('Dados contêm valores <= 0, usando escala linear');
        scale = 'linear';
      }
    }
    
    this.currentConfig.scale = scale;
    this.chart.options.scales.y.type = scale;
    this.chart.update();
  }

  setType(type) {
    if (!this.canvas) return;
    
    const validType = type === 'candlestick' ? 'candlestick' : 'line';
    const zoomState = this.getZoomState();
    const data = [...this.currentData];
    const config = { ...this.currentConfig, type: validType };
    
    try {
      this.create(data, config);
      
      if (zoomState) {
        this.setZoomState(zoomState);
      }
    } catch (error) {
      console.error('Erro ao mudar tipo, voltando para linha:', error);
      this.create(data, { ...config, type: 'line' });
    }
  }

  resetZoom() {
    if (this.chart?.resetZoom) {
      this.chart.resetZoom();
      this.callbacks.onReset?.();
    }
  }

  on(event, callback) {
    if (event in this.callbacks) {
      this.callbacks[event] = callback;
    }
  }

  setOverlays(overlays) {
    this._overlays = Array.isArray(overlays) ? overlays : [];
    this._cache.delete('ma_datasets');
    this.update(this.currentData);
  }

  setDrawings(drawings) {
    this._drawings = Array.isArray(drawings) ? drawings : [];
    this.update(this.currentData);
  }

  getZoomState() {
    const scale = this.chart?.scales?.x;
    return scale ? { min: scale.min, max: scale.max } : null;
  }

  setZoomState(state) {
    if (!this.chart || !state) return;
    
    if (this.chart.zoomScale) {
      this.chart.zoomScale('x', { min: state.min, max: state.max });
    }
  }

  // === Métodos Privados ===

  _cleanupOrphanChart() {
    if (typeof Chart !== 'undefined' && Chart.getChart) {
      const orphan = Chart.getChart(this.canvas);
      if (orphan) {
        try {
          orphan.destroy();
        } catch (error) {
          console.warn('Erro ao limpar gráfico órfão:', error);
        }
      }
    }
  }

  _validateData(data) {
    if (!Array.isArray(data)) {
      console.warn('Dados inválidos, esperado Array');
      return [];
    }
    return data;
  }

  _getScaleType() {
    return this.currentConfig.scale === 'logarithmic' ? 'logarithmic' : 'linear';
  }

  _applyCustomStyles() {
    if (this.chart?.canvas) {
      this.chart.canvas.style.cursor = 'crosshair';
    }
  }

  _maDatasets() {
    const cacheKey = 'ma_datasets';
    if (this._cache.has(cacheKey)) {
      return this._cache.get(cacheKey);
    }

    const overlays = this._overlays || [];
    const closes = this.currentData.map(d => d.c ?? d.close);
    const datasets = [];

    for (const overlay of overlays) {
      const values = overlay.type === 'EMA' 
        ? ema(closes, overlay.period) 
        : sma(closes, overlay.period);
      
      const data = values
        .map((y, i) => {
          if (!Number.isFinite(y)) return null;
          return {
            x: this.currentData[i].t ?? this.currentData[i].time,
            y
          };
        })
        .filter(Boolean);

      datasets.push({
        type: 'line',
        label: `${overlay.type}${overlay.period}`,
        data,
        borderWidth: 1.5,
        pointRadius: 0,
        tension: 0.15,
        borderColor: overlay.color || this._getOverlayColor(overlay.type, overlay.period)
      });
    }

    this._cache.set(cacheKey, datasets);
    return datasets;
  }

  _getOverlayColor(type, period) {
    const colors = {
      20: '#3b82f6',
      50: '#10b981',
      100: '#f59e0b',
      200: '#ef4444'
    };
    return colors[period] || '#6b7280';
  }

  _annotations() {
    const annotations = {};
    const drawings = this._drawings || [];

    for (const drawing of drawings) {
      switch (drawing.type) {
        case 'hline':
          annotations[drawing.id] = {
            type: 'line',
            yMin: drawing.y,
            yMax: drawing.y,
            borderWidth: 1.2,
            borderColor: drawing.color || '#6b7280',
            borderDash: drawing.dash || [5, 5]
          };
          break;
        
        case 'trend':
          annotations[drawing.id] = {
            type: 'line',
            xMin: drawing.x1,
            xMax: drawing.x2,
            yMin: drawing.y1,
            yMax: drawing.y2,
            borderWidth: 1.2,
            borderColor: drawing.color || '#6b7280'
          };
          break;
        
        default:
          console.warn(`Tipo de desenho desconhecido: ${drawing.type}`);
      }
    }

    return annotations;
  }

  _datasetFromState() {
    if (this.currentConfig.type === 'candlestick') {
      return [{
        type: 'candlestick',
        label: 'Preço',
        data: this.currentData.map(d => ({
          x: d.t ?? d.time,
          o: d.o ?? d.open ?? 0,
          h: d.h ?? d.high ?? 0,
          l: d.l ?? d.low ?? 0,
          c: d.c ?? d.close ?? 0
        })),
        borderColor: {
          up: '#10b981',
          down: '#ef4444',
          unchanged: '#6b7280'
        },
        backgroundColor: {
          up: 'rgba(16, 185, 129, 0.5)',
          down: 'rgba(239, 68, 68, 0.5)',
          unchanged: 'rgba(107, 114, 128, 0.5)'
        }
      }];
    }

    return [{
      type: 'line',
      label: 'Close',
      data: this.currentData.map(d => ({
        x: d.t ?? d.time,
        y: d.c ?? d.close ?? 0
      })),
      pointRadius: 0,
      borderWidth: 2,
      borderColor: '#3b82f6',
      backgroundColor: 'rgba(59, 130, 246, 0.1)'
    }];
  }

  _buildChartConfig(series, maSeries, annotations) {
    return {
      type: this.currentConfig.type === 'candlestick' ? 'candlestick' : 'line',
      data: { 
        datasets: [...series, ...maSeries] 
      },
      options: {
        parsing: false,
        responsive: true,
        maintainAspectRatio: false,
        normalized: true,
        animation: {
          duration: this.currentConfig.animationDuration || 0
        },

        interaction: { 
          mode: 'index', 
          intersect: false,
          axis: 'x'
        },

        scales: {
          x: {
            type: 'time',
            time: { 
              unit: 'day',
              displayFormats: {
                hour: 'HH:mm',
                day: 'MMM dd',
                week: 'MMM dd',
                month: 'MMM yyyy'
              }
            },
            ticks: { 
              maxRotation: 0,
              autoSkip: true,
              autoSkipPadding: 50
            },
            grid: {
              display: true,
              drawBorder: false,
              color: 'rgba(255, 255, 255, 0.04)'
            }
          },
          y: {
            type: this._getScaleType(),
            position: 'right',
            grid: {
              display: true,
              drawBorder: false,
              color: 'rgba(255, 255, 255, 0.04)'
            },
            ticks: {
              callback: function(value) {
                // Formata valores sem casas decimais
                if (value >= 1000000) {
                  return '$' + Math.round(value / 1000000) + 'M';
                } else if (value >= 1000) {
                  return '$' + Math.round(value / 1000) + 'K';
                }
                return '$' + Math.round(value);
              }
            }
          }
        },

        plugins: {
          legend: { 
            display: true,
            position: 'top',
            labels: {
              usePointStyle: true,
              padding: 15
            }
          },

          tooltip: {
            enabled: true,
            mode: 'index',
            intersect: false,
            position: 'nearest',
            callbacks: {
              title: (items) => {
                if (!items.length) return '';
                const date = new Date(items[0].parsed.x);
                return date.toLocaleDateString('pt-BR', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                });
              },
              label: (ctx) => {
                const label = ctx.dataset.label || '';
                const value = ctx.parsed.y;
                
                // Para candlestick, mostra OHLC sem decimais
                if (ctx.dataset.type === 'candlestick' && ctx.raw) {
                  const { o, h, l, c } = ctx.raw;
                  return [
                    `Open: $${Math.round(o).toLocaleString()}`,
                    `High: $${Math.round(h).toLocaleString()}`,
                    `Low: $${Math.round(l).toLocaleString()}`,
                    `Close: $${Math.round(c).toLocaleString()}`
                  ];
                }
                
                // Para linhas e MAs, também sem decimais
                return `${label}: $${Math.round(value).toLocaleString()}`;
              }
            }
          },

          zoom: {
            limits: {
              x: { min: 'original', max: 'original' },
              y: { min: 'original', max: 'original' }
            },
            pan: {
              enabled: true,
              mode: 'x',
              modifierKey: null,
              onPan: () => this.callbacks.onPan?.()
            },
            zoom: {
              wheel: { 
                enabled: true,
                speed: 0.1
              },
              pinch: { 
                enabled: true 
              },
              drag: {
                enabled: true,
                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                borderColor: 'rgba(59, 130, 246, 0.5)',
                borderWidth: 1
              },
              mode: 'x',
              onZoom: () => this.callbacks.onZoom?.()
            }
          },

          annotation: { 
            annotations 
          }
        },

        onClick: (event, elements) => {
          if (elements?.length && this.callbacks.onDataClick) {
            const index = elements[0].index;
            this.callbacks.onDataClick({
              index,
              row: this.currentData[index],
              event
            });
          }
        },

        onHover: (event, elements) => {
          if (this.chart?.canvas) {
            this.chart.canvas.style.cursor = elements.length > 0 ? 'pointer' : 'crosshair';
          }
        }
      }
    };
  }
}

// === Funções de Médias Móveis ===

export function sma(values, period) {
  if (!Array.isArray(values) || period <= 0) {
    return [];
  }

  const output = new Array(values.length).fill(undefined);
  let sum = 0;
  const queue = [];

  for (let i = 0; i < values.length; i++) {
    const value = Number(values[i]);
    
    if (!Number.isFinite(value)) {
      queue.length = 0;
      sum = 0;
      continue;
    }

    queue.push(value);
    sum += value;

    if (queue.length > period) {
      sum -= queue.shift();
    }

    if (queue.length === period) {
      output[i] = sum / period;
    }
  }

  return output;
}

export function ema(values, period) {
  if (!Array.isArray(values) || period <= 0) {
    return [];
  }

  const output = new Array(values.length).fill(undefined);
  const multiplier = 2 / (period + 1);
  let previousEMA;

  for (let i = 0; i < values.length; i++) {
    const value = Number(values[i]);
    
    if (!Number.isFinite(value)) {
      previousEMA = undefined;
      continue;
    }

    if (previousEMA === undefined) {
      previousEMA = value;
    } else {
      previousEMA = (value * multiplier) + (previousEMA * (1 - multiplier));
    }

    output[i] = previousEMA;
  }

  return output;
}