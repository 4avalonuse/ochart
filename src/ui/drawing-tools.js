// src/ui/drawing-tools.js
// ============================================================
// Ferramentas de Desenho completas para o ochart (versão simplificada)
// - Toolbar ancorada ao gráfico (index.html já reserva o espaço).
// - Desenhos: cursor, linha de tendência, linha horizontal, linha vertical,
//   retângulo, fibonacci (como linhas horizontais), texto (placeholder),
//   ferramenta de medição.
// - Undo/Redo com histórico.
// - Salvar/Carregar 100% no navegador (download/upload de JSON).
// - Médias móveis livres (SMA/EMA) com cor / largura.
// - Converte tipos não suportados pelo ChartEngine (vline/rect/fib) para
//   formas compatíveis (lines) antes de enviar para o motor.
// ============================================================

export class DrawingTools {
  constructor(chartEngine, options = {}) {
    this.engine = chartEngine;
    this.options = options;

    // ---- Estado de interação ----
    this.currentTool     = null;
    this.isDrawing       = false;
    this.isDragging      = false;
    this.startPoint      = null;
    this.endPoint        = null;
    this.selectedDrawing = null;
    this.hoveredDrawing  = null;

    // drag
    this.dragStartPoint = null;
    this.dragOriginal   = null;

    // ---- Dados ----
    this.drawings  = []; // [{id,type,...,visible}]
    this.overlays  = []; // [{type:'SMA'|'EMA',period:number,color?,width?}]

    // Fib levels padrão
    this.fibLevels = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];

    // Histórico (undo/redo)
    this.history        = [];
    this.historyIndex   = -1;
    this.maxHistorySize = 80;

    // Measure tooltip
    this.measureTooltipEl = null;
    this.measureStart     = null;

    // Handlers de mouse (p/ remover no destroy)
    this.mouseHandlers = { down:null, move:null, up:null, dblclick:null };

    // Ferramentas
    this.tools = {
      cursor:  { id:'cursor',  icon:'↖️', label:'Selecionar',       type:'navigation' },
      trend:   { id:'trend',   icon:'📈', label:'Tendência',         type:'drawing'    },
      hline:   { id:'hline',   icon:'➖', label:'Linha Horizontal',  type:'drawing'    },
      vline:   { id:'vline',   icon:'│',  label:'Linha Vertical',    type:'drawing'    },
      rect:    { id:'rect',    icon:'▭',  label:'Retângulo',         type:'drawing'    },
      fib:     { id:'fib',     icon:'🌀', label:'Fibonacci',         type:'drawing'    },
      text:    { id:'text',    icon:'T',  label:'Texto',             type:'annotation' },
      measure: { id:'measure', icon:'📏', label:'Medir',             type:'tool'       }
    };
  }

  // =========================================================
  // Inicialização / Destruição
  // =========================================================
  init() {

    this._renderToolbar();
    this.selectTool('cursor');
    this._attachEventListeners();
    this._setupKeyboardShortcuts();
    this._ensureMeasureTooltip();
  }

  destroy() {
    if (this.engine?.canvas) {
      const cv = this.engine.canvas;
      cv.removeEventListener('mousedown',  this.mouseHandlers.down);
      cv.removeEventListener('mousemove',  this.mouseHandlers.move);
      cv.removeEventListener('mouseup',    this.mouseHandlers.up);
      cv.removeEventListener('dblclick',   this.mouseHandlers.dblclick);
      cv.removeEventListener('mouseleave', this.mouseHandlers.up);
    }
    document.getElementById('drawing-toolbar')?.remove();
    if (this.measureTooltipEl) this.measureTooltipEl.remove();
  }

  // =========================================================
  // Toolbar + UI
  // =========================================================
  _renderToolbar() {
    if (document.getElementById('drawing-toolbar')) return;

    const el = document.createElement('div');
    el.id = 'drawing-toolbar';
    el.className = 'drawing-toolbar';
    el.innerHTML = `
      <div class="toolbar-section">
        <div class="toolbar-actions">
          <button id="dt-undo" title="Desfazer (Ctrl+Z)">↶</button>
          <button id="dt-redo" title="Refazer (Ctrl+Y ou Ctrl+Shift+Z)">↷</button>
          <button id="dt-save-json" title="Salvar desenhos como JSON (Ctrl+S)">💾 Salvar</button>
          <button id="dt-load-json" title="Carregar JSON de desenhos (Ctrl+O)">📁 Carregar</button>
          <button id="dt-clear-all"  title="Limpar todos os objetos">🗑️ Limpar</button>
        </div>
      </div>

      <div class="toolbar-section">
        <div class="toolbar-title">Ferramentas</div>
        <div class="toolbar-grid" id="dt-tools"></div>
      </div>

      <div class="toolbar-section">
        <div class="toolbar-title">Médias móveis</div>

        <div class="ma-row ma-col">
          <label class="ma-field">
            <span>Tipo</span>
            <select id="dt-ma-type">
              <option value="SMA">SMA</option>
              <option value="EMA">EMA</option>
            </select>
          </label>

          <label class="ma-field">
            <span>Período</span>
            <input id="dt-ma-period" type="number" min="1" step="1" value="21"/>
          </label>

          <label class="ma-field">
            <span>Largura</span>
            <input id="dt-ma-width" type="number" min="1" step="0.5" value="1.5"/>
          </label>

          <label class="ma-field">
            <span>Cor</span>
            <input id="dt-ma-color" type="color" value="#3b82f6"/>
          </label>

          <button id="dt-ma-add" class="ma-add">➕ Adicionar média</button>
        </div>

        <div id="dt-ma-list" class="tiny muted">— nenhuma média</div>
      </div>

      <div class="toolbar-section">
        <div class="toolbar-title">Fibonacci</div>
        <div id="dt-fib-levels" class="fib-levels"></div>
      </div>

      <div class="toolbar-section">
        <div class="toolbar-title">Objetos (<span id="dt-count">0</span>)</div>
        <div id="dt-draw-list" class="draw-list tiny"></div>
      </div>
    `;

    // ancora no contêiner do gráfico
    (document.querySelector('.chart-shell') || document.body).appendChild(el);

    // Popular ferramentas
    const grid = el.querySelector('#dt-tools');
    Object.values(this.tools).forEach(tool => {
      const b = document.createElement('button');
      b.className = 'tool-btn';
      b.id = `dt-tool-${tool.id}`;
      b.innerHTML = `<span class="tool-ico">${tool.icon}</span>`;
      b.title = tool.label;
      b.addEventListener('click', () => this.selectTool(tool.id));
      grid.appendChild(b);
    });

    // Popular níveis de fibo
    this._renderFibLevels(el.querySelector('#dt-fib-levels'));

    // Listeners principais
    el.querySelector('#dt-undo').addEventListener('click', () => this.undo());
    el.querySelector('#dt-redo').addEventListener('click', () => this.redo());
    el.querySelector('#dt-clear-all').addEventListener('click', () => this._clearAll());

    // JSON (download/upload)
    el.querySelector('#dt-save-json').addEventListener('click', () => this._saveJSON());
    el.querySelector('#dt-load-json').addEventListener('click', () => this._loadJSON());

    // Médias
    el.querySelector('#dt-ma-add').addEventListener('click', () => this._handleAddMA());

    this._refreshMAList();
    this._refreshDrawList();
  }

  _renderFibLevels(container) {
    if (!container) return;
    container.innerHTML = this.fibLevels.map(l => `
      <label class="fib-item">
        <input type="checkbox" value="${l}" checked />
        ${(l * 100).toFixed(1)}%
      </label>
    `).join('');
  }


  // =========================================================
  // Seletor de Ferramenta + cursores + interação chart
  // =========================================================
  selectTool(toolId) {
    document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
    const b = document.getElementById(`dt-tool-${toolId}`);
    if (b) b.classList.add('active');

    this.currentTool = this.tools[toolId];
    this._updateCanvasCursor();
    this._updateChartInteraction();
  }

  _updateCanvasCursor() {
    if (!this.engine?.canvas) return;
    const c = this.engine.canvas.classList;
    c.remove('chart-cursor-crosshair','chart-cursor-pointer','chart-cursor-move');

    if (this.currentTool?.type === 'drawing' || this.currentTool?.id === 'measure') {
      c.add('chart-cursor-crosshair');
    } else if (this.currentTool?.id === 'cursor') {
      c.add('chart-cursor-pointer');
    }
  }

  _updateChartInteraction() {
    if (!this.engine?.chart) return;
    const chart = this.engine.chart;
    const isDrawing = this.currentTool?.type === 'drawing' || this.currentTool?.id === 'measure';
    if (chart.options?.plugins?.zoom?.zoom?.drag) {
      chart.options.plugins.zoom.zoom.drag.enabled = !isDrawing;
    }
    chart.update('none');
  }

  // =========================================================
  // Eventos de Mouse / Teclado
  // =========================================================
  _attachEventListeners() {
    if (!this.engine?.canvas) return;
    const cv = this.engine.canvas;

    this.mouseHandlers.down = this._onMouseDown.bind(this);
    this.mouseHandlers.move = this._onMouseMove.bind(this);
    this.mouseHandlers.up   = this._onMouseUp.bind(this);
    this.mouseHandlers.dblclick = this._onDoubleClick.bind(this);

    cv.addEventListener('mousedown',  this.mouseHandlers.down);
    cv.addEventListener('mousemove',  this.mouseHandlers.move);
    cv.addEventListener('mouseup',    this.mouseHandlers.up);
    cv.addEventListener('dblclick',   this.mouseHandlers.dblclick);
    cv.addEventListener('mouseleave', this.mouseHandlers.up);
  }

  _setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey && e.key === 'z' && !e.shiftKey) { e.preventDefault(); this.undo(); }
      if ((e.ctrlKey && e.key === 'y') || (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'z')) { e.preventDefault(); this.redo(); }
      if (e.ctrlKey && e.key.toLowerCase() === 's') { e.preventDefault(); this._saveJSON(); }
      if (e.ctrlKey && e.key.toLowerCase() === 'o') { e.preventDefault(); this._loadJSON(); }
      if (e.key === 'Delete' && this.selectedDrawing) this._removeDrawing(this.selectedDrawing);
      if (e.key === 'Escape') {
        this.isDrawing = false; this.isDragging = false;
        this.selectedDrawing = null; this.measureStart = null;
        this._hideMeasureTooltip(); this._refreshDrawList();
        this._clearPreview();
      }
      // atalhos Alt+letra
      if (e.altKey) {
        const k = e.key.toLowerCase();
        if (k==='f') this.selectTool('fib');
        if (k==='t') this.selectTool('trend');
        if (k==='r') this.selectTool('rect');
        if (k==='h') this.selectTool('hline');
        if (k==='v') this.selectTool('vline');
        if (k==='m') this.selectTool('measure');
        if (k==='x') this.selectTool('text');
      }
    });
  }

  // =========================================================
  // Mouse Handlers
  // =========================================================
  _onMouseDown(ev) {
    const p = this._eventToChartPoint(ev);

    // Cursor: seleção/drag
    if (this.currentTool?.id === 'cursor') {
      const hit = this._findDrawingAtPoint(p);
      if (hit) {
        this.selectedDrawing = hit;
        this.isDragging = true;
        this.dragStartPoint = p;
        this.dragOriginal = JSON.parse(JSON.stringify(hit));
        this._refreshDrawList();
        return;
      }
    }

    // Medir
    if (this.currentTool?.id === 'measure') {
      this.measureStart = p;
      this.isDrawing = true;
      this._showMeasureTooltip(ev.clientX, ev.clientY, { reset:true });
      return;
    }

    // Iniciar desenho
    if (this.currentTool?.type === 'drawing') {
      this.isDrawing = true;
      this.startPoint = p;

      // hline: cria direto
      if (this.currentTool.id === 'hline') {
        this._addDrawing({ id:`hline-${Date.now()}`, type:'hline', y:p.y, color:'#3b82f6', visible:true });
        this.isDrawing = false;
      }
      // vline: cria direto
      if (this.currentTool.id === 'vline') {
        this._addDrawing({ id:`vline-${Date.now()}`, type:'vline', x:p.x, color:'#3b82f6', visible:true });
        this.isDrawing = false;
      }
    }
  }

  _onMouseMove(ev) {
    const p = this._eventToChartPoint(ev);

    // hover cursor
    if (this.currentTool?.id === 'cursor' && !this.isDragging && this.engine?.canvas) {
      const hovered = this._findDrawingAtPoint(p);
      this.engine.canvas.style.cursor = hovered ? 'move' : 'default';
    }

    // drag item
    if (this.isDragging && this.selectedDrawing && this.dragStartPoint) {
      const dx = p.x - this.dragStartPoint.x;
      const dy = p.y - this.dragStartPoint.y;
      const d = this.selectedDrawing;

      switch (d.type) {
        case 'hline': d.y = this.dragOriginal.y + dy; break;
        case 'vline': d.x = this.dragOriginal.x + dx; break;
        case 'trend':
        case 'rect':
        case 'fib':
          d.x1 = this.dragOriginal.x1 + dx; d.y1 = this.dragOriginal.y1 + dy;
          d.x2 = this.dragOriginal.x2 + dx; d.y2 = this.dragOriginal.y2 + dy;
          break;
      }
      this._sendDrawingsToEngine();
      return;
    }

    // medir
    if (this.currentTool?.id === 'measure' && this.isDrawing) {
      this._showMeasureTooltip(ev.clientX, ev.clientY, { p2: p });
      return;
    }

    // preview
    if (this.isDrawing && this.startPoint) {
      this.endPoint = p;
      this._updatePreview();
    }
  }

  _onMouseUp() {
    // finaliza drag
    if (this.isDragging && this.selectedDrawing) {
      this._pushHistory('move');
      this.isDragging = false; this.dragStartPoint = null; this.dragOriginal = null;
    }

    // finaliza medir
    if (this.currentTool?.id === 'measure' && this.isDrawing) {
      this.isDrawing = false; this.measureStart = null;
      setTimeout(() => this._hideMeasureTooltip(), 900);
      return;
    }

    // finaliza desenho
    if (this.isDrawing && this.startPoint && this.endPoint) {
      switch (this.currentTool.id) {
        case 'trend':
          this._addDrawing({
            id:`trend-${Date.now()}`, type:'trend',
            x1:this.startPoint.x, y1:this.startPoint.y,
            x2:this.endPoint.x,   y2:this.endPoint.y,
            color:'#3b82f6', visible:true
          });
          break;
        case 'rect':
          this._addDrawing({
            id:`rect-${Date.now()}`, type:'rect',
            x1:Math.min(this.startPoint.x, this.endPoint.x),
            y1:Math.min(this.startPoint.y, this.endPoint.y),
            x2:Math.max(this.startPoint.x, this.endPoint.x),
            y2:Math.max(this.startPoint.y, this.endPoint.y),
            color:'#3b82f6', fillColor:'rgba(59,130,246,.12)', visible:true
          });
          break;
        case 'fib':
          this._addDrawing({
            id:`fib-${Date.now()}`, type:'fib',
            x1:this.startPoint.x, y1:this.startPoint.y,
            x2:this.endPoint.x,   y2:this.endPoint.y,
            levels: this._readFibLevelsChecked(),
            color:'#6b7280', visible:true
          });
          break;
      }
    }

    this.isDrawing = false;
    this.startPoint = null;
    this.endPoint = null;
    this._clearPreview();
  }

  _onDoubleClick(ev) {
    const p = this._eventToChartPoint(ev);
    const hit = this._findDrawingAtPoint(p);
    if (!hit) return;
    const newColor = prompt('Cor (hex) para o objeto selecionado:', hit.color || '#3b82f6');
    if (newColor) {
      hit.color = newColor;
      this._sendDrawingsToEngine();
      this._pushHistory('edit');
    }
  }

  // =========================================================
  // Desenhos (CRUD / Preview / Lista) + conversão p/ engine
  // =========================================================
  _addDrawing(d) {
    this.drawings.push({ visible: true, ...d });
    this._sendDrawingsToEngine();
    this._refreshDrawList();
    this._pushHistory('add');
  }

  _removeDrawing(d) {
    const i = this.drawings.findIndex(x => x.id === d.id);
    if (i >= 0) {
      this.drawings.splice(i, 1);
      this._sendDrawingsToEngine();
      this._refreshDrawList();
      this._pushHistory('remove');
    }
  }

  _convertForEngine(drawings) {
    // Converte vline/rect/fib em linhas compatíveis com ChartEngine.
    const chart = this.engine?.chart;
    const out = [];
    if (!Array.isArray(drawings)) return out;

    const yScale = chart?.scales?.y;
    const yMin = (yScale?.min ?? null);
    const yMax = (yScale?.max ?? null);

    for (const d of drawings) {
      if (d.visible === false) continue;

      if (d.type === 'hline' || d.type === 'trend') {
        out.push(d);
        continue;
      }

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

      if (d.type === 'rect') {
        const x1 = Math.min(d.x1, d.x2);
        const x2 = Math.max(d.x1, d.x2);
        const y1 = Math.min(d.y1, d.y2);
        const y2 = Math.max(d.y1, d.y2);
        out.push({ id: d.id+'-top',    type:'trend', x1, y1, x2, y2:y1, color:d.color||'#3b82f6', dash:d.dash||[] });
        out.push({ id: d.id+'-bottom', type:'trend', x1, y1:y2, x2, y2, color:d.color||'#3b82f6', dash:d.dash||[] });
        out.push({ id: d.id+'-left',   type:'trend', x1, y1, x2:x1, y2, color:d.color||'#3b82f6', dash:d.dash||[] });
        out.push({ id: d.id+'-right',  type:'trend', x1:x2, y1, x2, y2, color:d.color||'#3b82f6', dash:d.dash||[] });
        continue;
      }

      if (d.type === 'fib') {
        const lvls = Array.isArray(d.levels) && d.levels.length ? d.levels : this.fibLevels;
        const diff = d.y2 - d.y1;
        for (const l of lvls) {
          const y = d.y1 + diff * l;
          out.push({ id: `${d.id}-${l}`, type:'hline', y, color: this._fibColor(l), dash: l===0.5 ? [5,5] : [] });
        }
        continue;
      }
    }
    return out;
  }

  _sendDrawingsToEngine() {
    if (!this.engine) return;
    const payload = this._convertForEngine(this.drawings);
    this.engine.setDrawings(payload);
  }

  _updatePreview() {
    if (!this.engine || !this.startPoint || !this.endPoint) return;
    const p = { id:'preview-temp', color:'#3b82f6', dash:[5,5], visible:true };

    switch (this.currentTool?.id) {
      case 'trend':
        Object.assign(p, { type:'trend', x1:this.startPoint.x, y1:this.startPoint.y, x2:this.endPoint.x, y2:this.endPoint.y });
        break;
      case 'rect':
        Object.assign(p, {
          type:'rect',
          x1:Math.min(this.startPoint.x, this.endPoint.x),
          y1:Math.min(this.startPoint.y, this.endPoint.y),
          x2:Math.max(this.startPoint.x, this.endPoint.x),
          y2:Math.max(this.startPoint.y, this.endPoint.y)
        });
        break;
      case 'fib':
        Object.assign(p, { type:'fib', x1:this.startPoint.x, y1:this.startPoint.y, x2:this.endPoint.x, y2:this.endPoint.y, levels:this._readFibLevelsChecked() });
        break;
    }

    const payload = this._convertForEngine([...this.drawings, p]);
    this.engine.setDrawings(payload);
  }

  _clearPreview() {
    this._sendDrawingsToEngine();
  }

  _refreshDrawList() {
    const list = document.getElementById('dt-draw-list');
    const count = document.getElementById('dt-count');
    if (count) count.textContent = String(this.drawings.length);
    if (!list) return;

    if (!this.drawings.length) {
      list.innerHTML = '<div class="muted">— nenhum desenho</div>';
      return;
    }

    list.innerHTML = this.drawings.map(d => `
      <div class="draw-row" data-id="${d.id}">
        <span>${d.type} <small class="muted">${d.id.slice(-4)}</small></span>
        <div class="draw-actions">
          <button title="${d.visible===false?'Mostrar':'Ocultar'}">${d.visible===false?'🚫':'👁️'}</button>
          <button title="Remover">🗑️</button>
        </div>
      </div>
    `).join('');

    list.querySelectorAll('.draw-row').forEach(row => {
      const id = row.dataset.id;
      const d = this.drawings.find(x => x.id === id);

      const [btnVis, btnDel] = row.querySelectorAll('button');

      row.addEventListener('click', () => {
        this.selectedDrawing = d;
        this._refreshDrawList();
      });

      btnVis.addEventListener('click', (e) => {
        e.stopPropagation();
        d.visible = d.visible === false ? true : false;
        this._sendDrawingsToEngine(); this._refreshDrawList();
      });

      btnDel.addEventListener('click', (e) => {
        e.stopPropagation();
        this._removeDrawing(d);
      });
    });
  }

  // =========================================================
  // Médias móveis (livres)
  // =========================================================
  _handleAddMA() {
    const el = document.getElementById('dt-ma-type');
    const perEl = document.getElementById('dt-ma-period');
    const wEl   = document.getElementById('dt-ma-width');
    const colEl = document.getElementById('dt-ma-color');

    const type   = el?.value || 'SMA';
    const period = parseInt(perEl?.value || '0', 10);
    const width  = parseFloat(wEl?.value || '1.5');
    const color  = colEl?.value || '#6b7280';

    if (!period || period < 1) { alert('Período inválido'); return; }

    this.overlays.push({ type, period, color, width });
    this.engine.setOverlays(this.overlays);
    this._pushHistory('overlay_add');
    this._refreshMAList();
  }

  _refreshMAList() {
    const box = document.getElementById('dt-ma-list');
    if (!box) return;
    if (!this.overlays.length) { box.textContent = '— nenhuma média'; return; }
    box.innerHTML = this.overlays.map((o, i) => `
      <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin:3px 0;">
        <span>#${i+1} ${o.type}${o.period}</span>
        <span style="display:flex;gap:8px;align-items:center;">
          <i style="display:inline-block;width:12px;height:12px;border-radius:2px;border:1px solid var(--border);background:${o.color}"></i>
          <button data-i="${i}" class="dt-ma-del" title="Remover">✖</button>
        </span>
      </div>
    `).join('');

    box.querySelectorAll('.dt-ma-del').forEach(btn => {
      btn.addEventListener('click', () => {
        const i = parseInt(btn.dataset.i, 10);
        this.overlays.splice(i, 1);
        this.engine.setOverlays(this.overlays);
        this._pushHistory('overlay_remove');
        this._refreshMAList();
      });
    });
  }

  // =========================================================
  // Undo / Redo / Histórico
  // =========================================================
  _pushHistory(action) {
    this.history = this.history.slice(0, this.historyIndex + 1);
    this.history.push({
      action, ts: Date.now(),
      state: {
        drawings: JSON.parse(JSON.stringify(this.drawings)),
        overlays: JSON.parse(JSON.stringify(this.overlays))
      }
    });
    if (this.history.length > this.maxHistorySize) {
      this.history.shift();
      this.historyIndex = this.history.length - 1;
    } else {
      this.historyIndex++;
    }
    this._updateHistoryButtons();
  }

  undo() {
    if (this.historyIndex <= 0) return;
    this.historyIndex--;
    const state = this.history[this.historyIndex].state;
    this.drawings = JSON.parse(JSON.stringify(state.drawings));
    this.overlays = JSON.parse(JSON.stringify(state.overlays));
    this.selectedDrawing = null;
    this._sendDrawingsToEngine();
    this.engine.setOverlays(this.overlays);
    this._refreshDrawList();
    this._refreshMAList();
    this._updateHistoryButtons();
  }

  redo() {
    if (this.historyIndex >= this.history.length - 1) return;
    this.historyIndex++;
    const state = this.history[this.historyIndex].state;
    this.drawings = JSON.parse(JSON.stringify(state.drawings));
    this.overlays = JSON.parse(JSON.stringify(state.overlays));
    this.selectedDrawing = null;
    this._sendDrawingsToEngine();
    this.engine.setOverlays(this.overlays);
    this._refreshDrawList();
    this._refreshMAList();
    this._updateHistoryButtons();
  }

  _updateHistoryButtons() {
    const u = document.getElementById('dt-undo');
    const r = document.getElementById('dt-redo');
    if (u) u.disabled = this.historyIndex <= 0;
    if (r) r.disabled = this.historyIndex >= this.history.length - 1;
  }

  // =========================================================
  // SALVAR / CARREGAR — download & upload JSON
  // =========================================================
  _exportJSON() {
    return {
      schema: { name:'ochart.drawings', version:1 },
      meta: {
        exportedAt: new Date().toISOString()
      },
      config: {
        type:  this.engine?.currentConfig?.type  || 'line',
        scale: this.engine?.currentConfig?.scale || 'logarithmic'
      },
      viewport: this.engine?.getViewport?.() || null,
      overlays: this.overlays,
      drawings: this.drawings
    };
  }

  _applyJSON(obj) {
    if (!obj || typeof obj !== 'object') throw new Error('JSON inválido');

    // aceita tanto no root quanto dentro de "data"
    const payload = obj.drawings || obj.overlays ? obj : (obj.data || obj);

    this.overlays = Array.isArray(payload.overlays) ? payload.overlays.slice() : [];
    this.drawings = Array.isArray(payload.drawings) ? payload.drawings.slice() : [];

    // aplica no chart
    this.engine.setOverlays(this.overlays);
    this._sendDrawingsToEngine();

    // viewport/config (opcional)
    if (payload.config?.scale) this.engine.setScale(payload.config.scale);
    if (payload.config?.type)  this.engine.setType(payload.config.type);
    if (payload.viewport?.xMin != null && payload.viewport?.xMax != null) {
      this.engine.setZoomState({ min: payload.viewport.xMin, max: payload.viewport.xMax });
    }

    this._refreshMAList();
    this._refreshDrawList();
  }

 // === SALVAR: grava no servidor em api/bundles/<id>.json; se falhar, baixa arquivo ===
async _saveJSON() {
  const id = prompt('Nome do arquivo (sem .json):', 'meu-setup');
  if (!id) return;

  try {
    const data = this._exportJSON();

    const url = './api/bundles.php?action=save&id=' + encodeURIComponent(id);
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });

    const out = await res.json().catch(() => null);
    if (!res.ok || !out?.ok) {
      throw new Error(out?.error || ('HTTP ' + res.status));
    }

    this._flash(`Salvo em api/bundles/${id}.json`);
  } catch (e) {
    console.error(e);
    if (confirm('Falha ao salvar no servidor.\nQuer baixar o JSON localmente?')) {
      this._saveJSONDownload();
    } else {
      alert('Erro ao salvar: ' + e.message);
    }
  }
}

// === fallback: download local do JSON ===
_saveJSONDownload() {
  try {
    const data = this._exportJSON();
    const text = JSON.stringify(data, null, 2);
    const blob = new Blob([text], { type: 'application/json' });

    const pad = n => String(n).padStart(2, '0');
    const d = new Date();
    const fname = `ochart-drawings-${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}.json`;

    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = fname;
    document.body.appendChild(a);
    a.click();
    URL.revokeObjectURL(a.href);
    a.remove();
    this._flash('Desenhos salvos (JSON baixado).');
  } catch (err) {
    console.error(err);
    alert('Falha no download do JSON: ' + err.message);
  }
}


  _loadJSON() {
    const inp = document.createElement('input');
    inp.type = 'file';
    inp.accept = 'application/json';
    inp.onchange = async () => {
      const f = inp.files?.[0];
      if (!f) return;
      try {
        const text = await f.text();
        const obj = JSON.parse(text);
        this._applyJSON(obj);
        this._flash('Desenhos carregados do JSON.');
      } catch (e) {
        console.error(e);
        alert('Falha ao carregar JSON: ' + e.message);
      }
    };
    inp.click();
  }

  // =========================================================
  // Hit-Test em pixels
  // =========================================================
  _toPx(point) {
    const xs = this.engine?.chart?.scales?.x;
    const ys = this.engine?.chart?.scales?.y;
    if (!xs || !ys) return { x:0, y:0 };
    return { x: xs.getPixelForValue(point.x), y: ys.getPixelForValue(point.y) };
  }

  _pointToLineDistancePx(p, a, b) {
    const A = this._toPx(a), B = this._toPx(b), P = this._toPx(p);
    const vx = B.x - A.x, vy = B.y - A.y;
    const wx = P.x - A.x, wy = P.y - A.y;
    const c1 = vx*wx + vy*wy, c2 = vx*vx + vy*vy;
    const t = c2 ? Math.max(0, Math.min(1, c1 / c2)) : 0;
    const px = A.x + t*vx, py = A.y + t*vy;
    return Math.hypot(P.x - px, P.y - py);
  }

  _findDrawingAtPoint(point) {
    const tol = 8; // px
    const xs = this.engine?.chart?.scales?.x;
    const ys = this.engine?.chart?.scales?.y;
    if (!xs || !ys) return null;
    const P = this._toPx(point);

    for (let i = this.drawings.length - 1; i >= 0; i--) {
      const d = this.drawings[i];
      if (d.visible === false) continue;

      if (d.type === 'hline') {
        const y = ys.getPixelForValue(d.y);
        if (Math.abs(P.y - y) <= tol) return d;
      } else if (d.type === 'vline') {
        const x = xs.getPixelForValue(d.x);
        if (Math.abs(P.x - x) <= tol) return d;
      } else if (d.type === 'rect') {
        const x1 = xs.getPixelForValue(Math.min(d.x1, d.x2));
        const x2 = xs.getPixelForValue(Math.max(d.x1, d.x2));
        const y1 = ys.getPixelForValue(Math.max(d.y1, d.y2));
        const y2 = ys.getPixelForValue(Math.min(d.y1, d.y2));
        if (P.x >= x1 && P.x <= x2 && P.y <= y1 && P.y >= y2) return d;
      } else if (d.type === 'trend') {
        if (this._pointToLineDistancePx(point, {x:d.x1,y:d.y1}, {x:d.x2,y:d.y2}) <= tol) return d;
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

  _eventToChartPoint(ev) {
    const rect = this.engine.canvas.getBoundingClientRect();
    const x = ev.clientX - rect.left;
    const y = ev.clientY - rect.top;
    const xs = this.engine?.chart?.scales?.x;
    const ys = this.engine?.chart?.scales?.y;
    if (!xs || !ys) return { x:0, y:0 };
    return { x: xs.getValueForPixel(x), y: ys.getValueForPixel(y) };
  }

  // =========================================================
  // Measure Tooltip
  // =========================================================
  _ensureMeasureTooltip() {
    if (this.measureTooltipEl) return;
    const el = document.createElement('div');
    el.className = 'measure-tooltip';
    el.style.display = 'none';
    document.body.appendChild(el);
    this.measureTooltipEl = el;
  }

  _showMeasureTooltip(clientX, clientY, { p2=null, reset=false } = {}) {
    if (!this.measureTooltipEl) return;
    const el = this.measureTooltipEl;

    if (reset) {
      el.style.display = 'block';
      el.textContent = 'Selecione o segundo ponto…';
      el.style.left = `${clientX + 10}px`;
      el.style.top  = `${clientY + 10}px`;
      return;
    }

    if (this.measureStart && p2) {
      const dx = p2.x - this.measureStart.x;
      const dy = p2.y - this.measureStart.y;

      const xScale = this.engine.chart.scales.x;
      const pxDist = Math.abs(xScale.getPixelForValue(p2.x) - xScale.getPixelForValue(this.measureStart.x));
      const barW   = Math.max(1, (xScale.width / Math.max(1, xScale.ticks?.length || 50)));
      const bars   = Math.round(pxDist / barW);

      const pct = (dy / (this.measureStart.y || 1)) * 100;

      el.textContent = `Δpreço: ${dy.toFixed(2)} (${pct.toFixed(2)}%) | Δtempo: ${dx.toFixed(2)} (≈ ${bars} barras)`;
      el.style.display = 'block';
      el.style.left = `${clientX + 10}px`;
      el.style.top  = `${clientY + 10}px`;
    }
  }

  _hideMeasureTooltip() {
    if (this.measureTooltipEl) this.measureTooltipEl.style.display = 'none';
  }

  // =========================================================
  // Auxiliares
  // =========================================================
  _fibColor(level) {
    const colors = {
      0:'#ef4444', 0.236:'#f59e0b', 0.382:'#eab308',
      0.5:'#84cc16', 0.618:'#22c55e', 0.786:'#14b8a6', 1:'#10b981'
    };
    return colors[level] || '#6b7280';
  }

  _readFibLevelsChecked() {
    const arr = [];
    document.querySelectorAll('#dt-fib-levels input[type="checkbox"]').forEach(i => {
      if (i.checked) arr.push(parseFloat(i.value));
    });
    return arr.length ? arr : this.fibLevels;
  }

  _clearAll() {
    if (!confirm('Remover todos os desenhos?')) return;
    this.drawings = [];
    this.selectedDrawing = null;
    this._sendDrawingsToEngine();
    this._refreshDrawList();
    this._pushHistory('clear');
  }

  _flash(msg) {
    const el = document.createElement('div');
    el.style.cssText = 'position:fixed;right:14px;bottom:14px;background:var(--surface-alt);border:1px solid var(--border);padding:8px 12px;border-radius:8px;box-shadow:0 2px 10px rgba(0,0,0,.12);z-index:99999;font-size:12px;color:var(--text)';
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 1600);
  }
}
