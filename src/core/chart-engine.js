/**
 * ChartEngine — estado e ciclo de vida do gráfico.
 * A configuração visual, datasets e zoom vivem em módulos separados.
 */
import { drawingsToAnnotations } from '../ui/annotations.js';
import { createDatasets } from './chart-datasets.js';
import { buildChartConfig } from './chart-config.js';
import { ChartZoom } from './chart-zoom.js';

export class ChartEngine {
  constructor(canvasEl) {
    if (!canvasEl) throw new Error('Canvas element é obrigatório');
    this.canvas = canvasEl;
    this.chart = null;
    this.currentData = [];
    this.currentConfig = { type: 'line', scale: 'logarithmic', showVolume: false, animationDuration: 0 };
    this.callbacks = { onZoom: null, onPan: null, onDataClick: null, onReset: null };
    this._overlays = [];
    this._drawings = [];
    this.zoom = new ChartZoom();
  }

  create(data, config = {}) {
    this._cleanupOrphanChart();
    this.destroy();
    this.currentConfig = { ...this.currentConfig, ...config };
    this.currentData = this._validateData(data);

    try {
      const chartConfig = buildChartConfig({
        type: this.currentConfig.type,
        scale: this._getScaleType(),
        datasets: createDatasets(this.currentData, this.currentConfig, this._overlays),
        annotations: drawingsToAnnotations(this._drawings),
        callbacks: {
          onZoom: () => this.callbacks.onZoom?.(),
          onPan: () => this.callbacks.onPan?.(),
          onDataClick: ({ index, event }) => this.callbacks.onDataClick?.({
            index, row: this.currentData[index], event
          }),
          onHover: elements => {
            if (this.chart?.canvas) this.chart.canvas.style.cursor = elements.length ? 'pointer' : 'crosshair';
          }
        }
      });

      this.chart = new Chart(this.canvas.getContext('2d'), chartConfig);
      this.zoom.attach(this.chart);
      this.zoom.hardenWithoutHammer();
      this.chart.update('none');
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
    this.chart.data.datasets = createDatasets(this.currentData, this.currentConfig, this._overlays);
    this.chart.options.scales.y.type = this._getScaleType();
    this.chart.options.plugins.annotation = this.chart.options.plugins.annotation || {};
    this.chart.options.plugins.annotation.annotations = drawingsToAnnotations(this._drawings);
    this.chart.update('none');
  }

  destroy() {
    if (this.chart) {
      this.chart.destroy();
      this.chart = null;
    }
    this.zoom.attach(null);
  }

  setScale(scale) {
    if (!this.chart) return;
    let next = scale === 'logarithmic' ? 'logarithmic' : 'linear';
    if (next === 'logarithmic' && this.currentData.some(d => (d.c ?? d.close ?? 0) <= 0)) {
      console.warn('Dados contêm valores <= 0, usando escala linear');
      next = 'linear';
    }
    this.currentConfig.scale = next;
    this.chart.options.scales.y.type = next;
    this.chart.update();
  }

  setType(type) {
    if (!this.canvas) return;
    const validType = type === 'candlestick' ? 'candlestick' : 'line';
    const zoomState = this.getZoomState();
    const data = [...this.currentData];
    try {
      this.create(data, { ...this.currentConfig, type: validType });
      if (zoomState) this.setZoomState(zoomState);
    } catch (error) {
      console.error('Erro ao mudar tipo, voltando para linha:', error);
      this.create(data, { ...this.currentConfig, type: 'line' });
    }
  }

  resetZoom() {
    if (this.zoom.reset()) this.callbacks.onReset?.();
  }

  on(event, callback) {
    if (event in this.callbacks) this.callbacks[event] = callback;
  }

  setOverlays(overlays) {
    this._overlays = Array.isArray(overlays) ? overlays : [];
    this.update(this.currentData);
  }

  setDrawings(drawings) {
    this._drawings = Array.isArray(drawings) ? drawings : [];
    this.update(this.currentData);
  }

  getZoomState() {
    return this.zoom.getState();
  }

  setZoomState(state) {
    this.zoom.setState(state);
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

  _cleanupOrphanChart() {
    if (typeof Chart !== 'undefined' && Chart.getChart) {
      const orphan = Chart.getChart(this.canvas);
      if (orphan) {
        try { orphan.destroy(); } catch (error) { console.warn('Erro ao limpar gráfico órfão:', error); }
      }
    }
  }

  _applyCustomStyles() {
    if (this.chart?.canvas) this.chart.canvas.style.cursor = 'crosshair';
  }
}
