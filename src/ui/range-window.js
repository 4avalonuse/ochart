// Janela por offsets "a partir do fim"
export class RangeWindow {
  constructor(root, { max = 0, left = null, right = null, onChange = null } = {}){
    this.root = root;
    this.max = Math.max(0, max|0);
    this.onChange = typeof onChange === 'function' ? onChange : null;
    this.left = (left == null) ? this.max : clamp(left, 0, this.max);
    this.right = (right == null) ? 0 : clamp(right, 0, this.max);
    if (this.left < this.right) { const t=this.left; this.left=this.right; this.right=t; }
    this.render();
  }
  render(){
    this.root.innerHTML = `
      <style>
        .rw-wrap{display:inline-flex; align-items:center; gap:8px; flex-wrap:wrap}
        .rw-sliders{display:inline-flex; align-items:center; gap:6px}
        .rw-sliders input[type=range]{width:200px}
        .rw-badge{font-size:12px; color:#374151; background:#e5e7eb; padding:2px 6px; border-radius:6px}
      </style>
      <div class="rw-wrap">
        <div class="rw-sliders">
          <input id="rw-left"  type="range" min="0" max="${this.max}" step="1" value="${this.left}" title="Mais antiga (offset a partir do fim)">
          <input id="rw-right" type="range" min="0" max="${this.max}" step="1" value="${this.right}" title="Mais recente (offset a partir do fim)">
        </div>
        <span class="rw-badge">left=<b id="rw-left-val">${this.left}</b></span>
        <span class="rw-badge">right=<b id="rw-right-val">${this.right}</b></span>
        <span class="rw-badge">size=<b id="rw-size-val">${this.size()}</b></span>
      </div>
    `;
    const leftEl = this.root.querySelector('#rw-left');
    const rightEl = this.root.querySelector('#rw-right');
    const update = (which)=>{
      let l = +leftEl.value|0;
      let r = +rightEl.value|0;
      if (which === 'left' && l < r) r = l;
      if (which === 'right' && r > l) l = r;
      leftEl.value = l; rightEl.value = r;
      this.left = l; this.right = r;
      this._syncBadges();
      this.onChange && this.onChange(this.get());
    };
    leftEl.oninput = ()=> update('left');
    rightEl.oninput = ()=> update('right');
  }
  _syncBadges(){
    this.root.querySelector('#rw-left-val').textContent  = this.left;
    this.root.querySelector('#rw-right-val').textContent = this.right;
    this.root.querySelector('#rw-size-val').textContent  = this.size();
  }
  size(){ return (this.left - this.right) + 1; }
  setMax(max){
    const M = Math.max(0, max|0);
    this.max = M;
    this.left  = clamp(this.left,  0, M);
    this.right = clamp(this.right, 0, M);
    if (this.left < this.right) { const t=this.left; this.left=this.right; this.right=t; }
    this.render();
  }
  setWindow({ left, right }){
    const l = clamp(left, 0, this.max);
    const r = clamp(right, 0, this.max);
    this.left = Math.max(l, r);
    this.right = Math.min(l, r);
    this.render();
  }
  get(){ return { max: this.max, left: this.left, right: this.right, size: this.size() }; }
}
function clamp(v, a, b){ v = v|0; if(v<a) return a; if(v>b) return b; return v; }
