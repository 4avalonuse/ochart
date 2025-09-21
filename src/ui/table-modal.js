// Modal simples para mostrar a tabela da janela atual (OHLCV).
export class TableModal {
  constructor(){
    this.el = document.createElement('div');
    this.el.innerHTML = `
<style>
  .tm-backdrop {
    position:fixed; inset:0;
    background:rgba(0,0,0,.55);
    display:flex; align-items:center; justify-content:center;
    z-index:60;
  }
  .tm-card {
    background: var(--ui-panel, #fff);
    color: var(--ui-text, #111);
    border-radius:12px;
    box-shadow:0 10px 30px rgba(0,0,0,.4);
    width:min(1000px,92vw);
    max-height:80vh;
    display:flex; flex-direction:column;
  }
  .tm-head {
    padding:10px 14px;
    border-bottom:1px solid var(--ui-border, #e5e7eb);
    display:flex; align-items:center; gap:8px;
    background: var(--ui-panel-2, #f9fafb);
  }
  .tm-body { overflow:auto; }
  .tm-foot {
    padding:10px 14px;
    border-top:1px solid var(--ui-border, #e5e7eb);
    display:flex; gap:8px; justify-content:flex-end;
    background: var(--ui-panel-2, #f9fafb);
    color: var(--ui-text-dim, #6b7280);
  }
  .tm-title { font-weight:600; }
  .tm-btn {
    padding:6px 10px;
    border:1px solid var(--ui-border, #e5e7eb);
    border-radius:8px;
    background: var(--ui-panel-2, #f9fafb);
    color: var(--ui-text, #111);
    cursor:pointer;
  }
  .tm-btn:hover { background: var(--ui-panel, #fff); }
  table { border-collapse:collapse; width:100%; color: var(--ui-text, #111); }
  th, td {
    padding:6px 8px;
    border-bottom:1px solid var(--ui-border, #e5e7eb);
    text-align:right;
    white-space:nowrap;
  }
  th:first-child, td:first-child { text-align:left; }
  thead th {
    position:sticky; top:0;
    background: var(--ui-panel, #fff);
    border-bottom:1px solid var(--ui-border, #e5e7eb);
    color: var(--ui-text-dim, #6b7280);
  }
  .muted { color: var(--ui-text-dim, #6b7280); font-size:12px; }
</style>

      <div class="tm-backdrop" part="backdrop">
        <div class="tm-card" role="dialog" aria-modal="true">
          <div class="tm-head">
            <div class="tm-title">Tabela (janela atual)</div>
            <div class="muted" id="tm-count"></div>
            <div style="flex:1"></div>
            <button class="tm-btn" id="tm-export">Export CSV</button>
            <button class="tm-btn" id="tm-close">Fechar</button>
          </div>
          <div class="tm-body">
            <table id="tm-table">
              <thead>
                <tr><th>Data</th><th>Open</th><th>High</th><th>Low</th><th>Close</th><th>Volume</th></tr>
              </thead>
              <tbody></tbody>
            </table>
          </div>
          <div class="tm-foot muted">
            Dica: role para ver mais linhas · Ordenação simples (clique nos cabeçalhos) — em breve
          </div>
        </div>
      </div>
    `;
    this.el.querySelector('#tm-close').onclick = ()=> this.hide();
    this.el.addEventListener('keydown', (e)=> { if(e.key==='Escape') this.hide(); });
  }
  show(rows = []){
    this._rows = Array.isArray(rows) ? rows.slice() : [];
    const tbody = this.el.querySelector('#tm-table tbody');
    const fmt = (n)=> Number.isFinite(+n) ? (+n).toLocaleString(undefined, {maximumFractionDigits: 8}) : '—';
    const tstr = (t)=> new Date(t).toLocaleString();
    tbody.innerHTML = this._rows.map(r =>
      `<tr><td>${tstr(r.t)}</td><td>${fmt(r.o)}</td><td>${fmt(r.h)}</td><td>${fmt(r.l)}</td><td>${fmt(r.c)}</td><td>${fmt(r.v)}</td></tr>`
    ).join('');
    this.el.querySelector('#tm-count').textContent = `(${this._rows.length} linhas)`;
    document.body.appendChild(this.el);
  }
  hide(){
    this.el.parentNode && this.el.parentNode.removeChild(this.el);
  }
  exportCSV(filename = `ochart_${Date.now()}.csv`){
    const rows = this._rows || [];
    if (!rows.length) return;
    const headers = ['t','o','h','l','c','v'];
    const csv = [headers.join(','),
      ...rows.map(r => `${new Date(r.t).toISOString()},${r.o??''},${r.h??''},${r.l??''},${r.c??''},${r.v??''}`)
    ].join('\n');
    const blob = new Blob([csv], {type:'text/csv'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
  }
}
