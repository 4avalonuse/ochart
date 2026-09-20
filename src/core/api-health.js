import { checkDataApiHealth } from './api-source.js';

export async function checkDataApi() {
  const el = document.getElementById('api-status');

  if (!el) return { configured: false, connected: false };

  el.textContent = '☁️ Cloudflare: testando…';
  el.dataset.state = 'checking';

  try {
    const payload = await checkDataApiHealth();

    el.textContent = '☁️ Cloudflare: conectado';
    el.dataset.state = 'online';

    window.__HUD__?.pushLog?.({
      level: 'info',
      msg: 'data_api_health_ok',
      ts: Date.now(),
      data: {
        service: payload.service,
        database: payload.database,
        timestamp: payload.timestamp
      }
    });

    return { configured: true, connected: true, payload };
  } catch (e) {
    el.textContent = '☁️ Cloudflare: offline';
    el.dataset.state = 'offline';

    window.__HUD__?.pushLog?.({
      level: 'warn',
      msg: 'data_api_health_fail',
      ts: Date.now(),
      data: { error: String(e?.message || e) }
    });

    return { configured: true, connected: false };
  }
}
