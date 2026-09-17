// HUD de diagnóstico com ring buffer e console visível na página.
// Formata os eventos para leitura rápida sem perder os dados técnicos.
const RING_MAX = 500;
const ring = [];
const subs = new Set();

export function pushLog(ev){
  try{
    const row = { ts: Date.now(), level:'info', msg:'', ...ev };
    ring.push(row);
    if(ring.length > RING_MAX) ring.shift();
    subs.forEach(fn => fn(getState()));
  }catch(e){ console.warn('pushLog failed', e); }
}

export function getState(){ return { ring: ring.slice(-RING_MAX) }; }

function timeOf(ts){
  try { return new Date(ts).toLocaleTimeString('pt-BR'); }
  catch { return '--:--:--'; }
}

function dataOf(data){
  try { return JSON.stringify(data, null, 2); }
  catch { return String(data); }
}

export function mountHUD(root){
  if (!root) return;
  root.innerHTML = `
    <div id="hud" style="background:#052e16;color:#dcfce7;border-top:2px solid #22c55e;box-shadow:0 -3px 12px rgba(0,0,0,.25);font-family:ui-monospace,SFMono-Regular,Menlo,monospace">
      <div style="max-width:1100px;margin:0 auto;padding:8px;display:flex;gap:7px;align-items:center;flex-wrap:wrap">
        <button id="hud-toggle" style="padding:7px 10px;border:1px solid #22c55e;border-radius:8px;background:#166534;color:#fff;font-weight:700;cursor:pointer">▣ LOGS</button>
        <span style="color:#86efac;font-weight:700">OChart Console</span>
        <select id="hud-filter" style="padding:5px 6px;border:1px solid #22c55e;border-radius:6px;background:#14532d;color:#dcfce7">
          <option value="all">Todos</option><option value="info">Info</option><option value="warn">Avisos</option><option value="error">Erros</option>
        </select>
        <button id="hud-copy" style="padding:7px 10px;border:1px solid #22c55e;border-radius:8px;background:#14532d;color:#dcfce7;cursor:pointer">Copiar</button>
        <button id="hud-clear" style="padding:7px 10px;border:1px solid #22c55e;border-radius:8px;background:#14532d;color:#dcfce7;cursor:pointer">Limpar</button>
        <span id="hud-count" style="margin-left:auto;color:#86efac;font-size:11px">0 eventos</span>
      </div>
      <div id="hud-body" style="display:none;max-height:300px;overflow:auto;border-top:1px solid #166534;background:#031b0d">
        <div id="hud-list" style="padding:6px"></div>
      </div>
    </div>`;

  const list = root.querySelector('#hud-list');
  const body = root.querySelector('#hud-body');
  const filterSel = root.querySelector('#hud-filter');
  const count = root.querySelector('#hud-count');

  function render(){
    const level = filterSel.value;
    const rows = getState().ring.filter(ev => level === 'all' || ev.level === level);
    count.textContent = `${rows.length} evento${rows.length === 1 ? '' : 's'}`;
    list.textContent = '';

    rows.forEach(ev => {
      const item = document.createElement('div');
      item.style.cssText = 'padding:7px 4px;border-bottom:1px solid #14532d;line-height:1.35;word-break:break-word;';

      const line = document.createElement('div');
      const badge = document.createElement('span');
      const kind = ev.level === 'error' ? 'ERRO' : ev.level === 'warn' ? 'WARN' : 'INFO';
      const bg = ev.level === 'error' ? '#991b1b' : ev.level === 'warn' ? '#854d0e' : '#15803d';
      badge.textContent = kind;
      badge.style.cssText = `display:inline-block;min-width:34px;margin-right:7px;padding:1px 4px;border-radius:4px;background:${bg};color:#fff;text-align:center;font-size:9px;font-weight:800;`;

      const time = document.createElement('span');
      time.textContent = timeOf(ev.ts);
      time.style.cssText = 'color:#86efac;font-size:10px;margin-right:8px;';

      const msg = document.createElement('span');
      msg.textContent = ev.msg || '(sem mensagem)';
      msg.style.cssText = 'color:#f0fff5;font-weight:600;';
      line.append(time, badge, msg);
      item.appendChild(line);

      // Dados continuam completos, mas ficam recolhidos para não poluir a tela.
      if(ev.data !== undefined){
        const details = document.createElement('details');
        details.style.marginTop = '4px';
        const summary = document.createElement('summary');
        summary.textContent = '▸ dados técnicos';
        summary.style.cssText = 'color:#86efac;font-size:10px;cursor:pointer;';
        const pre = document.createElement('pre');
        pre.textContent = dataOf(ev.data);
        pre.style.cssText = 'margin:5px 0 0;padding:7px;background:#02160a;border:1px solid #14532d;border-radius:5px;color:#bbf7d0;white-space:pre-wrap;font-size:10px;overflow:auto;';
        details.append(summary, pre);
        item.appendChild(details);
      }
      list.appendChild(item);
    });

    if(!rows.length){
      const empty = document.createElement('div');
      empty.textContent = 'Nenhum log neste filtro.';
      empty.style.cssText = 'padding:14px;color:#86efac;text-align:center;font-size:11px;';
      list.appendChild(empty);
    }
    list.parentElement.scrollTop = list.parentElement.scrollHeight;
  }

  window.pushLog = pushLog;
  window.__HUD__ = { pushLog, getState };

  render();
  subscribe(render);

  root.querySelector('#hud-toggle').onclick = (e)=> {
    const open = body.style.display === 'none';
    body.style.display = open ? 'block' : 'none';
    e.currentTarget.textContent = open ? '▾ FECHAR LOGS' : '▣ LOGS';
    if(open) render();
  };

  root.querySelector('#hud-copy').onclick = async ()=> {
    try {
      await navigator.clipboard.writeText(getState().ring.map(ev => JSON.stringify(ev)).join('\n'));
      pushLog({ level:'info', msg:'Logs copiados' });
    } catch(e) {
      pushLog({ level:'error', msg:'Falha ao copiar logs', data:String(e) });
    }
  };

  root.querySelector('#hud-clear').onclick = ()=> { ring.splice(0, ring.length); render(); };
  filterSel.onchange = render;
}

function subscribe(fn){ subs.add(fn); return ()=> subs.delete(fn); }
