/**
 * Dataset factory.
 * Transforma o estado normalizado do OChart em datasets Chart.js.
 */
import { sma, ema } from '../utils/indicators.js';

const OVERLAY_COLORS = {
  20: '#3b82f6',
  50: '#10b981',
  100: '#f59e0b',
  200: '#ef4444'
};

export function createPriceDataset(rows, type = 'line') {
  if (type === 'candlestick') {
    return {
      type: 'candlestick',
      label: 'Preço',
      data: rows.map(d => ({
        x: d.t ?? d.time,
        o: d.o ?? d.open ?? 0,
        h: d.h ?? d.high ?? 0,
        l: d.l ?? d.low ?? 0,
        c: d.c ?? d.close ?? 0
      })),
      borderColor: {
        up: '#10b981', down: '#ef4444', unchanged: '#6b7280'
      },
      backgroundColor: {
        up: 'rgba(16, 185, 129, 0.5)',
        down: 'rgba(239, 68, 68, 0.5)',
        unchanged: 'rgba(107, 114, 128, 0.5)'
      }
    };
  }

  return {
    type: 'line',
    label: 'Close',
    data: rows.map(d => ({
      x: d.t ?? d.time,
      y: d.c ?? d.close ?? 0
    })),
    pointRadius: 0,
    borderWidth: 2,
    borderColor: '#3b82f6',
    backgroundColor: 'rgba(59, 130, 246, 0.1)'
  };
}

export function createOverlayDatasets(rows, overlays = []) {
  const closes = rows.map(d => d.c ?? d.close);

  return overlays.map(overlay => {
    const values = overlay.type === 'EMA'
      ? ema(closes, overlay.period)
      : sma(closes, overlay.period);

    const data = values.map((y, i) => {
      if (!Number.isFinite(y)) return null;
      return { x: rows[i].t ?? rows[i].time, y };
    }).filter(Boolean);

    return {
      type: 'line',
      label: `${overlay.type}${overlay.period}`,
      data,
      borderWidth: 1.5,
      pointRadius: 0,
      tension: 0.15,
      borderColor: overlay.color || OVERLAY_COLORS[overlay.period] || '#6b7280'
    };
  });
}

export function createDatasets(rows, config = {}, overlays = []) {
  return [
    createPriceDataset(rows, config.type),
    ...createOverlayDatasets(rows, overlays)
  ];
}
