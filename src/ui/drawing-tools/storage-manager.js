// src/ui/drawing-tools/storage-manager.js
// ============================================================
// Persistência de desenhos, estudos e estado visual.
// Contrato atual de viewport:
//   viewport: { x:{min,max}, y:{min,max} }
// ============================================================

const SCHEMA_NAME = 'ochart.drawings';
const SCHEMA_VERSION = 2;

export class StorageManager {
  constructor(drawingTools) {
    this.dt = drawingTools;
  }

  exportJSON() {
    return {
      schema: {
        name: SCHEMA_NAME,
        version: SCHEMA_VERSION
      },
      meta: {
        exportedAt: new Date().toISOString()
      },
      config: {
        type: this.dt.engine?.currentConfig?.type || 'line',
        scale: this.dt.engine?.currentConfig?.scale || 'logarithmic'
      },
      viewport: this.dt.engine?.getZoomState?.() || null,
      overlays: Array.isArray(this.dt.overlayManager?.overlays)
        ? this.dt.overlayManager.overlays
        : [],
      drawings: Array.isArray(this.dt.drawingManager?.drawings)
        ? this.dt.drawingManager.drawings
        : []
    };
  }

  applyJSON(obj) {
    if (!obj || typeof obj !== 'object') {
      throw new Error('JSON inválido');
    }

    // Compatibilidade com bundles antigos que guardavam o payload dentro de data.
    const payload = obj.data && typeof obj.data === 'object'
      ? { ...obj.data, ...obj }
      : obj;

    const engine = this.dt.engine;
    if (!engine) throw new Error('ChartEngine indisponível');

    const overlays = Array.isArray(payload.overlays) ? payload.overlays.slice() : [];
    const drawings = Array.isArray(payload.drawings) ? payload.drawings.slice() : [];

    this.dt.overlayManager.overlays = overlays;
    this.dt.drawingManager.drawings = drawings;

    // Primeiro restaura configuração estrutural. O viewport só é restaurado
    // depois, porque trocar Linha/Velas recria o Chart.js.
    if (payload.config?.scale) {
      engine.setScale(payload.config.scale);
    }

    if (payload.config?.type) {
      engine.setType(payload.config.type);
    }

    // Reaplica objetos depois de qualquer recriação do gráfico.
    this.dt.overlayManager.sendToEngine();
    this.dt.drawingManager.sendToEngine();

    const viewport = this._normalizeViewport(payload.viewport);
    if (viewport) {
      engine.setZoomState(viewport);
    }

    this.dt.toolbar.refreshMAList();
    this.dt.toolbar.refreshDrawList();
  }

  _normalizeViewport(viewport) {
    if (!viewport || typeof viewport !== 'object') return null;

    // Contrato atual.
    if (
      viewport.x &&
      Number.isFinite(Number(viewport.x.min)) &&
      Number.isFinite(Number(viewport.x.max))
    ) {
      const out = {
        x: {
          min: Number(viewport.x.min),
          max: Number(viewport.x.max)
        }
      };

      if (
        viewport.y &&
        Number.isFinite(Number(viewport.y.min)) &&
        Number.isFinite(Number(viewport.y.max))
      ) {
        out.y = {
          min: Number(viewport.y.min),
          max: Number(viewport.y.max)
        };
      }

      return out;
    }

    // Compatibilidade com bundles v1:
    // viewport:{min,max} representava somente X.
    if (
      Number.isFinite(Number(viewport.min)) &&
      Number.isFinite(Number(viewport.max))
    ) {
      return {
        x: {
          min: Number(viewport.min),
          max: Number(viewport.max)
        }
      };
    }

    return null;
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
      if (confirm('Falha ao salvar no servidor.\\nQuer baixar o JSON localmente?')) {
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

      const pad = n => String(n).padStart(2, '0');
      const d = new Date();
      const fname =
        `ochart-drawings-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}.json`;

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
