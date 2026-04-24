function money(n) {
  return Number(n || 0).toLocaleString('vi-VN') + ' \u0111';
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
  if (!el) return alert(message);
  el.textContent = message;
  el.classList.remove('hidden');
  clearTimeout(window.__toastTimer);
  window.__toastTimer = setTimeout(() => el.classList.add('hidden'), 3200);
}

function setBusy(isBusy, text = 'Dang xu ly...') {
  appState.busy = isBusy;
  const loadingText = document.getElementById('loadingText');
  const loadingOverlay = document.getElementById('loadingOverlay');
  if (loadingText) loadingText.textContent = text;
  if (loadingOverlay) loadingOverlay.classList.toggle('hidden', !isBusy);

  document.querySelectorAll('button,input,select,textarea').forEach(el => {
    if (['supabaseUrl', 'supabaseKey', 'supabaseBucket'].includes(el.id)) return;
    el.disabled = isBusy;
  });
}

function getProduct(id) {
  return appState.products.find(p => String(p.id) === String(id)) || null;
}

function productImage(url) {
  if (!url) return '<div class="product-img grid place-items-center text-xs text-slate-500">No image</div>';
  return `<img class="product-img" src="${escapeHtml(url)}" alt="Product image" onerror="this.outerHTML='<div class=&quot;product-img grid place-items-center text-xs text-slate-500&quot;>No image</div>'" />`;
}

function statusBadge(status) {
  const cls = status === ORDER_STATUS.COMPLETED ? 'completed'
    : status === ORDER_STATUS.CANCELLED ? 'cancelled'
    : status === ORDER_STATUS.RETURNED ? 'returned'
    : status === ORDER_STATUS.DELIVERING ? 'factory'
    : status === ORDER_STATUS.FACTORY_ORDERED ? 'factory'
    : 'pending';
  return `<span class="badge ${cls}">${ORDER_STATUS_LABELS[status] || status}</span>`;
}

function factoryBadge(status) {
  const cls = status === FACTORY_STATUS.RECEIVED ? 'completed'
    : status === FACTORY_STATUS.ORDERED ? 'factory'
    : 'pending';
  return `<span class="badge ${cls}">${FACTORY_STATUS_LABELS[status] || status}</span>`;
}

function getOrderItems(orderId) {
  return appState.orderItems.filter(i => String(i.orderId) === String(orderId));
}

function isOrderReady(orderId) {
  const items = getOrderItems(orderId);
  if (!items.length) return false;

  const needByProduct = {};
  items.forEach(i => {
    const key = String(i.productId);
    needByProduct[key] = (needByProduct[key] || 0) + Number(i.qty || 0);
  });

  return Object.entries(needByProduct).every(([productId, needQty]) => {
    const p = getProduct(productId);
    return p && Number(p.stock || 0) >= Number(needQty || 0);
  });
}

function canCancelOrder(status) {
  return ![ORDER_STATUS.DELIVERING, ORDER_STATUS.COMPLETED, ORDER_STATUS.RETURNED, ORDER_STATUS.CANCELLED].includes(status);
}

function saveScroll() {
  appState.scrollY = window.scrollY || 0;
}

function restoreScroll() {
  setTimeout(() => window.scrollTo(0, appState.scrollY || 0), 50);
}

function formatDateTime(value) {
  if (!value) return '';
  return new Date(value).toLocaleString('vi-VN');
}

function shortId(id) {
  return String(id || '').slice(0, 8).toUpperCase();
}
