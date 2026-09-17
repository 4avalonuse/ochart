// HUD de diagnóstico com ring buffer e console visível na página
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

export function mountHUD(root){
  if (!root) return;
  root.innerHTML = `
    <div id="hud" style="background:#052e16;color:#dcfce7;border-top:2px solid #22c55e;box-shadow:0 -3px 12px rgba(0,0,0,.25);font-family:ui-monospace,SFMono-Regular,Menlo,monospace">
      <div style="max-width:1100px;margin:0 auto;padding:8px;display:flex;gap:8px;align-items:center;flex-wrap:wrap">
        <button id="hud-toggle" style="padding:7px 10px;border:1px solid #22c55e;border-radius:8px;background:#166534;color:#fff;cursor:pointer">LOGS</button>
        <span style="color:#86efac;font-weight:600">OChart Console</span>
        <select id="hud-filter" style="padding:5px 6px;border:1px solid #22c55e;border-radius:6px;background:#14532d;color:#dcfce7"><option value="all">all</option><option value="info">info</option><option value="warn">warn</option><option value="error">error</option></select>
        <button id="hud-copy" style="padding:7px 10px;border:1px solid #22c55e;border-radius:8px;background:#14532d;color:#dcfce7;cursor:pointer">Copiar</button>
        <button id="hud-clear" style="padding:7px 10px;border:1px solid #22c55e;border-radius:8px;background:#14532d;color:#dcfce7;cursor:pointer">Limpar</button>
      </div>
      <div id="hud-body" style="display:none;height:260px;overflow:auto;border-top:1px solid #166534;background:#031b0d"><pre id="hud-pre" style="margin:0;padding:10px;white-space:pre-wrap;word-break:break-word;font-size:12px;line-height:1.45"></pre></div>
    </div>`;

  const pre = root.querySelector('#hud-pre');
  const body = root.querySelector('#hud-body');
  const filterSel = root.querySelector('#hud-filter');

  function render(){
    const level = filterSel.value;
    const rows = getState().ring.filter(ev => level === 'all' || ev.level === level);
    pre.textContent = rows.map(ev => {
      const time = new Date(ev.ts).toLocaleTimeString('pt-BR');
      const data = ev.data === undefined ? '' : ` ${JSON.stringify(ev.data)}`;
      return `[${time}] [${String(ev.level).toUpperCase()}] ${ev.msg}${data}`;
    }).join('\n');
    pre.scrollTop = pre.scrollHeight;
  }

  // Logger global: permite que logger.js envie eventos diretamente ao HUD.
  window.pushLog = pushLog;
  window.__HUD__ = { pushLog, getState };

  render();
  subscribe(render);

  root.querySelector('#hud-toggle').onclick = ()=> {
    body.style.display = body.style.display === 'none' ? 'block' : 'none';
    if (body.style.display !== 'none') render();
  };

  root.querySelector('#hud-copy').onclick = async ()=> {
    try {
      await navigator.clipboard.writeText(getState().ring.map(ev => JSON.stringify(ev)).join('\n'));
      pushLog({ level:'info', msg:'Logs copiados' });
    } catch (e) {
      pushLog({ level:'error', msg:'Falha ao copiar logs', data:String(e) });
    }
  };

  root.querySelector('#hud-clear').onclick = ()=> { ring.splice(0, ring.length); render(); };
  filterSel.onchange = render;
}

function subscribe(fn){ subs.add(fn); return ()=> subs.delete(fn); }
