/** 
 * YViewport — matemática do viewport vertical do OChart.
 *
 * Linear e logarítmico não compartilham a mesma geometria:
 * - linear trabalha por diferença;
 * - log trabalha por razão (logaritmo natural).
 *
 * Gestos e ChartZoom não precisam conhecer essa matemática.
 */
export class YViewport {
  constructor(type = 'linear') {
    this.setType(type);
  }

  setType(type) {
    this.type = type === 'logarithmic' ? 'logarithmic' : 'linear';
    return this;
  }

  isLog() {
    return this.type === 'logarithmic';
  }

  transform(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return NaN;
    return this.isLog() ? Math.log(n) : n;
  }

  inverse(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return NaN;
    return this.isLog() ? Math.exp(n) : n;
  }

  validRange(min, max) {
    min = Number(min);
    max = Number(max);

    if (!Number.isFinite(min) || !Number.isFinite(max) || max <= min) return false;
    if (this.isLog() && min <= 0) return false;
    return true;
  }

  normalizeRange(min, max, fallbackMin = 1, fallbackMax = 2) {
    min = Number(min);
    max = Number(max);

    if (!this.validRange(min, max)) {
      min = Number(fallbackMin);
      max = Number(fallbackMax);
    }

    if (!this.validRange(min, max)) {
      min = this.isLog() ? 1 : 0;
      max = this.isLog() ? 2 : 1;
    }

    return { min, max };
  }

  span(min, max) {
    const a = this.transform(min);
    const b = this.transform(max);
    return Number.isFinite(a) && Number.isFinite(b) ? b - a : NaN;
  }

  pan(min, max, deltaPixels, pixelHeight) {
    const range = this.normalizeRange(min, max);
    const a = this.transform(range.min);
    const b = this.transform(range.max);
    const span = b - a;
    const height = Math.max(1, Number(pixelHeight) || 1);

    if (!Number.isFinite(span) || span <= 0) return range;

    const delta = -(Number(deltaPixels) / height) * span;
    const nextMin = this.inverse(a + delta);
    const nextMax = this.inverse(b + delta);

    return this.normalizeRange(nextMin, nextMax, range.min, range.max);
  }

  scale(min, max, anchorRatio, deltaPixels, pixelHeight) {
    const range = this.normalizeRange(min, max);
    const a = this.transform(range.min);
    const b = this.transform(range.max);
    const span = b - a;
    const height = Math.max(1, Number(pixelHeight) || 1);

    if (!Number.isFinite(span) || span <= 0) return range;

    // anchorRatio é a posição do cursor dentro do eixo:
    // 0 = topo (min), 1 = base (max).
    // O cálculo anterior invertia essa relação, fazendo o zoom
    // afastar-se do ponto sob o cursor — especialmente perceptível no log.
    const ratio = Math.max(0, Math.min(1, Number(anchorRatio) || 0));
    const anchor = a + ratio * span;

    // Mantém a sensação do OChart histórico:
    // arrastar para baixo fecha/aproxima; para cima abre/afasta.
    // A intensidade é calculada no espaço transformado (inclusive no log).
    const factor = Math.exp(-(Number(deltaPixels) / height) * 2.2);
    let nextSpan = span * factor;

    const minSpan = this.isLog()
      ? Math.max(Math.log(1.000001), span / 10000)
      : Math.max(1e-12, span / 10000);

    const maxSpan = Math.max(span * 8, minSpan);
    nextSpan = Math.max(minSpan, Math.min(maxSpan, nextSpan));

    const nextA = anchor - ratio * nextSpan;
    const nextB = anchor + (1 - ratio) * nextSpan;

    return this.normalizeRange(
      this.inverse(nextA),
      this.inverse(nextB),
      range.min,
      range.max
    );
  }

  fit(min, max, padding = 0.05) {
    const range = this.normalizeRange(min, max);
    const a = this.transform(range.min);
    const b = this.transform(range.max);
    const span = b - a;

    if (!Number.isFinite(span) || span <= 0) return range;

    const pad = span * Math.max(0, Number(padding) || 0);
    const next = this.normalizeRange(
      this.inverse(a - pad),
      this.inverse(b + pad),
      range.min,
      range.max
    );

    return next;
  }

  clamp(range, bounds, slackMultiplier = 2) {
    if (!range || !bounds) return range;

    const current = this.normalizeRange(range.min, range.max);
    const bound = this.normalizeRange(bounds.min, bounds.max, current.min, current.max);

    const a = this.transform(current.min);
    const b = this.transform(current.max);
    const lo = this.transform(bound.min);
    const hi = this.transform(bound.max);

    if (![a, b, lo, hi].every(Number.isFinite) || hi <= lo || b <= a) {
      return current;
    }

    const slack = Math.max(hi - lo, b - a) * Math.max(0, slackMultiplier);
    const floor = lo - slack;
    const ceil = hi + slack;

    let nextA = a;
    let nextB = b;

    if (nextA < floor) {
      const correction = floor - nextA;
      nextA += correction;
      nextB += correction;
    }

    if (nextB > ceil) {
      const correction = nextB - ceil;
      nextA -= correction;
      nextB -= correction;
    }

    return this.normalizeRange(
      this.inverse(nextA),
      this.inverse(nextB),
      current.min,
      current.max
    );
  }
}
