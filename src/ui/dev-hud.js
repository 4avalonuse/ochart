// HUD leve com ring buffer e cópia JSONL
const RING_MAX = 500;
const ring = []; // {ts, level, msg, data?}
const subs = new Set();

export function pushLog(ev){
  try{
    const row = { ts: Date.now(), level:'info', msg:'', ...ev };
    ring.push(row);
    if(ring.length > RING_MAX) ring.shift();
    subs.forEach(fn => fn(getState()));
  }catch(e){ console.warn('pushLog failed', e); }
}

export function getState(){
  return {
    ring: ring.slice(-RING_MAX)
  };
}

export function mountHUD(root){
  root.innerHTML = `
    <div id="hud" style="background:#fff;border-top:1px solid #e5e7eb;box-shadow:0 -2px 6px rgba(0,0,0,.04)">
      <div style="max-width:1100px;margin:0 auto;padding:8px;display:flex;gap:8px;align-items:center;flex-wrap:wrap">
        <button id="hud-toggle" style="padding:6px 10px;border:1px solid #d1d5db;border-radius:8px;background:#fff;cursor:pointer">Dev HUD</button>
        <span style="color:#6b7280">Logs:</span>
        <select id="hud-filter" style="padding:2px 6px;border:1px solid #d1d5db;border-radius:6px">
          <option value="all">all</option>
          <option value="info">info</option>
          <option value="warn">warn</option>
          <option value="error">error</option>
        </select>
        <button id="hud-copy" style="padding:6px 10px;border:1px solid #d1d5db;border-radius:8px;background:#fff;cursor:pointer">Copiar JSONL</button>
        <button id="hud-clear" style="padding:6px 10px;border:1px solid #d1d5db;border-radius:8px;background:#fff;cursor:pointer">Limpar</button>
      </div>
      <div id="hud-body" style="display:none;max-height:220px;overflow:auto;border-top:1px solid #e5e7eb">
        <pre id="hud-pre" style="padding:8px;white-space:pre-wrap"></pre>
      </div>
    </div>
  `;

  const pre = root.querySelector('#hud-pre');
  const body = root.querySelector('#hud-body');
  const filterSel = root.querySelector('#hud-filter');
  const toggleBtn = root.querySelector('#hud-toggle');

  function render(){
    const level = filterSel.value;
    const rows = getState().ring.filter(ev => level==='all' ? true : ev.level===level);
    pre.textContent = rows.map(ev => JSON.stringify(ev)).join('\n');
  }
  render();
  const unsub = subscribe(render);

  toggleBtn.onclick = ()=> body.style.display = (body.style.display==='none'?'block':'none');
  root.querySelector('#hud-copy').onclick = ()=> {
    const rows = getState().ring.map(ev => JSON.stringify(ev)).join('\n');
    navigator.clipboard.writeText(rows).then(()=> console.info('HUD: logs copiados'));
  };
  root.querySelector('#hud-clear').onclick = ()=> { ring.splice(0, ring.length); render(); };
  filterSel.onchange = render;

  // expõe para debug
  window.__HUD__ = { pushLog, getState };
}

function subscribe(fn){
  subs.add(fn);
  return ()=> subs.delete(fn);
}
