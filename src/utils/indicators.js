/**
 * indicators.js
 * -------------
 * Pequenas utilidades de indicadores para uso no ChartEngine e fora dele.
 */

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
