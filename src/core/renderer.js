/**
 * Renderer — ponte mínima entre dados prontos e o motor visual.
 * Não carrega, sanitiza nem decide regras de negócio.
 */
import { renderMetrics } from '../ui/metrics.js';

export function render(engine, rows, currentScale, currentType) {
  if (!engine) throw new Error('ChartEngine é obrigatório');
  const data = Array.isArray(rows) ? rows : [];
  engine.create(data, { type: currentType, scale: currentScale });
  renderMetrics(data);
}
