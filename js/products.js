async function saveProduct() {
  try {
    const payload = {
      id: document.getElementById('productId').value,
      name: document.getElementById('productName').value.trim(),
      category: document.getElementById('productCategory').value.trim().toUpperCase(),
      costPrice: Number(document.getElementById('costPrice').value || 0),
      salePrice: Number(document.getElementById('salePrice').value || 0),
      stock: Number(document.getElementById('stock').value || 0),
      attributes: document.getElementById('attributes').value.trim(),
      imageUrl: document.getElementById('imageUrl').value.trim()
    };
    if (!payload.name || !payload.category) throw new Error('Vui lòng nhập tên và loại sản phẩm.');
    await api('saveProduct', payload, 'Đang lưu sản phẩm...');
    resetProductForm();
    await loadAll({ keepView: true });
    toast('Đã lưu sản phẩm.');
  } catch (err) {
    toast(err.message);
  }
}

function editProduct(id) {
  const p = getProduct(id);
  if (!p) return;
  document.getElementById('productId').value = p.id;
  document.getElementById('productName').value = p.name;
  document.getElementById('productCategory').value = p.category;
  document.getElementById('costPrice').value = p.costPrice;
  document.getElementById('salePrice').value = p.salePrice;
  document.getElementById('stock').value = p.stock;
  document.getElementById('attributes').value = p.attributes || '';
  document.getElementById('imageUrl').value = p.imageUrl || '';
  showTab('products');
  toast('Đã đưa sản phẩm vào form sửa.');
}

async function deleteProduct(id) {
  if (!confirm('Bạn chắc chắn muốn xóa sản phẩm này?')) return;
  try {
    await api('deleteProduct', { id }, 'Đang xóa sản phẩm...');
    await loadAll({ keepView: true });
    toast('Đã xóa sản phẩm.');
  } catch (err) {
    toast(err.message);
  }
}

function resetProductForm() {
  ['productId','productName','productCategory','costPrice','salePrice','stock','attributes','imageUrl'].forEach(id => document.getElementById(id).value = '');
}
