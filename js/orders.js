function addOrderItemRow(item = {}) {
  const box = document.getElementById('orderItemsBox');
  const row = document.createElement('div');
  row.className = 'order-item-row';
  row.innerHTML = `
    <div class="grid grid-cols-1 md:grid-cols-[1fr_120px_auto] gap-2 items-end">
      <div>
        <label class="label">Sản phẩm</label>
        <select class="input order-product-select"></select>
      </div>
      <div>
        <label class="label">Số lượng</label>
        <input class="input order-qty" type="number" min="1" value="${Number(item.qty || 1)}" />
      </div>
      <button type="button" class="btn btn-danger" onclick="this.closest('.order-item-row').remove()">Xóa</button>
    </div>
  `;
  box.appendChild(row);
  const select = row.querySelector('.order-product-select');
  select.innerHTML = appState.products.map(p => `<option value="${p.id}">${escapeHtml(p.name)} - Kho ${Number(p.stock || 0)} - ${money(p.salePrice)}</option>`).join('');
  if (item.productId) select.value = item.productId;
}

function readOrderForm() {
  const items = [...document.querySelectorAll('.order-item-row')].map(row => ({
    productId: row.querySelector('.order-product-select').value,
    qty: Number(row.querySelector('.order-qty').value || 1)
  })).filter(i => i.productId && i.qty > 0);

  if (!items.length) throw new Error('Vui lòng thêm ít nhất một sản phẩm vào đơn.');

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
    if (!payload.customerName || !payload.customerPhone) throw new Error('Vui lòng nhập tên khách và số điện thoại.');

    if (payload.id) {
      await api('updateOrder', payload, 'Đang cập nhật đơn hàng...');
      toast('Đã cập nhật đơn hàng.');
    } else {
      const result = await api('createOrder', payload, 'Đang tạo đơn hàng...');
      toast(result.message || 'Đã tạo đơn hàng.');
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
    toast('Chỉ nên sửa đơn khi đơn chưa giao hàng hoặc chưa kết thúc.');
    return;
  }
  document.getElementById('editingOrderId').value = o.id;
  document.getElementById('customerName').value = o.customerName || '';
  document.getElementById('customerPhone').value = o.customerPhone || '';
  document.getElementById('customerAddress').value = o.customerAddress || '';
  document.getElementById('orderNote').value = o.note || '';
  document.getElementById('orderFormTitle').textContent = 'Sửa đơn hàng';
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
  document.getElementById('orderFormTitle').textContent = 'Tạo đơn hàng mới';
  document.getElementById('orderItemsBox').innerHTML = '';
  addOrderItemRow();
}

async function setOrderStatus(id, status) {
  const label = ORDER_STATUS_LABELS[status] || status;
  if (!confirm('Chuyển đơn sang trạng thái: ' + label + '?')) return;
  try {
    await api('updateOrderStatus', { id, status }, 'Đang cập nhật trạng thái...');
    await loadAll({ keepView: true });
    toast('Đã cập nhật trạng thái đơn hàng.');
  } catch (err) {
    toast(err.message);
  }
}

async function updateFactoryItem(orderItemId, factoryStatus) {
  const label = FACTORY_STATUS_LABELS[factoryStatus] || factoryStatus;
  if (!confirm('Chuyển trạng thái nhà máy sang: ' + label + '?')) return;
  try {
    await api('updateFactoryItem', { orderItemId, factoryStatus }, 'Đang cập nhật hàng nhà máy...');
    await loadAll({ keepView: true });
    toast('Đã cập nhật hàng nhà máy.');
  } catch (err) {
    toast(err.message);
  }
}

async function deleteOrder(id) {
  if (!confirm('Xóa đơn này? Đơn sẽ biến mất khỏi Đơn hàng và các mục liên quan trong Nhà máy cũng bị xóa.')) return;
  try {
    await api('deleteOrder', { id }, 'Đang xóa đơn hàng...');
    await loadAll({ keepView: true });
    toast('Đã xóa đơn hàng.');
  } catch (err) {
    toast(err.message);
  }
}
