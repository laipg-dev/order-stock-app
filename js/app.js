function showTab(tab) {
  appState.activeTab = tab;
  localStorage.setItem(STORAGE_KEYS.ACTIVE_TAB, tab);

  document.querySelectorAll('.tab-panel').forEach(el => el.classList.add('hidden'));
  const panel = document.getElementById('tab-' + tab);
  if (panel) panel.classList.remove('hidden');

  document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('tab-active'));
  const btn = document.querySelector('[data-tab="' + tab + '"]');
  if (btn) btn.classList.add('tab-active');
}

document.addEventListener('DOMContentLoaded', function() {
  document.getElementById('apiUrl').value = localStorage.getItem(STORAGE_KEYS.API_URL) || '';
  showTab(localStorage.getItem(STORAGE_KEYS.ACTIVE_TAB) || 'dashboard');
  addOrderItemRow();
  if (document.getElementById('apiUrl').value) loadAll({ keepView: true });
});
