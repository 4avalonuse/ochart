/**
 * ChartZoom — viewport horizontal + escala vertical no mobile.
 * 1 dedo: navega no tempo; 2 dedos: zoom temporal; toque na escala Y: escala vertical.
 */
export class ChartZoom {
  constructor(chart = null) { this.chart = null; this._touches = new Map(); this._touchStart = null; this._bound = false; this._verticalGesture = null; this.priceScaleHitWidth = 72; this.attach(chart); }
  attach(chart) { this._unbindTouch(); this.chart = chart; this._bindTouch(); return this; }
  reset() { if (!this.chart?.resetZoom) return false; this.chart.resetZoom(); return true; }
  zoomBy(factor = 1) {
    const scale = this.chart?.scales?.x;
    if (!scale || !this.chart?.zoomScale || !Number.isFinite(factor) || factor <= 0) return false;
    const min = Number(scale.min), max = Number(scale.max);
    if (!Number.isFinite(min) || !Number.isFinite(max) || max <= min) return false;
    const center = (min + max) / 2, half = (max - min) * factor / 2;
    this.chart.zoomScale('x', { min: center - half, max: center + half }, 'none'); return true;
  }
  getState() { const x = this.chart?.scales?.x, y = this.chart?.scales?.y; return x ? { min:x.min, max:x.max, yMin:y?.min, yMax:y?.max } : null; }
  setState(state) {
    if (!this.chart || !state || !this.chart.zoomScale) return;
    this.chart.zoomScale('x', { min:state.min, max:state.max }, 'none');
    if (Number.isFinite(state.yMin) && Number.isFinite(state.yMax)) this.chart.zoomScale('y', { min:state.yMin, max:state.yMax }, 'none');
  }
  hardenWithoutHammer() { const zoom=this.chart?.options?.plugins?.zoom; if(zoom){ if(zoom.zoom?.pinch) zoom.zoom.pinch.enabled=false; if(zoom.pan) zoom.pan.enabled=false; } }
  _bindTouch() {
    const canvas=this.chart?.canvas; if(!canvas || this._bound) return;
    this._onTouchStart=event=>{
      if(!event.touches?.length) return; event.preventDefault();
      this._touches=new Map([...event.touches].map(t=>[t.identifier,{x:t.clientX,y:t.clientY}]));
      const x=this.chart?.scales?.x;
      this._touchStart=x?{min:x.min,max:x.max,distance:this._touchDistance(event.touches)}:null;
      this._verticalGesture=null;
      if(event.touches.length===1 && this._isPriceScaleZone(event.touches[0],canvas)){
        const y=this.chart?.scales?.y, rect=canvas.getBoundingClientRect();
        if(y){ const startY=event.touches[0].clientY-rect.top, anchor=Number(y.getValueForPixel(startY)), min=Number(y.min), max=Number(y.max); if(Number.isFinite(anchor)&&Number.isFinite(min)&&Number.isFinite(max)&&max>min) this._verticalGesture={startY,anchor,min,max}; }
      }
    };
    this._onTouchMove=event=>{
      if(!this.chart || !this._touchStart || !event.touches?.length) return; event.preventDefault();
      const x=this.chart.scales?.x, y=this.chart.scales?.y; if(!x) return;
      if(event.touches.length===1 && this._verticalGesture && y){
        const dy=event.touches[0].clientY-this._verticalGesture.startY; if(Math.abs(dy)<2) return;
        const {anchor,min,max}=this._verticalGesture, factor=Math.exp(-dy/220);
        const nextMin=anchor-(anchor-min)*factor, nextMax=anchor+(max-anchor)*factor;
        if(Number.isFinite(nextMin)&&Number.isFinite(nextMax)&&nextMax>nextMin) this.chart.zoomScale('y',{min:nextMin,max:nextMax},'none');
        return;
      }
      if(event.touches.length>=2){
        this._verticalGesture=null; const distance=this._touchDistance(event.touches), startDistance=this._touchStart.distance;
        if(!Number.isFinite(distance)||distance<=0||!Number.isFinite(startDistance)||startDistance<=0) return;
        const ratio=startDistance/distance, rect=canvas.getBoundingClientRect(), centerValue=x.getValueForPixel(this._touchCenterX(event.touches)-rect.left), startMin=Number(this._touchStart.min), startMax=Number(this._touchStart.max);
        if(!Number.isFinite(centerValue)) return;
        const nextMin=centerValue-(centerValue-startMin)*ratio, nextMax=centerValue+(startMax-centerValue)*ratio;
        if(nextMax>nextMin) this.chart.zoomScale('x',{min:nextMin,max:nextMax},'none'); return;
      }
      const touch=event.touches[0], previous=this._touches.get(touch.identifier); if(!previous) return;
      const dx=touch.clientX-previous.x, rect=canvas.getBoundingClientRect(), px=touch.clientX-rect.left, previousValue=x.getValueForPixel(px), currentValue=x.getValueForPixel(px-dx), delta=Number(currentValue)-Number(previousValue);
      if(Number.isFinite(delta)) this.chart.zoomScale('x',{min:Number(x.min)+delta,max:Number(x.max)+delta},'none');
      this._touches.set(touch.identifier,{x:touch.clientX,y:touch.clientY});
    };
    this._onTouchEnd=event=>{ event.preventDefault(); if(!event.touches?.length){this._touches.clear();this._touchStart=null;this._verticalGesture=null;} else {this._touches=new Map([...event.touches].map(t=>[t.identifier,{x:t.clientX,y:t.clientY}])); if(event.touches.length!==1)this._verticalGesture=null;} };
    canvas.addEventListener('touchstart',this._onTouchStart,{passive:false}); canvas.addEventListener('touchmove',this._onTouchMove,{passive:false}); canvas.addEventListener('touchend',this._onTouchEnd,{passive:false}); canvas.addEventListener('touchcancel',this._onTouchEnd,{passive:false}); canvas.style.touchAction='none'; this._bound=true;
  }
  _unbindTouch(){ const canvas=this.chart?.canvas; if(canvas&&this._bound){canvas.removeEventListener('touchstart',this._onTouchStart);canvas.removeEventListener('touchmove',this._onTouchMove);canvas.removeEventListener('touchend',this._onTouchEnd);canvas.removeEventListener('touchcancel',this._onTouchEnd);canvas.style.touchAction='';} this._touches.clear();this._touchStart=null;this._verticalGesture=null;this._bound=false; }
  _isPriceScaleZone(touch,canvas){ const rect=canvas.getBoundingClientRect(); return touch.clientX>=rect.right-this.priceScaleHitWidth; }
  _touchDistance(touches){ if(touches.length<2)return 0; const a=touches[0],b=touches[1]; return Math.hypot(b.clientX-a.clientX,b.clientY-a.clientY); }
  _touchCenterX(touches){ return touches.length<2?(touches[0]?.clientX||0):(touches[0].clientX+touches[1].clientX)/2; }
}
