let revenueChartInstance = null;

function renderAll() {
  renderDashboard();
  renderProducts();
  renderOrderProductRows();
  renderOrders();
  renderFactory();
  renderRevenue();
}

function renderDashboard() {
  const revenueRows = appState.revenue || [];
  const revenue = revenueRows.reduce((s, r) => s + Number(r.amount || 0), 0);
  const profit = revenueRows.reduce((s, r) => s + Number(r.profit || 0), 0);
  const soldQty = revenueRows.reduce((s, r) => s + Number(r.qty || 1), 0);
  const stockQty = appState.products.reduce((s, p) => s + Number(p.stock || 0), 0);
  const inventoryValue = appState.products.reduce((s, p) => s + Number(p.costPrice || 0) * Number(p.stock || 0), 0);

  const setText = (id, value) => {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  };

  setText('mRevenue', money(revenue));
  setText('mProfit', money(profit));
  setText('mInventoryValue', money(inventoryValue));
  setText('mSoldQty', soldQty);
  setText('mStockQty', stockQty);

  const soldMap = {};
  revenueRows.forEach(r => {
    const key = r.productId || r.productName || 'unknown';
    if (!soldMap[key]) soldMap[key] = { name: r.productName || 'Khong ro san pham', qty: 0, revenue: 0 };
    soldMap[key].qty += Number(r.qty || 1);
    soldMap[key].revenue += Number(r.amount || 0);
  });

  const soldSummary = document.getElementById('soldSummary');
  if (soldSummary) {
    soldSummary.innerHTML = Object.values(soldMap).sort((a, b) => b.qty - a.qty).map(x => `
      <div class="flex justify-between gap-3 border rounded-2xl p-3">
        <div><b>${escapeHtml(x.name)}</b><p class="text-sm text-slate-500">Da ban: ${x.qty}</p></div>
        <b>${money(x.revenue)}</b>
      </div>
    `).join('') || '<p class="text-slate-500">Chua co san pham ban ra.</p>';
  }

  const inventorySummary = document.getElementById('inventorySummary');
  if (inventorySummary) {
    inventorySummary.innerHTML = appState.products.map(p => `
      <div class="flex items-center justify-between gap-3 border rounded-2xl p-3">
        <div class="flex items-center gap-3">
          ${productImage(p.imageUrl)}
          <div><b>${escapeHtml(p.name)}</b><p class="text-sm text-slate-500">${escapeHtml(p.code)} - Kho: ${Number(p.stock || 0)}</p></div>
        </div>
        <b>${money(Number(p.costPrice || 0) * Number(p.stock || 0))}</b>
      </div>
    `).join('') || '<p class="text-slate-500">Chua co san pham.</p>';
  }
}

function renderProducts() {
  const el = document.getElementById('productList');
  if (!el) return;

  el.innerHTML = appState.products.map(p => `
    <div class="card">
      <div class="flex gap-3">
        ${productImage(p.imageUrl)}
        <div class="flex-1">
          <div class="flex justify-between gap-2">
            <div>
              <h3 class="font-black text-lg">${escapeHtml(p.name)}</h3>
              <p class="text-sm text-slate-500">${escapeHtml(p.code)} - ${escapeHtml(p.category)}</p>
            </div>
            <b class="text-lg">Kho: ${Number(p.stock || 0)}</b>
          </div>
          <p class="text-sm mt-2">Nhap: <b>${money(p.costPrice)}</b> - Ban: <b>${money(p.salePrice)}</b></p>
          <p class="text-sm">Tien hang ton: <b>${money(Number(p.costPrice || 0) * Number(p.stock || 0))}</b></p>
          <p class="text-sm text-slate-500 mt-1">${escapeHtml(p.attributes || '')}</p>
        </div>
      </div>
      <div class="grid grid-cols-2 gap-2 mt-3">
        <button onclick="editProduct('${escapeHtml(p.id)}')" class="btn btn-secondary">Sua</button>
        <button onclick="deleteProduct('${escapeHtml(p.id)}')" class="btn btn-danger">Xoa</button>
      </div>
    </div>
  `).join('') || '<div class="card text-slate-500">Chua co san pham.</div>';
}

function renderOrderProductRows() {
  const rows = document.querySelectorAll('.order-item-row');
  rows.forEach(row => {
    const select = row.querySelector('.order-product-select');
    if (!select) return;
    const oldVal = select.value;
    select.innerHTML = appState.products.map(p => `<option value="${escapeHtml(p.id)}">${escapeHtml(p.name)} - Kho ${Number(p.stock || 0)} - ${money(p.salePrice)}</option>`).join('');
    if (oldVal) select.value = oldVal;
  });
}

function renderOrders() {
  const el = document.getElementById('ordersList');
  if (!el) return;

  const filter = document.getElementById('orderStatusFilter')?.value || 'ALL';
  let orders = [...appState.orders].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  if (filter !== 'ALL') orders = orders.filter(o => o.status === filter);

  el.innerHTML = orders.map(o => {
    const items = getOrderItems(o.id);
    const total = items.reduce((s, i) => s + Number(i.salePrice || 0) * Number(i.qty || 0), 0);
    const profit = items.reduce((s, i) => s + (Number(i.salePrice || 0) - Number(i.costPrice || 0)) * Number(i.qty || 0), 0);
    const ready = isOrderReady(o.id);
    const hasFactoryPending = items.some(i => Number(i.factoryQty || 0) > 0 && i.factoryStatus !== FACTORY_STATUS.RECEIVED);
    const readyForDisplay = ['DELIVERING', 'COMPLETED', 'RETURNED'].includes(o.status) || ready;
    const canDeliver = ready && (o.status === ORDER_STATUS.PENDING || o.status === ORDER_STATUS.FACTORY_ORDERED);
    const canFinishDelivery = o.status === ORDER_STATUS.DELIVERING;
    const canCancel = canCancelOrder(o.status);
    const canDelete = o.status === ORDER_STATUS.CANCELLED;
    const canEdit = o.status === ORDER_STATUS.PENDING || o.status === ORDER_STATUS.FACTORY_ORDERED;
    const stockNotice = readyForDisplay
      ? '<span class="badge completed">Du dieu kien giao hang</span>'
      : '<span class="badge pending">Chua du hang, xu ly tai tab Kho/NM</span>';

    return `
      <div class="card">
        <div class="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
          <div>
            <div class="flex flex-wrap items-center gap-2">
              <h3 class="font-black text-xl">${escapeHtml(o.customerName)}</h3>
              <span class="badge">#${shortId(o.id)}</span>
              ${statusBadge(o.status)}
              ${stockNotice}
              ${hasFactoryPending ? '<span class="badge factory">Co hang cho NM</span>' : ''}
            </div>
            <p class="text-sm text-slate-500">${escapeHtml(o.customerPhone)} - ${formatDateTime(o.createdAt)}</p>
            <p class="text-sm mt-1"><b>Dia chi:</b> ${escapeHtml(o.customerAddress || '')}</p>
            <p class="text-sm"><b>Ghi chu:</b> ${escapeHtml(o.note || '')}</p>
          </div>
          <div class="text-left md:text-right">
            <p><b>Tong don:</b> ${money(total)}</p>
            <p><b>Loi nhuan du kien:</b> ${money(profit)}</p>
          </div>
        </div>

        <div class="mt-3 space-y-2">
          ${items.map(i => {
            const p = getProduct(i.productId);
            const itemReady = p && Number(p.stock || 0) >= Number(i.qty || 0);
            const factoryText = Number(i.factoryQty || 0) > 0
              ? `Can dat NM: ${Number(i.factoryQty || 0)} - ${factoryBadge(i.factoryStatus)}`
              : 'Khong can dat NM';
            return `
              <div class="border rounded-2xl p-3 bg-slate-50">
                <div class="flex justify-between gap-2">
                  <b>${escapeHtml(i.productName)} x ${Number(i.qty || 0)}</b>
                  <span>${money(Number(i.salePrice || 0) * Number(i.qty || 0))}</span>
                </div>
                <p class="text-xs text-slate-500">
                  Ton kho hien tai: ${p ? Number(p.stock || 0) : 0}/${Number(i.qty || 0)} - ${factoryText}
                </p>
                <p class="text-xs ${itemReady ? 'text-green-700' : 'text-amber-700'} font-bold mt-1">
                  ${itemReady ? 'Dong san pham nay da du hang.' : 'Dong san pham nay chua du hang, vui long xu ly trong tab Kho/NM.'}
                </p>
              </div>
            `;
          }).join('')}
        </div>

        <div class="action-grid mt-4">
          <button onclick="editOrder('${escapeHtml(o.id)}')" class="btn btn-secondary" ${canEdit ? '' : 'disabled'}>Sua don</button>
          <button onclick="setOrderStatus('${escapeHtml(o.id)}', 'DELIVERING')" class="btn btn-warning" ${canDeliver ? '' : 'disabled'}>Giao hang</button>
          <button onclick="setOrderStatus('${escapeHtml(o.id)}', 'COMPLETED')" class="btn btn-success" ${canFinishDelivery ? '' : 'disabled'}>Thanh cong</button>
          <button onclick="setOrderStatus('${escapeHtml(o.id)}', 'RETURNED')" class="btn btn-warning" ${canFinishDelivery ? '' : 'disabled'}>That bai/Hoan hang</button>
          <button onclick="setOrderStatus('${escapeHtml(o.id)}', 'CANCELLED')" class="btn btn-danger" ${canCancel ? '' : 'disabled'}>Huy order</button>
          <button onclick="deleteOrder('${escapeHtml(o.id)}')" class="btn btn-danger" ${canDelete ? '' : 'disabled'}>Xoa don</button>
        </div>
      </div>
    `;
  }).join('') || '<div class="card text-slate-500">Chua co don hang.</div>';
}

function renderFactory() {
  const el = document.getElementById('factoryList');
  if (!el) return;

  const activeOrderIds = appState.orders
    .filter(o => !TERMINAL_ORDER_STATUS.includes(o.status))
    .map(o => o.id);

  const list = appState.orderItems.filter(i =>
    activeOrderIds.includes(i.orderId) &&
    Number(i.factoryQty || 0) > 0 &&
    i.factoryStatus !== FACTORY_STATUS.RECEIVED
  );

  el.innerHTML = list.map(i => {
    const o = appState.orders.find(x => x.id === i.orderId) || {};
    const missingQty = Number(i.factoryQty || 0);
    const canMarkOrdered = i.factoryStatus === FACTORY_STATUS.NEED_ORDER;
    const canReceive = i.factoryStatus === FACTORY_STATUS.ORDERED;
    const canCancelFactory = i.factoryStatus === FACTORY_STATUS.ORDERED;

    return `
      <div class="card">
        <div class="flex flex-col md:flex-row md:justify-between gap-3">
          <div>
            <div class="flex flex-wrap items-center gap-2">
              <h3 class="font-black text-lg">${escapeHtml(i.productName)} x ${missingQty}</h3>
              <span class="badge">Don #${shortId(o.id)}</span>
              ${factoryBadge(i.factoryStatus)}
            </div>
            <p class="text-sm text-slate-500">Khach: ${escapeHtml(o.customerName || '')} - ${escapeHtml(o.customerPhone || '')}</p>
            <p class="text-sm"><b>Dia chi:</b> ${escapeHtml(o.customerAddress || '')}</p>
            <p class="text-sm mt-1">Khi bam Da nhan hang, he thong chi cong ton kho. Sau do quay lai Don hang va bam Giao hang.</p>
          </div>
          <div class="grid grid-cols-1 md:grid-cols-3 gap-2">
            <button onclick="updateFactoryItem('${escapeHtml(i.id)}', 'ORDERED')" class="btn btn-info" ${canMarkOrdered ? '' : 'disabled'}>Da order NM</button>
            <button onclick="updateFactoryItem('${escapeHtml(i.id)}', 'RECEIVED')" class="btn btn-success" ${canReceive ? '' : 'disabled'}>Da nhan hang</button>
            <button onclick="updateFactoryItem('${escapeHtml(i.id)}', 'NEED_ORDER')" class="btn btn-danger" ${canCancelFactory ? '' : 'disabled'}>Huy order NM</button>
          </div>
        </div>
      </div>
    `;
  }).join('') || '<div class="card text-slate-500">Khong co san pham can dat nha may.</div>';
}

function getFilteredRevenue() {
  const month = document.getElementById('revenueMonth')?.value;
  const year = document.getElementById('revenueYear')?.value;
  const sortBy = document.getElementById('revenueSort')?.value || 'recent';

  let list = [...(appState.revenue || [])];

  if (month) list = list.filter(r => new Date(r.createdAt).getMonth() + 1 === Number(month));
  if (year) list = list.filter(r => new Date(r.createdAt).getFullYear() === Number(year));

  if (sortBy === 'sales_desc') list.sort((a, b) => Number(b.amount || 0) - Number(a.amount || 0));
  else if (sortBy === 'profit_desc') list.sort((a, b) => Number(b.profit || 0) - Number(a.profit || 0));
  else if (sortBy === 'product_best_seller') {
    const soldMap = {};
    list.forEach(r => { soldMap[r.productId] = (soldMap[r.productId] || 0) + Number(r.qty || 1); });
    list.sort((a, b) => (soldMap[b.productId] || 0) - (soldMap[a.productId] || 0));
  } else {
    list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  return list;
}

function renderRevenue() {
  const totalSalesEl = document.getElementById('revTotalSales');
  if (!totalSalesEl) return;

  const list = getFilteredRevenue();
  const totalSales = list.reduce((s, r) => s + Number(r.amount || 0), 0);
  const totalProfit = list.reduce((s, r) => s + Number(r.profit || 0), 0);
  const uniqueOrders = new Set(list.map(r => r.orderId));

  const productMap = {};
  list.forEach(r => {
    const key = r.productId || r.productName || 'unknown';
    if (!productMap[key]) {
      productMap[key] = {
        productId: r.productId,
        name: r.productName || 'Khong ro san pham',
        qty: 0,
        sales: 0,
        profit: 0
      };
    }
    productMap[key].qty += Number(r.qty || 1);
    productMap[key].sales += Number(r.amount || 0);
    productMap[key].profit += Number(r.profit || 0);
  });

  const topProducts = Object.values(productMap).sort((a, b) => b.qty - a.qty || b.sales - a.sales);

  document.getElementById('revTotalSales').textContent = money(totalSales);
  document.getElementById('revTotalProfit').textContent = money(totalProfit);
  document.getElementById('revOrderCount').textContent = uniqueOrders.size;
  document.getElementById('revBestSeller').textContent = topProducts[0]?.name || '-';

  document.getElementById('revenueTopProducts').innerHTML = topProducts.slice(0, 8).map((p, index) => `
    <div class="flex items-center justify-between gap-3 border rounded-2xl p-3 bg-slate-50">
      <div>
        <p class="font-black">${index + 1}. ${escapeHtml(p.name)}</p>
        <p class="text-sm text-slate-500">Da ban: ${p.qty} - Loi nhuan: ${money(p.profit)}</p>
      </div>
      <b>${money(p.sales)}</b>
    </div>
  `).join('') || '<p class="text-slate-500">Chua co du lieu san pham ban chay.</p>';

  document.getElementById('revenueList').innerHTML = list.map(r => `
    <div class="border rounded-2xl p-3 bg-white">
      <div class="flex flex-col md:flex-row md:items-start md:justify-between gap-2">
        <div>
          <h4 class="font-black text-lg">${escapeHtml(r.productName || 'Khong ro san pham')} x ${Number(r.qty || 1)}</h4>
          <p class="text-sm text-slate-500">Khach: ${escapeHtml(r.customerName || '')} - ${formatDateTime(r.createdAt)}</p>
          <p class="text-sm text-slate-500">Gia nhap: ${money(r.priceIn)} - Gia ban: ${money(r.priceOut)}</p>
          <p class="text-xs text-slate-400">Order #${shortId(r.orderId)}</p>
        </div>
        <div class="md:text-right">
          <p class="font-black">Doanh thu: ${money(r.amount)}</p>
          <p class="font-black text-green-700">Loi nhuan: ${money(r.profit)}</p>
        </div>
      </div>
    </div>
  `).join('') || '<div class="text-slate-500">Chua co doanh thu trong bo loc nay.</div>';

  renderRevenueChart(list);
}

function renderRevenueChart(list) {
  const canvas = document.getElementById('revenueChart');
  if (!canvas || typeof Chart === 'undefined') return;

  const monthlyMap = {};
  list.forEach(r => {
    const d = new Date(r.createdAt);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    if (!monthlyMap[key]) monthlyMap[key] = { sales: 0, profit: 0 };
    monthlyMap[key].sales += Number(r.amount || 0);
    monthlyMap[key].profit += Number(r.profit || 0);
  });

  const labels = Object.keys(monthlyMap).sort();
  const salesData = labels.map(k => monthlyMap[k].sales);
  const profitData = labels.map(k => monthlyMap[k].profit);

  if (revenueChartInstance) revenueChartInstance.destroy();

  revenueChartInstance = new Chart(canvas, {
    type: 'line',
    data: {
      labels,
      datasets: [
        { label: 'Doanh thu', data: salesData, tension: 0.25 },
        { label: 'Loi nhuan', data: profitData, tension: 0.25 }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: { position: 'bottom' },
        tooltip: {
          callbacks: {
            label: function(context) {
              return `${context.dataset.label}: ${money(context.raw)}`;
            }
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            callback: function(value) {
              return Number(value || 0).toLocaleString('vi-VN');
            }
          }
        }
      }
    }
  });
}
