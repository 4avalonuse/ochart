// src/ui/drawing-tools/toolbar.js
// ============================================================
// Módulo responsável pela toolbar e interface do usuário
// ============================================================

export class DrawingToolbar {
  constructor(drawingTools) {
    this.dt = drawingTools;
    this.element = null;
    
    // Níveis Fibonacci padrão
    this.fibLevels = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];
    this.fibExtLevels = [1.272, 1.414, 1.618, 2.0, 2.618, 4.236];
  }

  render() {
    if (document.getElementById('drawing-toolbar')) return;

    const el = document.createElement('div');
    el.id = 'drawing-toolbar';
    el.className = 'drawing-toolbar';
    el.innerHTML = this._getTemplate();

    // Ancora no contêiner do gráfico
    (document.querySelector('.chart-shell') || document.body).appendChild(el);
    this.element = el;

    this._populateTools();
    this._renderFibLevels();
    this._attachListeners();
    this.refreshMAList();
    this.refreshDrawList();
  }

  destroy() {
    if (this.element) {
      this.element.remove();
      this.element = null;
    }
  }

  _getTemplate() {
    return `
      <div class="toolbar-head">
        <div>
          <span class="toolbar-kicker">OCHART</span>
          <strong>Desenhar</strong>
        </div>
        <button id="dt-close" class="toolbar-close" title="Fechar" aria-label="Fechar">×</button>
      </div>

      <div class="toolbar-section toolbar-tools-main">
        <div class="toolbar-title">Ferramentas</div>
        <div class="toolbar-grid" id="dt-tools"></div>
      </div>

      <div class="toolbar-section toolbar-history">
        <button id="dt-undo" title="Desfazer">↶ <span>Desfazer</span></button>
        <button id="dt-redo" title="Refazer">↷ <span>Refazer</span></button>
      </div>

      <details class="toolbar-more">
        <summary>Mais opções</summary>

        <div class="toolbar-section">
          <div class="toolbar-title">Desenhos</div>
          <div class="toolbar-actions">
            <button id="dt-save-json" title="Salvar desenhos">💾 Salvar</button>
            <button id="dt-load-json" title="Carregar desenhos">📁 Carregar</button>
            <button id="dt-clear-all" title="Limpar todos os objetos">🗑️ Limpar</button>
          </div>
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
            <button id="dt-ma-add" class="ma-add">＋ Adicionar média</button>
          </div>
          <div id="dt-ma-list" class="tiny muted">— nenhuma média</div>
        </div>

        <div class="toolbar-section">
          <div class="toolbar-title">Fibonacci</div>
          <details class="fib-toggle">
            <summary class="muted">Ajustar níveis</summary>
            <div id="dt-fib-levels" class="fib-levels"></div>
          </details>
        </div>

        <div class="toolbar-section">
          <div class="toolbar-title">Objetos (<span id="dt-count">0</span>)</div>
          <div id="dt-draw-list" class="draw-list tiny"></div>
        </div>
      </details>
    `;
  }

  _populateTools() {
    const grid = this.element.querySelector('#dt-tools');
    Object.values(this.dt.tools).forEach(tool => {
      const btn = document.createElement('button');
      btn.className = 'tool-btn';
      btn.id = `dt-tool-${tool.id}`;
      btn.type = 'button';
      btn.innerHTML = `<span class="tool-ico" aria-hidden="true">${tool.icon}</span><span class="tool-label">${tool.label}</span>`;
      btn.title = tool.label;
      btn.setAttribute('aria-label', tool.label);
      btn.setAttribute('aria-pressed', 'false');
      btn.addEventListener('click', () => this.dt.selectTool(tool.id));
      grid.appendChild(btn);
    });
  }

  _renderFibLevels() {
    const container = this.element.querySelector('#dt-fib-levels');
    if (!container) return;

    const createBlock = (title, levels, checked = true) => `
      <div class="tiny muted" style="margin:6px 0 4px">${title}</div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:4px;">
        ${levels.map(l => `
          <label class="fib-item" style="display:flex;gap:6px;align-items:center;cursor:pointer;">
            <input type="checkbox" value="${l}" ${checked ? 'checked' : ''} />
            ${(l * 100).toFixed(1)}%
          </label>
        `).join('')}
      </div>
    `;

    container.innerHTML = 
      createBlock('Retração', this.fibLevels, true) +
      createBlock('Expansão', this.fibExtLevels, true);
  }

  _attachListeners() {
    const el = this.element;
    
    // Fechar painel de opções
    el.querySelector('#dt-close')?.addEventListener('click', () => {
      document.body.classList.remove('chart-tools-open');
    });

    // Botões principais
    el.querySelector('#dt-undo').addEventListener('click', () => this.dt.undo());
    el.querySelector('#dt-redo').addEventListener('click', () => this.dt.redo());
    el.querySelector('#dt-clear-all').addEventListener('click', () => this.dt.clearAll());
    el.querySelector('#dt-save-json').addEventListener('click', () => this.dt.storageManager.saveJSON());
    el.querySelector('#dt-load-json').addEventListener('click', () => this.dt.storageManager.loadJSON());
    
    // Médias móveis
    el.querySelector('#dt-ma-add').addEventListener('click', () => this._handleAddMA());
  }

  _handleAddMA() {
    const type = this.element.querySelector('#dt-ma-type')?.value || 'SMA';
    const period = parseInt(this.element.querySelector('#dt-ma-period')?.value || '0', 10);
    const width = parseFloat(this.element.querySelector('#dt-ma-width')?.value || '1.5');
    const color = this.element.querySelector('#dt-ma-color')?.value || '#6b7280';

    if (!period || period < 1) {
      alert('Período inválido');
      return;
    }

    this.dt.overlayManager.add({ type, period, color, width });
    this.dt.pushHistory('overlay_add');
    this.refreshMAList();
  }

  setActiveTool(toolId) {
    this.element.querySelectorAll('.tool-btn').forEach(b => {
      b.classList.remove('active');
      b.setAttribute('aria-pressed', 'false');
    });
    const btn = this.element.querySelector(`#dt-tool-${toolId}`);
    if (btn) {
      btn.classList.add('active');
      btn.setAttribute('aria-pressed', 'true');
    }
  }

  updateHistoryButtons(index, length) {
    const undo = this.element.querySelector('#dt-undo');
    const redo = this.element.querySelector('#dt-redo');
    if (undo) undo.disabled = index <= 0;
    if (redo) redo.disabled = index >= length - 1;
  }

  refreshDrawList() {
    const list = this.element.querySelector('#dt-draw-list');
    const count = this.element.querySelector('#dt-count');
    const drawings = this.dt.drawingManager.drawings;
    
    if (count) count.textContent = String(drawings.length);
    if (!list) return;

    if (!drawings.length) {
      list.innerHTML = '<div class="muted">— nenhum desenho</div>';
      return;
    }

    list.innerHTML = drawings.map(d => `
      <div class="draw-row" data-id="${d.id}">
        <span>${d.type} <small class="muted">${d.id.slice(-4)}</small></span>
        <div class="draw-actions">
          <button title="${d.visible === false ? 'Mostrar' : 'Ocultar'}">${d.visible === false ? '🚫' : '👁️'}</button>
          <button title="Remover">🗑️</button>
        </div>
      </div>
    `).join('');

    this._attachDrawListEvents(list);
  }

  _attachDrawListEvents(list) {
    list.querySelectorAll('.draw-row').forEach(row => {
      const id = row.dataset.id;
      const drawing = this.dt.drawingManager.drawings.find(x => x.id === id);
      const [btnVis, btnDel] = row.querySelectorAll('button');

      row.addEventListener('click', () => {
        this.dt.selectedDrawing = drawing;
        this.refreshDrawList();
      });

      btnVis.addEventListener('click', (e) => {
        e.stopPropagation();
        drawing.visible = drawing.visible === false ? true : false;
        this.dt.drawingManager.sendToEngine();
        this.refreshDrawList();
      });

      btnDel.addEventListener('click', (e) => {
        e.stopPropagation();
        this.dt.drawingManager.remove(drawing);
      });
    });
  }

  refreshMAList() {
    const box = this.element.querySelector('#dt-ma-list');
    if (!box) return;
    
    const overlays = this.dt.overlayManager.overlays;
    if (!overlays.length) {
      box.textContent = '— nenhuma média';
      return;
    }

    box.innerHTML = overlays.map((o, i) => `
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
        this.dt.overlayManager.remove(i);
        this.dt.pushHistory('overlay_remove');
        this.refreshMAList();
      });
    });
  }

  readFibLevelsChecked() {
    const arr = [];
    this.element.querySelectorAll('#dt-fib-levels input[type="checkbox"]').forEach(input => {
      if (input.checked) arr.push(parseFloat(input.value));
    });
    return arr.length ? arr : this.fibLevels;
  }
}