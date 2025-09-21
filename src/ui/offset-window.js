export class OffsetWindow {
  constructor(root, { max = 0, finish = null, start = null, onApply = null } = {}){
    this.root = root;
    this.max = Math.max(0, max|0);
    this.finish = (finish == null ? this.max : clamp(finish, 0, this.max));
    this.start  = (start  == null ? 0       : clamp(start,  0, this.max));
    if (this.finish < this.start) this.finish = this.start;
    this.onApply = typeof onApply === 'function' ? onApply : null;
    this.render();
  }
  render(){
    this.root.innerHTML = `
      <style>
        .ow{display:flex; flex-wrap:wrap; gap:8px; align-items:center}
        .ow .num{width:90px; padding:6px 8px; border:1px solid #d1d5db; border-radius:8px}
        .ow .btn{padding:6px 10px; border:1px solid #d1d5db; border-radius:8px; background:#fff; cursor:pointer}
        .ow .badge{font-size:12px; color:#374151; background:#e5e7eb; padding:2px 6px; border-radius:6px}
      </style>
      <div class="ow">
        <span class="badge">max=<b id="ow-max">${this.max}</b></span>
        <label>finish</label>
        <input id="ow-finish" class="num" type="number" min="0" max="${this.max}" value="${this.finish}"/>
        <label>start</label>
        <input id="ow-start"  class="num" type="number" min="0" max="${this.max}" value="${this.start}"/>
        <button id="ow-apply" class="btn">Aplicar</button>
        <button id="ow-full"  class="btn">Full</button>
        <span class="badge">size=<b id="ow-size">${this.size()}</b></span>
      </div>
    `;
    const fin = this.root.querySelector('#ow-finish');
    const sta = this.root.querySelector('#ow-start');
    const sizeEl = this.root.querySelector('#ow-size');

    const clampInputs = ()=>{
      let f = clamp(+fin.value, 0, this.max);
      let s = clamp(+sta.value, 0, this.max);
      if (f < s) f = s;
      fin.value = f; sta.value = s;
      this.finish = f; this.start = s;
      sizeEl.textContent = this.size();
    };
    fin.oninput = clampInputs;
    sta.oninput = clampInputs;

    this.root.querySelector('#ow-apply').onclick = ()=> {
      clampInputs();
      this.onApply && this.onApply(this.get());
    };
    this.root.querySelector('#ow-full').onclick = ()=> {
      this.finish = this.max; this.start = 0;
      fin.value = this.finish; sta.value = this.start;
      sizeEl.textContent = this.size();
      this.onApply && this.onApply(this.get());
    };
  }
  setMax(max){
    const M = Math.max(0, max|0);
    this.max = M;
    this.finish = clamp(this.finish, 0, M);
    this.start  = clamp(this.start,  0, M);
    if (this.finish < this.start) this.finish = this.start;
    this.render();
  }
  setWindow({ finish, start }){
    this.finish = clamp(finish, 0, this.max);
    this.start  = clamp(start,  0, this.max);
    if (this.finish < this.start) this.finish = this.start;
    this.render();
  }
  size(){ return (this.finish - this.start) + 1; }
  get(){ return { max: this.max, finish: this.finish, start: this.start, size: this.size() }; }
}
function clamp(v, a, b){ v = v|0; if(v<a) return a; if(v>b) return b; return v; }
