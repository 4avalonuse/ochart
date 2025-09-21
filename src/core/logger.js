// Logger simples com prefixo [ochart], e fallback para console.
// Se houver um pushLog global (do HUD), usamos também.
const tag = (label, color) => [
  `%c[ochart:${label}]`,
  `color:${color};font-weight:600`
];

function callPush(level, msg, data){
  try{
    if (typeof window !== 'undefined' && typeof window.pushLog === 'function') {
      window.pushLog({ level, msg, ts: Date.now(), data });
    } else if (typeof pushLog === 'function') {
      pushLog({ level, msg, ts: Date.now(), data });
    }
  }catch{ /* noop */ }
}

export const log  = (msg, data)=>{ console.log(...tag('log',  '#6b7280'), msg, data||''); callPush('info', String(msg), data); };
export const info = (msg, data)=>{ console.info(...tag('info', '#2563eb'), msg, data||''); callPush('info', String(msg), data); };
export const warn = (msg, data)=>{ console.warn(...tag('warn', '#d97706'), msg, data||''); callPush('warn', String(msg), data); };
export const err  = (msg, data)=>{ console.error(...tag('err',  '#dc2626'), msg, data||''); callPush('error', String(msg), data); };

export const group = (title)=> console.group(...tag('log', '#6b7280'), title);
export const groupEnd = ()=> console.groupEnd();
