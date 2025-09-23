/**
 * chart-plugins.js
 * ----------------
 * Registers UMD plugins (zoom, annotation, financial) when Chart is on window.
 * This module has side effects; just import it once at app startup.
 */
(function ensurePlugins(){
  if (typeof Chart === 'undefined') {
    console.error("⚠️ Chart.js não foi carregado!");
    return;
  }

  const plugins = [
    { name: 'chartjs-plugin-zoom', global: 'ChartZoom', register: (p) => Chart.register(p) },
    { name: 'chartjs-plugin-annotation', global: 'chartjs-plugin-annotation', register: (p) => Chart.register(p) }
  ];

  plugins.forEach(({ name, global, register }) => {
    if (window[global]) {
      register(window[global]);
      console.log(`✅ ${name} registrado`);
    } else {
      console.warn(`⚠️ ${name} não encontrado em window.${global}`);
    }
  });

  // Financial (candlestick/ohlc) - plugin auto-registers on load; verify quietly
  setTimeout(() => {
    try {
      const testCanvas = document.createElement('canvas');
      const testCtx = testCanvas.getContext('2d');
      const testChart = new Chart(testCtx, {
        type: 'candlestick',
        data: { datasets: [{ data: [] }] }
      });
      testChart.destroy();
      console.log("✅ chartjs-chart-financial registrado e funcionando");
    } catch (e) {
      if (!Chart.registry?.controllers?.candlestick) {
        console.warn("⚠️ chartjs-chart-financial pode não estar disponível");
      }
    }
  }, 500);
})();
