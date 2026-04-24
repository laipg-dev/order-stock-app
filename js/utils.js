function money(n) {
  return Number(n || 0).toLocaleString('vi-VN') + ' đ';
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function toast(message) {
  const el = document.getElementById('toast');
  el.textContent = message;
  el.classList.remove('hidden');
  clearTimeout(window.__toastTimer);
  window.__toastTimer = setTimeout(() => el.classList.add('hidden'), 3200);
}

function setBusy(isBusy, text = 'Đang xử lý...') {
  appState.busy = isBusy;
  document.getElementById('loadingText').textContent = text;
  document.getElementById('loadingOverlay').classList.toggle('hidden', !isBusy);
  document.querySelectorAll('button,input,select,textarea').forEach(el => {
    if (el.id === 'apiUrl') return;
    el.disabled = isBusy;
  });
}

function getProduct(id) {
  return appState.products.find(p => p.id === id) || null;
}

function productImage(url) {
  if (!url) return '<div class="product-img grid place-items-center text-xs text-slate-500">No image</div>';
  return `<img class="product-img" src="${escapeHtml(url)}" onerror="this.outerHTML='<div class=&quot;product-img grid place-items-center text-xs text-slate-500&quot;>No image</div>'" />`;
}

function statusBadge(status) {
  const cls = status === 'COMPLETED' ? 'completed'
    : status === 'CANCELLED' ? 'cancelled'
    : status === 'RETURNED' ? 'returned'
    : status === 'DELIVERING' ? 'factory'
    : status === 'FACTORY_ORDERED' ? 'factory'
    : 'pending';
  return `<span class="badge ${cls}">${ORDER_STATUS_LABELS[status] || status}</span>`;
}

function factoryBadge(status) {
  const cls = status === 'RECEIVED' ? 'completed' : status === 'ORDERED' ? 'factory' : 'pending';
  return `<span class="badge ${cls}">${FACTORY_STATUS_LABELS[status] || status}</span>`;
}

function isOrderReady(orderId) {
  return getOrderItems(orderId).every(i => {
    const p = getProduct(i.productId);
    return p && Number(p.stock || 0) >= Number(i.qty || 0);
  });
}

function canCancelOrder(status) {
  return !['DELIVERING','COMPLETED','RETURNED','CANCELLED'].includes(status);
}

function saveScroll() {
  appState.scrollY = window.scrollY || 0;
}

function restoreScroll() {
  setTimeout(() => window.scrollTo(0, appState.scrollY || 0), 50);
}
