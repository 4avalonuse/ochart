/**
 * Gerenciador de Temas para o projeto ochart
 * Suporta dark/light mode com transições suaves
 */

export class ThemeManager {
  constructor() {
    this.currentTheme = 'dark';
    this.themes = {
      dark: {
        name: 'dark',
        colors: {
          // Cores principais
          surface: '#0f111a',
          surfaceAlt: '#1a1d2e',
          border: '#2a2d3a',
          text: '#e4e4e7',
          textMuted: '#9ca3af',
          
          // Cores do gráfico
          gridColor: 'rgba(255, 255, 255, 0.04)',
          candleUp: '#10b981',
          candleDown: '#ef4444',
          candleUpBg: 'rgba(16, 185, 129, 0.5)',
          candleDownBg: 'rgba(239, 68, 68, 0.5)',
          lineChart: '#3b82f6',
          lineChartBg: 'rgba(59, 130, 246, 0.1)',
          
          // Overlays
          ma20: '#3b82f6',
          ma50: '#10b981',
          ma100: '#f59e0b',
          ma200: '#ef4444',
          
          // UI
          buttonActive: '#3b82f6',
          buttonActiveBg: 'rgba(59, 130, 246, 0.1)',
          success: '#10b981',
          warning: '#f59e0b',
          error: '#ef4444',
          
          // Zoom/Drag
          zoomBg: 'rgba(59, 130, 246, 0.1)',
          zoomBorder: 'rgba(59, 130, 246, 0.5)'
        }
      },
      light: {
        name: 'light',
        colors: {
          // Cores principais
          surface: '#ffffff',
          surfaceAlt: '#f8fafc',
          border: '#e5e7eb',
          text: '#111827',
          textMuted: '#6b7280',
          
          // Cores do gráfico
          gridColor: 'rgba(0, 0, 0, 0.06)',
          candleUp: '#059669',
          candleDown: '#dc2626',
          candleUpBg: 'rgba(5, 150, 105, 0.5)',
          candleDownBg: 'rgba(220, 38, 38, 0.5)',
          lineChart: '#2563eb',
          lineChartBg: 'rgba(37, 99, 235, 0.1)',
          
          // Overlays
          ma20: '#2563eb',
          ma50: '#059669',
          ma100: '#d97706',
          ma200: '#dc2626',
          
          // UI
          buttonActive: '#111827',
          buttonActiveBg: '#111827',
          success: '#059669',
          warning: '#d97706',
          error: '#dc2626',
          
          // Zoom/Drag
          zoomBg: 'rgba(37, 99, 235, 0.1)',
          zoomBorder: 'rgba(37, 99, 235, 0.5)'
        }
      }
    };
    
    this.chartEngine = null;
    this.callbacks = {
      onThemeChange: null
    };
  }

  /**
   * Inicializa o gerenciador de temas
   */
  init(chartEngine = null) {
    this.chartEngine = chartEngine;
    
    // Detecta tema do sistema
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const savedTheme = localStorage.getItem('ochart-theme');
    
    this.currentTheme = savedTheme || (prefersDark ? 'dark' : 'light');
    
    // Aplica tema inicial
    this.applyTheme(this.currentTheme);
    
    // Observa mudanças no tema do sistema
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
      if (!localStorage.getItem('ochart-theme')) {
        this.setTheme(e.matches ? 'dark' : 'light');
      }
    });
  }

  /**
   * Define um novo tema
   */
  setTheme(themeName) {
    if (!this.themes[themeName]) {
      console.warn(`Tema '${themeName}' não existe`);
      return;
    }
    
    this.currentTheme = themeName;
    localStorage.setItem('ochart-theme', themeName);
    this.applyTheme(themeName);
    
    // Callback
    if (this.callbacks.onThemeChange) {
      this.callbacks.onThemeChange(themeName);
    }
  }

  /**
   * Alterna entre dark/light
   */
  toggleTheme() {
    const newTheme = this.currentTheme === 'dark' ? 'light' : 'dark';
    this.setTheme(newTheme);
  }

  /**
   * Aplica o tema no DOM e Chart.js
   */
  applyTheme(themeName) {
    const theme = this.themes[themeName];
    if (!theme) return;
    
    // Aplica no root do documento
    document.documentElement.setAttribute('data-theme', themeName);
    
    // Aplica variáveis CSS
    this.applyCSSVariables(theme.colors);
    
    // Atualiza Chart.js se existir
    if (this.chartEngine && this.chartEngine.chart) {
      this.updateChartTheme(theme.colors);
    }
    
    // Atualiza estilos inline no body
    this.updateBodyStyles(theme.colors);
  }

  /**
   * Aplica variáveis CSS customizadas
   */
  applyCSSVariables(colors) {
    const root = document.documentElement;
    
    // Define todas as variáveis CSS
    Object.entries(colors).forEach(([key, value]) => {
      const cssVarName = `--theme-${key.replace(/([A-Z])/g, '-$1').toLowerCase()}`;
      root.style.setProperty(cssVarName, value);
    });
  }

  /**
   * Atualiza estilos do body e elementos principais
   */
  updateBodyStyles(colors) {
    // Body
    document.body.style.backgroundColor = colors.surface;
    document.body.style.color = colors.text;
    
    // Boxes
    document.querySelectorAll('.box').forEach(box => {
      box.style.backgroundColor = colors.surfaceAlt;
      box.style.borderColor = colors.border;
    });
    
    // Textos muted
    document.querySelectorAll('.muted').forEach(el => {
      el.style.color = colors.textMuted;
    });
    
    // Botões ativos
    document.querySelectorAll('.seg button.active').forEach(btn => {
      btn.style.backgroundColor = colors.buttonActive;
      btn.style.color = colors.surface;
    });
    
    // Botões inativos
    document.querySelectorAll('.seg button:not(.active)').forEach(btn => {
      btn.style.backgroundColor = colors.surfaceAlt;
      btn.style.color = colors.text;
    });
  }

  /**
   * Atualiza tema do Chart.js
   */
  updateChartTheme(colors) {
    if (!this.chartEngine || !this.chartEngine.chart) return;
    
    const chart = this.chartEngine.chart;
    const options = chart.options;
    
    // Atualiza grid
    if (options.scales?.x?.grid) {
      options.scales.x.grid.color = colors.gridColor;
    }
    if (options.scales?.y?.grid) {
      options.scales.y.grid.color = colors.gridColor;
    }
    
    // Atualiza ticks
    if (options.scales?.x?.ticks) {
      options.scales.x.ticks.color = colors.textMuted;
    }
    if (options.scales?.y?.ticks) {
      options.scales.y.ticks.color = colors.textMuted;
    }
    
    // Atualiza tooltip
    if (options.plugins?.tooltip) {
      options.plugins.tooltip.backgroundColor = colors.surfaceAlt;
      options.plugins.tooltip.borderColor = colors.border;
      options.plugins.tooltip.titleColor = colors.text;
      options.plugins.tooltip.bodyColor = colors.textMuted;
    }
    
    // Atualiza legend
    if (options.plugins?.legend?.labels) {
      options.plugins.legend.labels.color = colors.textMuted;
    }
    
    // Atualiza zoom drag
    if (options.plugins?.zoom?.zoom?.drag) {
      options.plugins.zoom.zoom.drag.backgroundColor = colors.zoomBg;
      options.plugins.zoom.zoom.drag.borderColor = colors.zoomBorder;
    }
    
    // Atualiza datasets
    chart.data.datasets.forEach((dataset, idx) => {
      if (dataset.type === 'candlestick') {
        dataset.borderColor = {
          up: colors.candleUp,
          down: colors.candleDown,
          unchanged: colors.textMuted
        };
        dataset.backgroundColor = {
          up: colors.candleUpBg,
          down: colors.candleDownBg,
          unchanged: colors.textMuted + '40'
        };
      } else if (dataset.type === 'line') {
        if (dataset.label === 'Close') {
          dataset.borderColor = colors.lineChart;
          dataset.backgroundColor = colors.lineChartBg;
        } else if (dataset.label?.includes('MA')) {
          // Médias móveis
          const period = parseInt(dataset.label.match(/\d+/)?.[0]);
          if (period <= 20) dataset.borderColor = colors.ma20;
          else if (period <= 50) dataset.borderColor = colors.ma50;
          else if (period <= 100) dataset.borderColor = colors.ma100;
          else dataset.borderColor = colors.ma200;
        }
      }
    });
    
    // Força atualização
    chart.update('none');
  }

  /**
   * Obtém o tema atual
   */
  getCurrentTheme() {
    return this.themes[this.currentTheme];
  }

  /**
   * Registra callback
   */
  on(event, callback) {
    if (event in this.callbacks) {
      this.callbacks[event] = callback;
    }
  }

  /**
   * Cria botão de toggle de tema
   */
  createThemeToggle() {
    const button = document.createElement('button');
    button.id = 'theme-toggle';
    button.innerHTML = this.currentTheme === 'dark' ? '☀️' : '🌙';
    button.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      width: 40px;
      height: 40px;
      border-radius: 50%;
      border: 1px solid var(--theme-border);
      background: var(--theme-surface-alt);
      cursor: pointer;
      font-size: 20px;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.3s ease;
      z-index: 1000;
    `;
    
    button.addEventListener('click', () => {
      this.toggleTheme();
      button.innerHTML = this.currentTheme === 'dark' ? '☀️' : '🌙';
    });
    
    document.body.appendChild(button);
    return button;
  }
}

// Export singleton
export const themeManager = new ThemeManager();