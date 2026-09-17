/**
 * ChartZoom — controle isolado do viewport horizontal do gráfico.
 * Não conhece dados de mercado nem regras de negócio.
 */
export class ChartZoom {
  constructor(chart = null) {
    this.chart = chart;
  }

  attach(chart) {
    this.chart = chart;
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
    const hasHammer = typeof window !== 'undefined'
      && !!(window.Hammer && window.Hammer.Manager);
    const zoom = this.chart?.options?.plugins?.zoom;

    if (zoom && !hasHammer) {
      if (zoom.zoom?.pinch) zoom.zoom.pinch.enabled = false;
      if (zoom.pan) zoom.pan.enabled = false;
    }
  }
}
