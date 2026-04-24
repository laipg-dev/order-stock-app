function setProductImagePreview(src) {
  const box = document.getElementById('productImagePreview');
  if (!box) return;

  if (!src) {
    box.className = 'product-img grid place-items-center text-xs text-slate-500';
    box.innerHTML = 'No image';
    return;
  }

  box.className = 'product-img';
  box.innerHTML = `<img class="product-img" src="${escapeHtml(src)}" onerror="setProductImagePreview('')" />`;
}

function previewSelectedProductImage() {
  const input = document.getElementById('productImageFile');
  const file = input && input.files && input.files[0] ? input.files[0] : null;
  if (!file) {
    setProductImagePreview(document.getElementById('imageUrl')?.value || '');
    return;
  }

  const reader = new FileReader();
  reader.onload = function(e) {
    setProductImagePreview(e.target.result);
  };
  reader.readAsDataURL(file);
}

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
      imageUrl: document.getElementById('imageUrl')?.value.trim() || '',
      imageFile: document.getElementById('productImageFile')?.files?.[0] || null
    };

    if (!payload.name || !payload.category) throw new Error('Vui long nhap ten va loai san pham.');
    await api('saveProduct', payload, 'Dang luu san pham...');
    resetProductForm();
    await loadAll({ keepView: true });
    toast('Da luu san pham.');
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

  const fileInput = document.getElementById('productImageFile');
  if (fileInput) fileInput.value = '';
  setProductImagePreview(p.imageUrl || '');

  showTab('products');
  toast('Da dua san pham vao form sua. Chon anh moi neu muon thay anh.');
}

async function deleteProduct(id) {
  if (!confirm('Ban chac chan muon xoa san pham nay?')) return;

  try {
    await api('deleteProduct', { id }, 'Dang xoa san pham...');
    await loadAll({ keepView: true });
    toast('Da xoa san pham.');
  } catch (err) {
    toast(err.message);
  }
}

function resetProductForm() {
  ['productId','productName','productCategory','costPrice','salePrice','stock','attributes','imageUrl'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });

  const fileInput = document.getElementById('productImageFile');
  if (fileInput) fileInput.value = '';
  setProductImagePreview('');
}
