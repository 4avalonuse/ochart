import { DATA_API_URL } from './api-config.js';

export async function checkDataApi() {
  const el = document.getElementById('api-status');

  if (!el) return { configured: false, connected: false };

  if (!DATA_API_URL) {
    el.textContent = '☁️ Cloudflare: não configurado';
    el.dataset.state = 'offline';
    return { configured: false, connected: false };
  }

  el.textContent = '☁️ Cloudflare: testando…';
  el.dataset.state = 'checking';

  try {
    const url = new URL('/api/health', DATA_API_URL);
    const response = await fetch(url, { cache: 'no-store' });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const payload = await response.json();

    if (payload?.ok !== true) throw new Error('health inválido');

    el.textContent = '☁️ Cloudflare: conectado';
    el.dataset.state = 'online';

    window.__HUD__?.pushLog?.({
      level: 'info',
      msg: 'data_api_connected',
      ts: Date.now(),
      data: { provider: payload.provider || 'cloudflare', url: DATA_API_URL }
    });

    return { configured: true, connected: true, payload };
  } catch (e) {
    el.textContent = '☁️ Cloudflare: offline';
    el.dataset.state = 'offline';

    window.__HUD__?.pushLog?.({
      level: 'warn',
      msg: 'data_api_unavailable',
      ts: Date.now(),
      data: { url: DATA_API_URL, error: String(e?.message || e) }
    });

    return { configured: true, connected: false };
  }
}
