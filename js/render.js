function renderAll() {
  renderDashboard();
  renderProducts();
  renderOrderProductRows();
  renderOrders();
  renderFactory();
}

function renderDashboard() {
  const completed = appState.orders.filter(o => o.status === ORDER_STATUS.COMPLETED);
  const completedIds = completed.map(o => o.id);
  const soldItems = appState.orderItems.filter(i => completedIds.includes(i.orderId));

  const revenue = soldItems.reduce((s, i) => s + Number(i.salePrice || 0) * Number(i.qty || 0), 0);
  const profit = soldItems.reduce((s, i) => s + (Number(i.salePrice || 0) - Number(i.costPrice || 0)) * Number(i.qty || 0), 0);
  const soldQty = soldItems.reduce((s, i) => s + Number(i.qty || 0), 0);
  const stockQty = appState.products.reduce((s, p) => s + Number(p.stock || 0), 0);
  const inventoryValue = appState.products.reduce((s, p) => s + Number(p.costPrice || 0) * Number(p.stock || 0), 0);

  document.getElementById('mRevenue').textContent = money(revenue);
  document.getElementById('mProfit').textContent = money(profit);
  document.getElementById('mInventoryValue').textContent = money(inventoryValue);
  document.getElementById('mSoldQty').textContent = soldQty;
  document.getElementById('mStockQty').textContent = stockQty;

  const soldMap = {};
  soldItems.forEach(i => {
    if (!soldMap[i.productId]) soldMap[i.productId] = { name: i.productName, qty: 0, revenue: 0 };
    soldMap[i.productId].qty += Number(i.qty || 0);
    soldMap[i.productId].revenue += Number(i.salePrice || 0) * Number(i.qty || 0);
  });

  document.getElementById('soldSummary').innerHTML = Object.values(soldMap).map(x => `
    <div class="flex justify-between gap-3 border rounded-2xl p-3">
      <div><b>${escapeHtml(x.name)}</b><p class="text-sm text-slate-500">Đã bán: ${x.qty}</p></div>
      <b>${money(x.revenue)}</b>
    </div>
  `).join('') || '<p class="text-slate-500">Chưa có sản phẩm bán ra.</p>';

  document.getElementById('inventorySummary').innerHTML = appState.products.map(p => `
    <div class="flex items-center justify-between gap-3 border rounded-2xl p-3">
      <div class="flex items-center gap-3">
        ${productImage(p.imageUrl)}
        <div><b>${escapeHtml(p.name)}</b><p class="text-sm text-slate-500">${escapeHtml(p.code)} • Kho: ${Number(p.stock || 0)}</p></div>
      </div>
      <b>${money(Number(p.costPrice || 0) * Number(p.stock || 0))}</b>
    </div>
  `).join('') || '<p class="text-slate-500">Chưa có sản phẩm.</p>';
}

function renderProducts() {
  document.getElementById('productList').innerHTML = appState.products.map(p => `
    <div class="card">
      <div class="flex gap-3">
        ${productImage(p.imageUrl)}
        <div class="flex-1">
          <div class="flex justify-between gap-2">
            <div>
              <h3 class="font-black text-lg">${escapeHtml(p.name)}</h3>
              <p class="text-sm text-slate-500">${escapeHtml(p.code)} • ${escapeHtml(p.category)}</p>
            </div>
            <b class="text-lg">Kho: ${Number(p.stock || 0)}</b>
          </div>
          <p class="text-sm mt-2">Nhập: <b>${money(p.costPrice)}</b> • Bán: <b>${money(p.salePrice)}</b></p>
          <p class="text-sm">Tiền hàng tồn: <b>${money(Number(p.costPrice || 0) * Number(p.stock || 0))}</b></p>
          <p class="text-sm text-slate-500 mt-1">${escapeHtml(p.attributes || '')}</p>
        </div>
      </div>
      <div class="grid grid-cols-2 gap-2 mt-3">
        <button onclick="editProduct('${p.id}')" class="btn btn-secondary">Sửa</button>
        <button onclick="deleteProduct('${p.id}')" class="btn btn-danger">Xóa</button>
      </div>
    </div>
  `).join('') || '<div class="card text-slate-500">Chưa có sản phẩm.</div>';
}

function renderOrderProductRows() {
  const rows = document.querySelectorAll('.order-item-row');
  rows.forEach(row => {
    const select = row.querySelector('.order-product-select');
    if (!select) return;
    const oldVal = select.value;
    select.innerHTML = appState.products.map(p => `<option value="${p.id}">${escapeHtml(p.name)} - Kho ${Number(p.stock || 0)} - ${money(p.salePrice)}</option>`).join('');
    if (oldVal) select.value = oldVal;
  });
}

function getOrderItems(orderId) {
  return appState.orderItems.filter(i => i.orderId === orderId);
}

function renderOrders() {
  const filter = document.getElementById('orderStatusFilter')?.value || 'ALL';
  let orders = [...appState.orders].sort((a,b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  if (filter !== 'ALL') orders = orders.filter(o => o.status === filter);

  document.getElementById('ordersList').innerHTML = orders.map(o => {
    const items = getOrderItems(o.id);
    const total = items.reduce((s,i) => s + Number(i.salePrice || 0) * Number(i.qty || 0), 0);
    const profit = items.reduce((s,i) => s + (Number(i.salePrice || 0) - Number(i.costPrice || 0)) * Number(i.qty || 0), 0);
    const ready = isOrderReady(o.id);
    const readyForDisplay = ['DELIVERING','COMPLETED','RETURNED'].includes(o.status) || ready;
    const canDeliver = ready && (o.status === ORDER_STATUS.PENDING || o.status === ORDER_STATUS.FACTORY_ORDERED);
    const canFinishDelivery = o.status === ORDER_STATUS.DELIVERING;
    const canCancel = canCancelOrder(o.status);
    const canDelete = o.status === ORDER_STATUS.CANCELLED;
    const canEdit = o.status === ORDER_STATUS.PENDING || o.status === ORDER_STATUS.FACTORY_ORDERED;
    const stockNotice = readyForDisplay
      ? '<span class="badge completed">Đủ điều kiện sản phẩm</span>'
      : '<span class="badge pending">Chưa đủ hàng tồn kho, cần xử lý bên Nhà máy</span>';

    return `
      <div class="card">
        <div class="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
          <div>
            <div class="flex flex-wrap items-center gap-2">
              <h3 class="font-black text-xl">${escapeHtml(o.customerName)}</h3>
              ${statusBadge(o.status)}
              ${stockNotice}
            </div>
            <p class="text-sm text-slate-500">${escapeHtml(o.customerPhone)} • ${new Date(o.createdAt).toLocaleString('vi-VN')}</p>
            <p class="text-sm mt-1"><b>Địa chỉ:</b> ${escapeHtml(o.customerAddress || '')}</p>
            <p class="text-sm"><b>Ghi chú:</b> ${escapeHtml(o.note || '')}</p>
          </div>
          <div class="text-left md:text-right">
            <p><b>Tổng:</b> ${money(total)}</p>
            <p><b>Lợi nhuận dự kiến:</b> ${money(profit)}</p>
          </div>
        </div>
        <div class="mt-3 space-y-2">
          ${items.map(i => {
            const p = getProduct(i.productId);
            const itemReady = p && Number(p.stock || 0) >= Number(i.qty || 0);
            return `
              <div class="border rounded-2xl p-3 bg-slate-50">
                <div class="flex justify-between gap-2">
                  <b>${escapeHtml(i.productName)} x ${Number(i.qty || 0)}</b>
                  <span>${money(Number(i.salePrice || 0) * Number(i.qty || 0))}</span>
                </div>
                <p class="text-xs text-slate-500">
                  Tồn kho hiện tại: ${p ? Number(p.stock || 0) : 0}/${Number(i.qty || 0)} • Cần đặt NM: ${Number(i.factoryQty || 0)} • ${factoryBadge(i.factoryStatus)}
                </p>
                <p class="text-xs ${itemReady ? 'text-green-700' : 'text-amber-700'} font-bold mt-1">
                  ${itemReady ? 'Sản phẩm đã đủ điều kiện giao.' : 'Sản phẩm chưa đủ hàng, vui lòng xử lý trong panel Nhà máy.'}
                </p>
              </div>
            `;
          }).join('')}
        </div>
        <div class="action-grid mt-4">
          <button onclick="editOrder('${o.id}')" class="btn btn-secondary" ${canEdit ? '' : 'disabled'}>Sửa đơn</button>
          <button onclick="setOrderStatus('${o.id}', 'DELIVERING')" class="btn btn-warning" ${canDeliver ? '' : 'disabled'}>Giao hàng</button>
          <button onclick="setOrderStatus('${o.id}', 'COMPLETED')" class="btn btn-success" ${canFinishDelivery ? '' : 'disabled'}>Giao hàng thành công</button>
          <button onclick="setOrderStatus('${o.id}', 'RETURNED')" class="btn btn-warning" ${canFinishDelivery ? '' : 'disabled'}>Giao hàng không thành công</button>
          <button onclick="setOrderStatus('${o.id}', 'CANCELLED')" class="btn btn-danger" ${canCancel ? '' : 'disabled'}>Hủy order</button>
          <button onclick="deleteOrder('${o.id}')" class="btn btn-danger" ${canDelete ? '' : 'disabled'}>Xóa đơn</button>
        </div>
      </div>
    `;
  }).join('') || '<div class="card text-slate-500">Chưa có đơn hàng.</div>';
}

function renderFactory() {
  const activeOrderIds = appState.orders.filter(o => !['CANCELLED','COMPLETED','RETURNED'].includes(o.status)).map(o => o.id);
  const list = appState.orderItems.filter(i => activeOrderIds.includes(i.orderId) && Number(i.factoryQty || 0) > 0 && i.factoryStatus !== FACTORY_STATUS.RECEIVED);

  document.getElementById('factoryList').innerHTML = list.map(i => {
    const o = appState.orders.find(x => x.id === i.orderId) || {};
    const missingQty = Number(i.factoryQty || 0);
    const canMarkOrdered = i.factoryStatus === FACTORY_STATUS.NEED_ORDER;
    const canReceive = i.factoryStatus === FACTORY_STATUS.ORDERED;
    const canCancelFactory = i.factoryStatus === FACTORY_STATUS.ORDERED;
    return `
      <div class="card">
        <div class="flex flex-col md:flex-row md:justify-between gap-3">
          <div>
            <h3 class="font-black text-lg">${escapeHtml(i.productName)} x ${missingQty}</h3>
            <p class="text-sm text-slate-500">Đơn: ${escapeHtml(o.customerName || '')} • ${escapeHtml(o.customerPhone || '')}</p>
            <p class="text-sm"><b>Địa chỉ:</b> ${escapeHtml(o.customerAddress || '')}</p>
            <p class="text-sm mt-1">${factoryBadge(i.factoryStatus)}</p>
          </div>
          <div class="grid grid-cols-1 md:grid-cols-3 gap-2">
            <button onclick="updateFactoryItem('${i.id}', 'ORDERED')" class="btn btn-info" ${canMarkOrdered ? '' : 'disabled'}>Đã order NM</button>
            <button onclick="updateFactoryItem('${i.id}', 'RECEIVED')" class="btn btn-success" ${canReceive ? '' : 'disabled'}>Đã nhận hàng</button>
            <button onclick="updateFactoryItem('${i.id}', 'NEED_ORDER')" class="btn btn-danger" ${canCancelFactory ? '' : 'disabled'}>Hủy order NM</button>
          </div>
        </div>
      </div>
    `;
  }).join('') || '<div class="card text-slate-500">Không có sản phẩm cần đặt nhà máy.</div>';
}
