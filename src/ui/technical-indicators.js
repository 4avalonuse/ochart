/**
 * Indicadores Técnicos para análise de gráficos
 * @module technical-indicators
 * Localização: src/utils/technical-indicators.js
 */

/**
 * Calcula Bollinger Bands
 * @param {Array<number>} values - Array de valores (closes)
 * @param {number} period - Período para média móvel (padrão 20)
 * @param {number} stdDev - Número de desvios padrão (padrão 2)
 * @returns {Object} { upper: Array, middle: Array, lower: Array }
 */
export function bollingerBands(values, period = 20, stdDev = 2) {
  if (!Array.isArray(values) || values.length < period) {
    return { upper: [], middle: [], lower: [] };
  }

  const middle = sma(values, period);
  const upper = new Array(values.length).fill(undefined);
  const lower = new Array(values.length).fill(undefined);

  for (let i = period - 1; i < values.length; i++) {
    // Calcula desvio padrão para janela atual
    const windowValues = values.slice(i - period + 1, i + 1);
    const mean = middle[i];
    
    if (mean === undefined) continue;

    // Desvio padrão
    const variance = windowValues.reduce((acc, val) => {
      const diff = val - mean;
      return acc + (diff * diff);
    }, 0) / period;
    
    const std = Math.sqrt(variance);
    
    upper[i] = mean + (std * stdDev);
    lower[i] = mean - (std * stdDev);
  }

  return { upper, middle, lower };
}

/**
 * Calcula RSI (Relative Strength Index)
 * @param {Array<number>} values - Array de valores (closes)
 * @param {number} period - Período (padrão 14)
 * @returns {Array<number>} Array com valores RSI
 */
export function rsi(values, period = 14) {
  if (!Array.isArray(values) || values.length < period + 1) {
    return [];
  }

  const rsiValues = new Array(values.length).fill(undefined);
  let gains = 0;
  let losses = 0;

  // Calcula média inicial de ganhos e perdas
  for (let i = 1; i <= period; i++) {
    const change = values[i] - values[i - 1];
    if (change > 0) {
      gains += change;
    } else {
      losses -= change; // Torna positivo
    }
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;

  // Primeiro RSI
  const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
  rsiValues[period] = 100 - (100 / (1 + rs));

  // Calcula RSI usando média móvel exponencial
  for (let i = period + 1; i < values.length; i++) {
    const change = values[i] - values[i - 1];
    const gain = change > 0 ? change : 0;
    const loss = change < 0 ? -change : 0;

    avgGain = ((avgGain * (period - 1)) + gain) / period;
    avgLoss = ((avgLoss * (period - 1)) + loss) / period;

    const newRs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    rsiValues[i] = 100 - (100 / (1 + newRs));
  }

  return rsiValues;
}

/**
 * Calcula MACD (Moving Average Convergence Divergence)
 * @param {Array<number>} values - Array de valores (closes)
 * @param {number} fastPeriod - Período rápido (padrão 12)
 * @param {number} slowPeriod - Período lento (padrão 26)
 * @param {number} signalPeriod - Período do sinal (padrão 9)
 * @returns {Object} { macd: Array, signal: Array, histogram: Array }
 */
export function macd(values, fastPeriod = 12, slowPeriod = 26, signalPeriod = 9) {
  if (!Array.isArray(values) || values.length < slowPeriod) {
    return { macd: [], signal: [], histogram: [] };
  }

  const emaFast = ema(values, fastPeriod);
  const emaSlow = ema(values, slowPeriod);
  const macdLine = [];