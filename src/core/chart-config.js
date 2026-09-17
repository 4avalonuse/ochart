/**
 * Configuração visual e de interação do Chart.js.
 * Não conhece carregamento, sanitização ou estado de negócio.
 */
export function buildChartConfig({ type, scale, datasets, annotations = [], callbacks = {} }) {
  const chartType = type === 'candlestick' ? 'candlestick' : 'line';
  const scaleType = scale === 'logarithmic' ? 'logarithmic' : 'linear';

  return {
    type: chartType,
    data: { datasets },
    options: {
      parsing: false,
      responsive: true,
      maintainAspectRatio: false,
      normalized: true,
      animation: { duration: 0 },
      interaction: { mode: 'index', intersect: false, axis: 'x' },
      scales: {
        x: {
          type: 'time',
          time: {
            unit: 'day',
            displayFormats: {
              hour: 'HH:mm', day: 'MMM dd', week: 'MMM dd', month: 'MMM yyyy'
            }
          },
          ticks: { maxRotation: 0, autoSkip: true, autoSkipPadding: 50 },
          grid: { display: true, drawBorder: false, color: 'rgba(255, 255, 255, 0.04)' }
        },
        y: {
          type: scaleType,
          position: 'right',
          grid: { display: true, drawBorder: false, color: 'rgba(255, 255, 255, 0.04)' },
          ticks: {
            callback(value) {
              if (value >= 1000000) return '$' + Math.round(value / 1000000) + 'M';
              if (value >= 1000) return '$' + Math.round(value / 1000) + 'K';
              return '$' + Math.round(value);
            }
          }
        }
      },
      plugins: {
        legend: {
          display: true,
          position: 'top',
          labels: { usePointStyle: true, padding: 15 }
        },
        tooltip: {
          enabled: true,
          mode: 'index',
          intersect: false,
          position: 'nearest',
          callbacks: {
            title(items) {
              if (!items.length) return '';
              return new Date(items[0].parsed.x).toLocaleDateString('pt-BR', {
                day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
              });
            },
            label(ctx) {
              const label = ctx.dataset.label || '';
              const value = ctx.parsed.y;
              if (ctx.dataset.type === 'candlestick' && ctx.raw) {
                const { o, h, l, c } = ctx.raw;
                return [
                  `Open: $${Math.round(o).toLocaleString()}`,
                  `High: $${Math.round(h).toLocaleString()}`,
                  `Low: $${Math.round(l).toLocaleString()}`,
                  `Close: $${Math.round(c).toLocaleString()}`
                ];
              }
              return `${label}: $${Math.round(value).toLocaleString()}`;
            }
          }
        },
        zoom: {
          limits: { x: { min: 'original', max: 'original' }, y: { min: 'original', max: 'original' } },
          pan: {
            enabled: false,
            mode: 'x',
            modifierKey: null,
            onPan: () => callbacks.onPan?.()
          },
          zoom: {
            wheel: { enabled: true, speed: 0.1 },
            pinch: { enabled: false },
            drag: {
              enabled: true,
              backgroundColor: 'rgba(59, 130, 246, 0.1)',
              borderColor: 'rgba(59, 130, 246, 0.5)',
              borderWidth: 1
            },
            mode: 'x',
            onZoom: () => callbacks.onZoom?.()
          }
        },
        annotation: { annotations }
      },
      onClick: (event, elements) => {
        if (elements?.length && callbacks.onDataClick) {
          const index = elements[0].index;
          callbacks.onDataClick({ index, event });
        }
      },
      onHover: (event, elements) => callbacks.onHover?.(elements)
    }
  };
}
