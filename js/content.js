/* Integração visual mínima para Chart.js:
   - adiciona "pontinhos" (pointRadius) em cada dado
   - melhora tooltips, grids e aparência geral
   - NÃO altera a lógica de dados do projeto
*/
(function(){
  function applyChartDefaults(){
    if (!window.Chart || !Chart.defaults) return;

    // Pontos nos datasets (sem mexer nos seus dados)
    const d = Chart.defaults;
    if (d.elements && d.elements.point){
      d.elements.point.radius = 3;
      d.elements.point.hoverRadius = 5;
      d.elements.point.hitRadius = 10;
      d.elements.point.borderWidth = 1;
      d.elements.point.backgroundColor = 'currentColor';
      d.elements.point.borderColor = 'rgba(255,255,255,.55)';
    }

    // Suaviza linhas de forma leve (sem afetar escalas ou dados)
    if (d.datasets && d.datasets.line){
      d.datasets.line.borderWidth = 2;
      d.datasets.line.tension = 0.24;
      d.datasets.line.pointRadius = 3; // redundante para garantir
      d.datasets.line.pointHoverRadius = 5;
    }

    // Tema sutil para grid e tooltip
    if (d.color !== undefined) d.color = '#c9d3e2';
    if (d.scales){
      ['x','y'].forEach((ax)=>{
        if (!d.scales[ax]) d.scales[ax] = {};
        d.scales[ax].grid = Object.assign({},
          { color: 'rgba(255,255,255,.06)', drawBorder:false });
        d.scales[ax].ticks = Object.assign({},
          { color: '#a6b2c2', padding: 8 });
      });
    }

    if (d.plugins){
      if (!d.plugins.tooltip) d.plugins.tooltip = {};
      d.plugins.tooltip = Object.assign({}, d.plugins.tooltip, {
        backgroundColor: 'rgba(10,14,20,.92)',
        borderColor: 'rgba(255,255,255,.10)',
        borderWidth: 1,
        titleColor: '#e6ecf2',
        bodyColor: '#d7e0ec',
        cornerRadius: 10,
        padding: 10,
        displayColors: true
      });

      if (!d.plugins.legend) d.plugins.legend = {};
      d.plugins.legend = Object.assign({}, d.plugins.legend, {
        labels: { color: '#c9d3e2', usePointStyle: true, boxWidth: 8, boxHeight: 8 }
      });
    }
  }

  // Aplica já e também quando Chart carregar (se vier depois)
  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', applyChartDefaults, { once:true });
  } else {
    applyChartDefaults();
  }

  // Se alguém criar gráficos ANTES das defaults (raro), ajustamos datasets na criação também
  if (window.Chart){
    const _Chart = Chart;
    const _orig = _Chart.prototype && _Chart.prototype.update;
    if (_orig){
      _Chart.prototype.update = function(){
        try{
          if (this?.config?.type === 'line' && this?.data?.datasets){
            this.data.datasets.forEach(ds => {
              if (typeof ds.pointRadius === 'undefined') ds.pointRadius = 3;
              if (typeof ds.pointHoverRadius === 'undefined') ds.pointHoverRadius = 5;
              if (typeof ds.borderWidth === 'undefined') ds.borderWidth = 2;
            });
          }
        }catch(e){ /* no-op */ }
        return _orig.apply(this, arguments);
      };
    }
  }
})();
