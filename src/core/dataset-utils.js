/**
 * Regras de relacionamento entre datasets do catálogo.
 *
 * O ID é um identificador persistente, não deve ser usado para inferir
 * família/intervalo. A relação é definida pelos metadados do catálogo.
 */
const ID_INTERVALS = new Set(['1m', '1h', '1d', '1w', '1M']);

export function intervalToTf(interval) {
  return interval === '1M' ? '1mo' : interval;
}

export function tfToInterval(tf) {
  return tf === '1mo' ? '1M' : tf;
}

export function findSiblingDataset(datasets, current, interval) {
  if (!Array.isArray(datasets) || !current || !ID_INTERVALS.has(interval)) return null;

  return datasets.find(d =>
    d.id !== current.id &&
    d.provider === current.provider &&
    d.symbol === current.symbol &&
    d.kind === current.kind &&
    d.currency === current.currency &&
    d.interval === interval
  ) || null;
}
