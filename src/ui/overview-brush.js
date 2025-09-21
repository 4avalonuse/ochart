// Mini gráfico de visão geral com "brush" via chartjs-plugin-zoom (drag na horizontal)
export class OverviewBrush {
  constructor(root, data = [], { onChange } = {}){
    this.root = root;
    this.onChange = typeof onChange === 'function' ? onChange : null;
    this.canvas = document.createElement('canvas');
    this.canvas.style.height = '120px';
    this.canvas.style.width = '100%';
    this.root.innerHTML = '';
    this.root.appendChild(this.canvas);
    this._build(data);
  }
  _build(rows){
    const ds = (Array.isArray(rows)?rows:[]).map(r=> ({ x:r.t, y:r.c }));
    const ctx = this.canvas.getContext('2d');
    const self = this;
    this.chart = new Chart(ctx, {
      data:{ datasets:[{ type:'line', label:'Overview', data:ds, pointRadius:0, borderWidth:1 }]},
      options:{
        parsing:false, animation:false, normalized:true, responsive:true, maintainAspectRatio:false,
        interaction:{ mode:'index', intersect:false },
        scales:{ x:{ type:'time', ticks:{ maxRotation:0 } }, y:{ type:'linear', display:false } },
        plugins:{
          legend:{ display:false },
          zoom:{
            limits: { x: { min: 'original', max: 'original' } },
            pan: { enabled:false },
            zoom: {
              drag: { enabled:true },
              mode:'x',
              onZoom({ chart }){
                const s = chart.scales.x;
                self._emit(s.min, s.max);
              }
            }
          }
        }
      }
    });
  }
  _emit(min, max){
    if (this.onChange) this.onChange({ min, max });
  }
  update(rows){
    const ds = (Array.isArray(rows)?rows:[]).map(r=> ({ x:r.t, y:r.c }));
    this.chart.data.datasets[0].data = ds;
    this.chart.resetZoom();
    this.chart.update('none');
    const s = this.chart.scales.x;
    this._emit(s.min, s.max);
  }
  setWindow(min, max){
    if (!this.chart) return;
    if (this.chart.zoomScale) {
      this.chart.zoomScale('x', { min, max });
    } else {
      this.chart.options.scales.x.min = min;
      this.chart.options.scales.x.max = max;
      this.chart.update();
      this._emit(min, max);
    }
  }
  reset(){
    if (!this.chart) return;
    if (this.chart.resetZoom) this.chart.resetZoom();
    const s = this.chart.scales.x;
    this._emit(s.min, s.max);
  }
  getDomain(){
    const s = this.chart?.scales?.x;
    return s ? { min: s.min, max: s.max } : null;
  }
}
