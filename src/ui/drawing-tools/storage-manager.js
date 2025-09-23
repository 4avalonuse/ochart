// src/ui/drawing-tools/storage-manager.js
// ============================================================
// Módulo responsável por salvar/carregar dados (JSON)
// ============================================================

export class StorageManager {
  constructor(drawingTools) {
    this.dt = drawingTools;
  }

  exportJSON() {
    return {
      schema: {
        name: 'ochart.drawings',
        version: 1
      },
      meta: {
        exportedAt: new Date().toISOString()
      },
      config: {
        type: this.dt.engine?.currentConfig?.type || 'line',
        scale: this.dt.engine?.currentConfig?.scale || 'logarithmic'
      },
      viewport: this.dt.engine?.getViewport?.() || null,
      overlays: this.dt.overlayManager.overlays,
      drawings: this.dt.drawingManager.drawings
    };
  }

  applyJSON(obj) {
    if (!obj || typeof obj !== 'object') {
      throw new Error('JSON inválido');
    }

    // Aceita tanto no root quanto dentro de "data"
    const payload = obj.drawings || obj.overlays ? obj : (obj.data || obj);

    // Restaura overlays e drawings
    this.dt.overlayManager.overlays = Array.isArray(payload.overlays) ? payload.overlays.slice() : [];
    this.dt.drawingManager.drawings = Array.isArray(payload.drawings) ? payload.drawings.slice() : [];

    // Aplica no chart
    this.dt.overlayManager.sendToEngine();
    this.dt.drawingManager.sendToEngine();

    // Viewport/config (opcional)
    if (payload.config?.scale) {
      this.dt.engine.setScale(payload.config.scale);
    }
    if (payload.config?.type) {
      this.dt.engine.setType(payload.config.type);
    }
    if (payload.viewport?.xMin != null && payload.viewport?.xMax != null) {
      this.dt.engine.setZoomState({
        min: payload.viewport.xMin,
        max: payload.viewport.xMax
      });
    }

    // Atualiza UI
    this.dt.toolbar.refreshMAList();
    this.dt.toolbar.refreshDrawList();
  }

  async saveJSON() {
    const id = prompt('Nome do arquivo (sem .json):', 'meu-setup');
    if (!id) return;

    try {
      const data = this.exportJSON();
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

      this.dt.flash(`Salvo em api/bundles/${id}.json`);
      
    } catch (e) {
      console.error(e);
      if (confirm('Falha ao salvar no servidor.\nQuer baixar o JSON localmente?')) {
        this.saveJSONDownload();
      } else {
        alert('Erro ao salvar: ' + e.message);
      }
    }
  }

  saveJSONDownload() {
    try {
      const data = this.exportJSON();
      const text = JSON.stringify(data, null, 2);
      const blob = new Blob([text], { type: 'application/json' });

      // Gera nome com timestamp
      const pad = n => String(n).padStart(2, '0');
      const d = new Date();
      const fname = `ochart-drawings-${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}.json`;

      // Cria link de download
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = fname;
      document.body.appendChild(a);
      a.click();
      URL.revokeObjectURL(a.href);
      a.remove();
      
      this.dt.flash('Desenhos salvos (JSON baixado).');
      
    } catch (err) {
      console.error(err);
      alert('Falha no download do JSON: ' + err.message);
    }
  }

  loadJSON() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json';
    
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      
      try {
        const text = await file.text();
        const obj = JSON.parse(text);
        this.applyJSON(obj);
        this.dt.flash('Desenhos carregados do JSON.');
      } catch (e) {
        console.error(e);
        alert('Falha ao carregar JSON: ' + e.message);
      }
    };
    
    input.click();
  }

  // Métodos para integração futura com backend
  async loadFromServer(id) {
    try {
      const url = `./api/bundles.php?action=load&id=${encodeURIComponent(id)}`;
      const res = await fetch(url);
      
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      
      const data = await res.json();
      this.applyJSON(data);
      this.dt.flash(`Carregado de api/bundles/${id}.json`);
      
    } catch (e) {
      console.error(e);
      throw new Error(`Erro ao carregar do servidor: ${e.message}`);
    }
  }

  async listSavedFiles() {
    try {
      const url = './api/bundles.php?action=list';
      const res = await fetch(url);
      
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      
      return await res.json();
      
    } catch (e) {
      console.error(e);
      return [];
    }
  }
}