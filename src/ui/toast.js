let timer = null;

export function showToast(message, type = 'info', duration = 3200) {
  let root = document.getElementById('toast-root');
  if (!root) {
    root = document.createElement('div');
    root.id = 'toast-root';
    document.body.appendChild(root);
  }

  root.replaceChildren();
  const item = document.createElement('div');
  item.className = `toast toast-${type}`;
  item.setAttribute('role', type === 'error' ? 'alert' : 'status');
  item.textContent = message;
  root.appendChild(item);

  clearTimeout(timer);
  timer = setTimeout(() => item.remove(), duration);
}

window.addEventListener('ochart:show-toast', event => {
  const detail = event.detail || {};
  showToast(detail.message || 'OChart', detail.type || 'info', detail.duration || 3200);
});
