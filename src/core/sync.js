import { sanitizeLine } from './sanitizer.js';
import { fetchSeries } from './data-loader.js';
import { render } from './renderer.js';
import { pushLog } from '../ui/dev-hud.js';
import { OffsetWindow } from '../ui/offset-window.js';

let fullRows = [];
let ow = null;

export async function sync(engine, tf, currentScale, currentType) {
  document.getElementById('status').textContent = 'Carregando...';
  pushLog({ level:'info', msg:'sync_start', ts:Date.now(), data:{ tf, scale:currentScale }});
  try{
    const payload = await fetchSeries(tf, currentScale);
    const data = Array.isArray(payload?.data) ? payload.data : [];
    const meta = payload?.meta || {};
    const { data: rows, stats } = sanitizeLine(data, { requirePositive: currentScale==='logarithmic' });
    fullRows = rows;

    if (stats) {
      pushLog({ level:(stats.droppedInvalid>0?'warn':'info'), msg:'sanitize_report_front', ts:Date.now(), data:stats });
    }

    const max = Math.max(0, rows.length-1);
    if(!ow){
      ow = new OffsetWindow(document.getElementById('ow'),{
        max, finish:max, start:0,
        onApply:({ max, finish, start })=>{
          const sliced = sliceByOffsets(fullRows, finish, start);
          pushLog({ level:'info', msg:'window_offsets', ts:Date.now(), data:{ max, finish, start, size:sliced.data.length, idxStart:sliced.a, idxEnd:sliced.b }});
          render(engine, sliced.data, currentScale, currentType);
          document.getElementById('status').textContent = `OK (janela: ${sliced.data.length})`;
        }
      });
    } else {
      ow.setMax(max);
      ow.setWindow({ finish:max, start:0 });
    }

    const sliced = sliceByOffsets(rows, Math.max(0, rows.length-1), 0);
    render(engine, sliced.data, currentScale, currentType);

    const src = meta?.source || (meta?.sanitized ? 'php' : 'static');
    document.getElementById('status').textContent = `OK (${currentScale==='logarithmic'?'Log':'Linear'} | fonte: ${src})`;
    pushLog({ level:'info', msg:'sync_ok', ts:Date.now(), data:{ bars:rows.length, scale:currentScale, source: src }});
  }catch(e){
    console.error(e);
    document.getElementById('status').textContent = 'Falha';
    pushLog({ level:'error', msg:'sync_fail', ts:Date.now(), data:{ error:String(e) }});
    alert('Erro: ' + e.message);
  }
}

function sliceByOffsets(rows, finish, start){
  const n = rows.length;
  if(!n) return { data:[], a:0, b:0, left:0, right:0 };
  const max = Math.max(0, n-1);
  const F = Math.min(Math.max(0, finish|0), max);
  const S = Math.min(Math.max(0, start|0), max);
  const left = Math.max(F, S);
  const right = Math.min(F, S);
  const idxStart = (n-1) - left;
  const idxEnd   = (n-1) - right;
  const a = Math.max(0, Math.min(idxStart, idxEnd));
  const b = Math.max(0, Math.max(idxStart, idxEnd));
  return { data:rows.slice(a, b+1), a, b, left, right };
}
