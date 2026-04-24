function addOrderItemRow(item = {}) {
  const box = document.getElementById('orderItemsBox');
  if (!box) return;

  const row = document.createElement('div');
  row.className = 'order-item-row';
  row.innerHTML = `
    <div class="grid grid-cols-1 md:grid-cols-[1fr_120px_auto] gap-2 items-end">
      <div>
        <label class="label">San pham</label>
        <select class="input order-product-select"></select>
      </div>
      <div>
        <label class="label">So luong</label>
        <input class="input order-qty" type="number" min="1" value="${Number(item.qty || 1)}" />
      </div>
      <button type="button" class="btn btn-danger" onclick="this.closest('.order-item-row').remove()">Xoa</button>
    </div>
  `;
  box.appendChild(row);

  const select = row.querySelector('.order-product-select');
  select.innerHTML = appState.products.map(p => `<option value="${escapeHtml(p.id)}">${escapeHtml(p.name)} - Kho ${Number(p.stock || 0)} - ${money(p.salePrice)}</option>`).join('');
  if (item.productId) select.value = item.productId;
}

function readOrderForm() {
  const items = [...document.querySelectorAll('.order-item-row')].map(row => ({
    productId: row.querySelector('.order-product-select').value,
    qty: Number(row.querySelector('.order-qty').value || 1)
  })).filter(i => i.productId && i.qty > 0);

  if (!items.length) throw new Error('Vui long them it nhat mot san pham vao don.');

  return {
    id: document.getElementById('editingOrderId').value,
    customerName: document.getElementById('customerName').value.trim(),
    customerPhone: document.getElementById('customerPhone').value.trim(),
    customerAddress: document.getElementById('customerAddress').value.trim(),
    note: document.getElementById('orderNote').value.trim(),
    items
  };
}

async function saveOrder() {
  try {
    const payload = readOrderForm();
    if (!payload.customerName || !payload.customerPhone) throw new Error('Vui long nhap ten khach va so dien thoai.');

    if (payload.id) {
      await api('updateOrder', payload, 'Dang cap nhat don hang...');
      toast('Da cap nhat don hang.');
    } else {
      const result = await api('createOrder', payload, 'Dang tao don hang...');
      toast(result.message || 'Da tao don hang.');
    }

    resetOrderForm();
    await loadAll({ keepView: true });
    showTab('orders');
  } catch (err) {
    toast(err.message);
  }
}

function editOrder(id) {
  const o = appState.orders.find(x => x.id === id);
  if (!o) return;

  if (o.status !== ORDER_STATUS.PENDING && o.status !== ORDER_STATUS.FACTORY_ORDERED) {
    toast('Chi nen sua don khi don chua giao hang hoac chua ket thuc.');
    return;
  }

  document.getElementById('editingOrderId').value = o.id;
  document.getElementById('customerName').value = o.customerName || '';
  document.getElementById('customerPhone').value = o.customerPhone || '';
  document.getElementById('customerAddress').value = o.customerAddress || '';
  document.getElementById('orderNote').value = o.note || '';
  document.getElementById('orderFormTitle').textContent = 'Sua don hang';
  document.getElementById('orderItemsBox').innerHTML = '';
  getOrderItems(o.id).forEach(i => addOrderItemRow(i));
  showTab('orderForm');
}

function resetOrderForm() {
  document.getElementById('editingOrderId').value = '';
  document.getElementById('customerName').value = '';
  document.getElementById('customerPhone').value = '';
  document.getElementById('customerAddress').value = '';
  document.getElementById('orderNote').value = '';
  document.getElementById('orderFormTitle').textContent = 'Tao don hang moi';
  document.getElementById('orderItemsBox').innerHTML = '';
  addOrderItemRow();
}

async function setOrderStatus(id, status) {
  const label = ORDER_STATUS_LABELS[status] || status;
  if (!confirm('Chuyen don sang trang thai: ' + label + '?')) return;

  try {
    await api('updateOrderStatus', { id, status }, 'Dang cap nhat trang thai...');
    await loadAll({ keepView: true });
    toast('Da cap nhat trang thai don hang.');
  } catch (err) {
    toast(err.message);
  }
}

async function updateFactoryItem(orderItemId, factoryStatus) {
  const label = FACTORY_STATUS_LABELS[factoryStatus] || factoryStatus;
  if (!confirm('Chuyen trang thai nha may sang: ' + label + '?')) return;

  try {
    await api('updateFactoryItem', { orderItemId, factoryStatus }, 'Dang cap nhat hang nha may...');
    await loadAll({ keepView: true });
    toast('Da cap nhat hang nha may.');
  } catch (err) {
    toast(err.message);
  }
}

async function deleteOrder(id) {
  if (!confirm('Xoa don nay? Don se bien mat khoi Don hang va cac muc lien quan trong Nha may cung bi xoa.')) return;

  try {
    await api('deleteOrder', { id }, 'Dang xoa don hang...');
    await loadAll({ keepView: true });
    toast('Da xoa don hang.');
  } catch (err) {
    toast(err.message);
  }
}
