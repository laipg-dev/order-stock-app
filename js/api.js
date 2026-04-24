function getApiUrl() {
  const url = document.getElementById('apiUrl').value.trim();
  if (!url) throw new Error('Bạn chưa nhập Web App URL.');
  return url;
}

function saveApiUrl() {
  localStorage.setItem(STORAGE_KEYS.API_URL, getApiUrl());
  toast('Đã lưu Web App URL.');
}

async function api(action, payload = {}, loadingText = 'Đang xử lý...') {
  setBusy(true, loadingText);
  try {
    const res = await fetch(getApiUrl(), {
      method: 'POST',
      body: JSON.stringify({ action, payload })
    });
    const data = await res.json();
    if (!data.ok) throw new Error(data.message || 'API lỗi.');
    return data.data;
  } finally {
    setBusy(false);
  }
}

async function loadAll(options = {}) {
  try {
    if (options.keepView) saveScroll();
    saveApiUrl();
    const data = await api('getAll', {}, 'Đang tải dữ liệu...');
    setState(data);
    renderAll();
    if (options.keepView) restoreScroll();
  } catch (err) {
    toast(err.message);
  }
}
