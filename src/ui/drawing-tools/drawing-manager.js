// src/ui/drawing-tools/drawing-manager.js
// ============================================================
// Módulo responsável pelo gerenciamento de desenhos e conversões
// ============================================================

export class DrawingManager {
  constructor(drawingTools) {
    this.dt = drawingTools;
    this.drawings = [];
  }

  add(drawing) {
    this.drawings.push({ visible: true, ...drawing });
    this.sendToEngine();
    this.dt.toolbar.refreshDrawList();
    this.dt.pushHistory('add');
  }

  remove(drawing) {
    const i = this.drawings.findIndex(x => x.id === drawing.id);
    if (i >= 0) {
      this.drawings.splice(i, 1);
      this.sendToEngine();
      this.dt.toolbar.refreshDrawList();
      this.dt.pushHistory('remove');
    }
  }

  sendToEngine() {
    if (!this.dt.engine) return;
    const payload = this.convertForEngine(this.drawings);
    this.dt.engine.setDrawings(payload);
  }

  updatePreview() {
    if (!this.dt.engine || !this.dt.startPoint || !this.dt.endPoint) return;
    
    const preview = { 
      id: 'preview-temp', 
      color: '#3b82f6', 
      dash: [5,5], 
      visible: true 
    };

    switch (this.dt.currentTool?.id) {
      case 'trend':
        Object.assign(preview, {
          type: 'trend',
          x1: this.dt.startPoint.x,
          y1: this.dt.startPoint.y,
          x2: this.dt.endPoint.x,
          y2: this.dt.endPoint.y
        });
        break;
        
      case 'rect':
        Object.assign(preview, {
          type: 'rect',
          x1: Math.min(this.dt.startPoint.x, this.dt.endPoint.x),
          y1: Math.min(this.dt.startPoint.y, this.dt.endPoint.y),
          x2: Math.max(this.dt.startPoint.x, this.dt.endPoint.x),
          y2: Math.max(this.dt.startPoint.y, this.dt.endPoint.y)
        });
        break;
        
      case 'fib':
        Object.assign(preview, {
          type: 'fib',
          x1: this.dt.startPoint.x,
          y1: this.dt.startPoint.y,
          x2: this.dt.endPoint.x,
          y2: this.dt.endPoint.y,
          levels: this.dt.toolbar.readFibLevelsChecked()
        });
        break;
    }

    const payload = this.convertForEngine([...this.drawings, preview]);
    this.dt.engine.setDrawings(payload);
  }

  clearPreview() {
    this.sendToEngine();
  }

  convertForEngine(drawings) {
    const chart = this.dt.engine?.chart;
    const out = [];
    if (!Array.isArray(drawings)) return out;

    const yScale = chart?.scales?.y;
    const yMin = yScale?.min ?? null;
    const yMax = yScale?.max ?? null;

    for (const d of drawings) {
      if (d.visible === false) continue;

      // Linhas horizontais e de tendência passam direto
      if (d.type === 'hline' || d.type === 'trend') {
        out.push(d);
        continue;
      }

      // Linha vertical - converte para trend vertical
      if (d.type === 'vline') {
        if (yMin != null && yMax != null) {
          out.push({
            id: d.id,
            type: 'trend',
            x1: d.x, y1: yMin,
            x2: d.x, y2: yMax,
            color: d.color || '#6b7280',
            dash: d.dash || []
          });
        }
        continue;
      }

      // Retângulo - converte para 4 linhas
      if (d.type === 'rect') {
        const x1 = Math.min(d.x1, d.x2);
        const x2 = Math.max(d.x1, d.x2);
        const y1 = Math.min(d.y1, d.y2);
        const y2 = Math.max(d.y1, d.y2);
        const color = d.color || '#3b82f6';
        const dash = d.dash || [];
        
        out.push(
          { id: d.id+'-top',    type:'trend', x1, y1, x2, y2:y1, color, dash },
          { id: d.id+'-bottom', type:'trend', x1, y1:y2, x2, y2, color, dash },
          { id: d.id+'-left',   type:'trend', x1, y1, x2:x1, y2, color, dash },
          { id: d.id+'-right',  type:'trend', x1:x2, y1, x2, y2, color, dash }
        );
        continue;
      }

      // Fibonacci - converte para múltiplas linhas horizontais
      if (d.type === 'fib') {
        let levels = this.dt.toolbar.readFibLevelsChecked();
        if (!Array.isArray(levels) || levels.length === 0) {
          levels = [...this.dt.toolbar.fibLevels, ...this.dt.toolbar.fibExtLevels];
        }

        const xLeft = Math.min(d.x1, d.x2);
        const xRight = Math.max(d.x1, d.x2);
        const yHigh = Math.max(d.y1, d.y2);
        const yLow = Math.min(d.y1, d.y2);
        const range = yHigh - yLow;
        
        if (!isFinite(range) || range === 0) continue;

        const isDown = d.y2 < d.y1; // Arrasto descendente?
        const isLog = this.dt.engine?.chart?.options?.scales?.y?.type === 'logarithmic';

        for (const level of levels) {
          // Cálculo do y baseado na direção do arrasto
          let y = isDown ? (yHigh - range * level) : (yLow + range * level);

          // Em escala log, evita valores não positivos
          if (isLog && y <= 0) continue;

          out.push({
            id: `${d.id}-${level}`,
            type: 'trend',
            x1: xLeft,
            y1: y,
            x2: xRight,
            y2: y,
            color: this.getFibColor(level),
            dash: level === 0.5 ? [5,5] : []
          });
        }
        continue;
      }
    }
    
    return out;
  }

  getFibColor(level) {
    const colors = {
      0: '#ef4444',
      0.236: '#f59e0b',
      0.382: '#eab308',
      0.5: '#84cc16',
      0.618: '#22c55e',
      0.786: '#14b8a6',
      1: '#10b981'
    };
    return colors[level] || '#6b7280';
  }

  // Métodos de hit-test para seleção
  findDrawingAtPoint(point) {
    const tolerance = 8; // pixels
    const xs = this.dt.engine?.chart?.scales?.x;
    const ys = this.dt.engine?.chart?.scales?.y;
    if (!xs || !ys) return null;
    
    const P = this.toPx(point);

    for (let i = this.drawings.length - 1; i >= 0; i--) {
      const d = this.drawings[i];
      if (d.visible === false) continue;

      if (d.type === 'hline') {
        const y = ys.getPixelForValue(d.y);
        if (Math.abs(P.y - y) <= tolerance) return d;
      } else if (d.type === 'vline') {
        const x = xs.getPixelForValue(d.x);
        if (Math.abs(P.x - x) <= tolerance) return d;
      } else if (d.type === 'rect') {
        const x1 = xs.getPixelForValue(Math.min(d.x1, d.x2));
        const x2 = xs.getPixelForValue(Math.max(d.x1, d.x2));
        const y1 = ys.getPixelForValue(Math.max(d.y1, d.y2));
        const y2 = ys.getPixelForValue(Math.min(d.y1, d.y2));
        if (P.x >= x1 && P.x <= x2 && P.y <= y1 && P.y >= y2) return d;
      } else if (d.type === 'trend') {
        if (this.pointToLineDistancePx(point, {x:d.x1, y:d.y1}, {x:d.x2, y:d.y2}) <= tolerance) {
          return d;
        }
      } else if (d.type === 'fib') {
        const x1 = xs.getPixelForValue(Math.min(d.x1, d.x2));
        const x2 = xs.getPixelForValue(Math.max(d.x1, d.x2));
        const y1 = ys.getPixelForValue(Math.max(d.y1, d.y2));
        const y2 = ys.getPixelForValue(Math.min(d.y1, d.y2));
        if (P.x >= x1 && P.x <= x2 && P.y <= y1 && P.y >= y2) return d;
      }
    }
    return null;
  }

  toPx(point) {
    const xs = this.dt.engine?.chart?.scales?.x;
    const ys = this.dt.engine?.chart?.scales?.y;
    if (!xs || !ys) return { x:0, y:0 };
    return {
      x: xs.getPixelForValue(point.x),
      y: ys.getPixelForValue(point.y)
    };
  }

  pointToLineDistancePx(p, a, b) {
    const A = this.toPx(a);
    const B = this.toPx(b);
    const P = this.toPx(p);
    
    const vx = B.x - A.x;
    const vy = B.y - A.y;
    const wx = P.x - A.x;
    const wy = P.y - A.y;
    
    const c1 = vx*wx + vy*wy;
    const c2 = vx*vx + vy*vy;
    const t = c2 ? Math.max(0, Math.min(1, c1 / c2)) : 0;
    
    const px = A.x + t*vx;
    const py = A.y + t*vy;
    
    return Math.hypot(P.x - px, P.y - py);
  }
}