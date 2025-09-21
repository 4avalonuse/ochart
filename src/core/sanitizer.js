/**
 * Módulo de Sanitização de Dados OHLCV
 * Processa e valida dados de séries temporais financeiras
 * @module sanitizer
 */

import { info, warn, err } from './logger.js';

// Constantes de configuração
const CONSTANTS = {
  MS_THRESHOLD: 1e12,     // Threshold para detecção de timestamp em ms
  MS_MULTIPLIER: 1000,    // Multiplicador para converter segundos em ms
  MIN_VALID_YEAR: 2009,   // Bitcoin começou em 2009
  MAX_VALID_YEAR: 2100,   // Limite superior razoável
  DEFAULT_VOLUME: 0,       // Volume padrão quando ausente
};

// Tipos de erros de sanitização
const ErrorTypes = {
  INVALID_TIMESTAMP: 'invalid_timestamp',
  INVALID_PRICE: 'invalid_price',
  NEGATIVE_PRICE: 'negative_price',
  OHLC_INCONSISTENCY: 'ohlc_inconsistency',
  DUPLICATE_TIMESTAMP: 'duplicate_timestamp',
  MISSING_REQUIRED: 'missing_required',
  OUTLIER_DETECTED: 'outlier_detected'
};

/**
 * Classe principal de sanitização com validação avançada
 */
export class DataSanitizer {
  constructor(options = {}) {
    this.options = {
      requirePositive: true,
      detectOutliers: true,
      outlierThreshold: 10,    // Variação de 10x é suspeita
      fillGaps: false,          // Preencher gaps temporais
      validateDates: true,      // Validar datas dentro de range razoável
      preserveOriginal: false,  // Manter cópia dos dados originais
      ...options
    };
    
    this.errors = [];
    this.warnings = [];
  }

  /**
   * Sanitiza uma série completa de dados OHLCV
   * @param {Array} raw - Dados brutos
   * @returns {Object} { data: Array, stats: Object, errors: Array, warnings: Array }
   */
  sanitize(raw) {
    this.errors = [];
    this.warnings = [];
    
    const stats = {
      input: 0,
      output: 0,
      msConverted: false,
      deduped: 0,
      droppedInvalid: 0,
      fixedOHLC: 0,
      negOrNaNVolToZero: 0,
      outliersDetected: 0,
      gapsFilled: 0,
      processingTimeMs: 0
    };

    const startTime = performance.now();

    // Validação inicial
    if (!this._validateInput(raw)) {
      stats.processingTimeMs = performance.now() - startTime;
      return { data: [], stats, errors: this.errors, warnings: this.warnings };
    }

    stats.input = raw.length;
    let data = this.options.preserveOriginal ? raw.map(p => ({ ...p })) : [...raw];

    // Pipeline de processamento
    data = this._normalizeTimestamps(data, stats);
    data = this._sortByTimestamp(data);
    data = this._deduplicateByTimestamp(data, stats);
    data = this._validateAndClean(data, stats);
    
    if (this.options.detectOutliers) {
      data = this._detectAndHandleOutliers(data, stats);
    }
    
    if (this.options.fillGaps) {
      data = this._fillTemporalGaps(data, stats);
    }

    stats.output = data.length;
    stats.processingTimeMs = performance.now() - startTime;

    this._logResults(stats);

    return {
      data,
      stats,
      errors: this.errors,
      warnings: this.warnings
    };
  }

  /**
   * Valida entrada
   */
  _validateInput(raw) {
    if (!Array.isArray(raw)) {
      this.errors.push({
        type: ErrorTypes.MISSING_REQUIRED,
        message: 'Input deve ser um array'
      });
      return false;
    }

    if (raw.length === 0) {
      this.warnings.push({
        type: 'empty_input',
        message: 'Array de entrada está vazio'
      });
      return false;
    }

    return true;
  }

  /**
   * Normaliza timestamps para millisegundos
   */
  _normalizeTimestamps(data, stats) {
    if (data.length === 0) return data;

    // Detecta se timestamps estão em segundos
    const samples = data.slice(0, Math.min(10, data.length));
    const avgTimestamp = samples.reduce((acc, p) => acc + (Number(p.t) || 0), 0) / samples.length;

    if (avgTimestamp > 0 && avgTimestamp < CONSTANTS.MS_THRESHOLD) {
      stats.msConverted = true;
      data.forEach(point => {
        point.t = Number(point.t) * CONSTANTS.MS_MULTIPLIER;
      });
      
      this.warnings.push({
        type: 'timestamp_converted',
        message: 'Timestamps convertidos de segundos para millisegundos'
      });
    }

    // Valida range de datas se habilitado
    if (this.options.validateDates) {
      const minDate = new Date(CONSTANTS.MIN_VALID_YEAR, 0, 1).getTime();
      const maxDate = new Date(CONSTANTS.MAX_VALID_YEAR, 11, 31).getTime();
      
      data = data.filter(point => {
        const t = Number(point.t);
        if (t < minDate || t > maxDate) {
          this.warnings.push({
            type: ErrorTypes.INVALID_TIMESTAMP,
            message: `Timestamp fora do range válido: ${new Date(t).toISOString()}`,
            data: point
          });
          stats.droppedInvalid++;
          return false;
        }
        return true;
      });
    }

    return data;
  }

  /**
   * Ordena por timestamp
   */
  _sortByTimestamp(data) {
    return data.sort((a, b) => Number(a.t) - Number(b.t));
  }

  /**
   * Remove duplicatas mantendo o último valor
   */
  _deduplicateByTimestamp(data, stats) {
    const uniqueMap = new Map();
    let duplicatesFound = 0;

    for (const point of data) {
      const timestamp = Number(point.t);
      if (uniqueMap.has(timestamp)) {
        duplicatesFound++;
      }
      uniqueMap.set(timestamp, point);
    }

    if (duplicatesFound > 0) {
      stats.deduped = duplicatesFound;
      this.warnings.push({
        type: ErrorTypes.DUPLICATE_TIMESTAMP,
        message: `${duplicatesFound} timestamps duplicados removidos`
      });
    }

    return Array.from(uniqueMap.values());
  }

  /**
   * Valida e limpa dados OHLCV
   */
  _validateAndClean(data, stats) {
    const cleaned = [];

    for (const point of data) {
      const cleanedPoint = this._cleanPoint(point, stats);
      if (cleanedPoint) {
        cleaned.push(cleanedPoint);
      } else {
        stats.droppedInvalid++;
      }
    }

    return cleaned;
  }

  /**
   * Limpa um ponto individual de dados
   */
  _cleanPoint(point, stats) {
    const t = Number(point.t);
    let o = this._toNumber(point.o);
    let h = this._toNumber(point.h);
    let l = this._toNumber(point.l);
    let c = this._toNumber(point.c);
    let v = this._toNumber(point.v, CONSTANTS.DEFAULT_VOLUME);

    // Valida timestamp
    if (!Number.isFinite(t)) {
      this.errors.push({
        type: ErrorTypes.INVALID_TIMESTAMP,
        message: 'Timestamp inválido',
        data: point
      });
      return null;
    }

    // Valida OHLC
    const prices = [o, h, l, c];
    const hasNaN = prices.some(p => !Number.isFinite(p));
    
    if (hasNaN) {
      this.errors.push({
        type: ErrorTypes.INVALID_PRICE,
        message: 'Preços OHLC contêm valores inválidos',
        data: point
      });
      return null;
    }

    // Valida preços positivos se requerido
    if (this.options.requirePositive) {
      const hasNegative = prices.some(p => p <= 0);
      if (hasNegative) {
        this.errors.push({
          type: ErrorTypes.NEGATIVE_PRICE,
          message: 'Preços negativos ou zero encontrados',
          data: point
        });
        return null;
      }
    }

    // Corrige inconsistências OHLC
    const originalLow = l;
    const originalHigh = h;
    l = Math.min(o, h, l, c);
    h = Math.max(o, h, l, c);

    if (l !== originalLow || h !== originalHigh) {
      stats.fixedOHLC++;
      this.warnings.push({
        type: ErrorTypes.OHLC_INCONSISTENCY,
        message: `OHLC corrigido: Low ${originalLow}→${l}, High ${originalHigh}→${h}`,
        data: { timestamp: new Date(t).toISOString(), original: point }
      });
    }

    // Valida e corrige volume
    if (!Number.isFinite(v) || v < 0) {
      v = CONSTANTS.DEFAULT_VOLUME;
      stats.negOrNaNVolToZero++;
    }

    // Arredonda preços OHLC para valores inteiros (sem centavos)
    o = Math.round(o);
    h = Math.round(h);
    l = Math.round(l);
    c = Math.round(c);

    return { t, o, h, l, c, v };
  }

  /**
   * Detecta e trata outliers
   */
  _detectAndHandleOutliers(data, stats) {
    if (data.length < 3) return data; // Precisa de pelo menos 3 pontos

    const cleaned = [];
    const threshold = this.options.outlierThreshold;

    for (let i = 0; i < data.length; i++) {
      const current = data[i];
      const prev = data[i - 1];
      const next = data[i + 1];

      let isOutlier = false;

      if (prev) {
        // Verifica variação extrema em relação ao anterior
        const changeRatio = current.c / prev.c;
        if (changeRatio > threshold || changeRatio < (1 / threshold)) {
          // Se tem próximo, verifica se é spike isolado
          if (next) {
            const returnRatio = next.c / current.c;
            if (Math.abs(returnRatio - (1 / changeRatio)) < 0.1) {
              isOutlier = true;
            }
          } else if (changeRatio > threshold * 2 || changeRatio < (1 / (threshold * 2))) {
            // Sem próximo ponto, usa threshold mais conservador
            isOutlier = true;
          }
        }
      }

      if (isOutlier) {
        stats.outliersDetected++;
        this.warnings.push({
          type: ErrorTypes.OUTLIER_DETECTED,
          message: `Outlier detectado: ${current.c} em ${new Date(current.t).toISOString()}`,
          data: current
        });

        // Interpola valor se possível
        if (prev && next) {
          const interpolated = {
            ...current,
            o: (prev.c + next.o) / 2,
            h: Math.max((prev.h + next.h) / 2, (prev.c + next.o) / 2),
            l: Math.min((prev.l + next.l) / 2, (prev.c + next.o) / 2),
            c: (prev.c + next.c) / 2,
            v: (prev.v + next.v) / 2,
            _interpolated: true
          };
          cleaned.push(interpolated);
        }
        // Senão, remove o outlier
      } else {
        cleaned.push(current);
      }
    }

    return cleaned;
  }

  /**
   * Preenche gaps temporais
   */
  _fillTemporalGaps(data, stats) {
    if (data.length < 2) return data;

    // Detecta intervalo mais comum
    const intervals = [];
    for (let i = 1; i < Math.min(data.length, 100); i++) {
      intervals.push(data[i].t - data[i - 1].t);
    }
    intervals.sort((a, b) => a - b);
    const medianInterval = intervals[Math.floor(intervals.length / 2)];

    const filled = [];
    for (let i = 0; i < data.length; i++) {
      filled.push(data[i]);

      if (i < data.length - 1) {
        const gap = data[i + 1].t - data[i].t;
        const expectedGaps = Math.round(gap / medianInterval);

        if (expectedGaps > 1) {
          // Preenche gaps com interpolação linear
          for (let j = 1; j < expectedGaps; j++) {
            const ratio = j / expectedGaps;
            const interpolated = {
              t: data[i].t + (j * medianInterval),
              o: this._lerp(data[i].c, data[i + 1].o, ratio),
              h: this._lerp(data[i].h, data[i + 1].h, ratio),
              l: this._lerp(data[i].l, data[i + 1].l, ratio),
              c: this._lerp(data[i].c, data[i + 1].c, ratio),
              v: this._lerp(data[i].v, data[i + 1].v, ratio),
              _filled: true
            };
            filled.push(interpolated);
            stats.gapsFilled++;
          }
        }
      }
    }

    if (stats.gapsFilled > 0) {
      this.warnings.push({
        type: 'gaps_filled',
        message: `${stats.gapsFilled} gaps temporais preenchidos`
      });
    }

    return filled;
  }

  /**
   * Interpolação linear
   */
  _lerp(start, end, ratio) {
    return start + (end - start) * ratio;
  }

  /**
   * Converte valor para número
   */
  _toNumber(value, defaultValue = NaN) {
    if (value == null) return defaultValue;
    const num = Number(value);
    return Number.isFinite(num) ? num : defaultValue;
  }

  /**
   * Log de resultados
   */
  _logResults(stats) {
    const level = this.errors.length > 0 ? 'error' 
                : this.warnings.length > 0 ? 'warn' 
                : 'info';

    const message = `Sanitização completa: ${stats.output}/${stats.input} pontos válidos (${stats.processingTimeMs.toFixed(1)}ms)`;

    if (level === 'error') {
      err(message, { stats, errors: this.errors.slice(0, 5) });
    } else if (level === 'warn') {
      warn(message, { stats, warnings: this.warnings.slice(0, 5) });
    } else {
      info(message, stats);
    }
  }
}

/**
 * Função wrapper para compatibilidade com API antiga
 * @param {Array} raw - Dados brutos
 * @param {Object} opts - Opções
 * @returns {Object} { data: Array, stats: Object }
 */
export function sanitizeSeries(raw = [], opts = {}) {
  const sanitizer = new DataSanitizer(opts);
  const result = sanitizer.sanitize(raw);
  return { data: result.data, stats: result.stats };
}

/**
 * Função wrapper para compatibilidade - mantém OHLC para KPIs e close para gráfico de linha
 * @param {Array} raw - Dados brutos
 * @param {Object} opts - Opções
 * @returns {Object} { data: Array, stats: Object }
 */
export function sanitizeLine(raw = [], opts = {}) {
  return sanitizeSeries(raw, opts);
}

/**
 * Validação rápida de ponto único
 * @param {Object} point - Ponto de dados OHLCV
 * @returns {boolean} Se o ponto é válido
 */
export function isValidPoint(point) {
  if (!point || typeof point !== 'object') return false;
  
  const { t, o, h, l, c } = point;
  
  // Timestamp válido
  if (!Number.isFinite(Number(t))) return false;
  
  // OHLC válidos
  const prices = [o, h, l, c].map(Number);
  if (prices.some(p => !Number.isFinite(p))) return false;
  
  // High/Low consistentes
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  if (Number(l) !== min || Number(h) !== max) return false;
  
  return true;
}

/**
 * Estatísticas básicas de uma série
 * @param {Array} data - Dados sanitizados
 * @returns {Object} Estatísticas
 */
export function getSeriesStats(data) {
  if (!Array.isArray(data) || data.length === 0) {
    return null;
  }

  const closes = data.map(d => d.c).filter(Number.isFinite);
  const volumes = data.map(d => d.v).filter(Number.isFinite);

  return {
    count: data.length,
    dateRange: {
      start: new Date(data[0].t),
      end: new Date(data[data.length - 1].t)
    },
    price: {
      min: Math.min(...closes),
      max: Math.max(...closes),
      avg: closes.reduce((a, b) => a + b, 0) / closes.length,
      last: closes[closes.length - 1]
    },
    volume: {
      min: Math.min(...volumes),
      max: Math.max(...volumes),
      avg: volumes.reduce((a, b) => a + b, 0) / volumes.length,
      total: volumes.reduce((a, b) => a + b, 0)
    }
  };
}