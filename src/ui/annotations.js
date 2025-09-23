/**
 * ui/annotations.js
 * ------------------
 * Converte "drawings" (criados pela toolbar) em anotações
 * compatíveis com o plugin chartjs-plugin-annotation.
 * Uso: drawingsToAnnotations(drawingsArray) -> annotationsObject
 */
export function drawingsToAnnotations(drawings) {
  if (!Array.isArray(drawings) || drawings.length === 0) return {};

  const annotations = {};

  for (const d of drawings) {
    if (!d || !d.type || !d.id) continue;

    switch (d.type) {
      case 'hline':
        annotations[d.id] = {
          type: 'line',
          yMin: d.y,
          yMax: d.y,
          borderWidth: 1.2,
          borderColor: d.color || '#6b7280',
          borderDash: d.dash || [5, 5]
        };
        break;

      case 'trend':
        annotations[d.id] = {
          type: 'line',
          xMin: d.x1,
          xMax: d.x2,
          yMin: d.y1,
          yMax: d.y2,
          borderWidth: 1.2,
          borderColor: d.color || '#6b7280'
        };
        break;

      default:
        console.warn(`[annotations] Tipo de desenho desconhecido: ${d.type}`);
        break;
    }
  }

  return annotations;
}
