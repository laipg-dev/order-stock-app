function showTab(tab) {
  appState.activeTab = tab;
  localStorage.setItem(STORAGE_KEYS.ACTIVE_TAB, tab);

  document.querySelectorAll('.tab-panel').forEach(el => el.classList.add('hidden'));
  const panel = document.getElementById('tab-' + tab);
  if (panel) panel.classList.remove('hidden');

  document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('tab-active'));
  const btn = document.querySelector('[data-tab="' + tab + '"]');
  if (btn) btn.classList.add('tab-active');

  if (tab === 'revenue' && typeof renderRevenue === 'function') {
    setTimeout(renderRevenue, 50);
  }
}

document.addEventListener('DOMContentLoaded', function() {
  hydrateSupabaseInputs();

  const yearInput = document.getElementById('revenueYear');
  if (yearInput && !yearInput.value) yearInput.value = new Date().getFullYear();

  showTab(localStorage.getItem(STORAGE_KEYS.ACTIVE_TAB) || 'dashboard');
  addOrderItemRow();

  const hasConfig = localStorage.getItem(STORAGE_KEYS.SUPABASE_URL) && localStorage.getItem(STORAGE_KEYS.SUPABASE_KEY);
  if (hasConfig) loadAll({ keepView: true });
});
