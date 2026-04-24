let __supabaseClient = null;
let __supabaseSignature = '';

function readInput(id) {
  const el = document.getElementById(id);
  return el ? String(el.value || '').trim() : '';
}

function normalizeSupabaseUrl(value) {
  return String(value || '')
    .trim()
    .replace(/\/rest\/v1\/?\s*$/i, '')
    .replace(/\/+$/, '');
}

function hydrateSupabaseInputs() {
  const url = localStorage.getItem(STORAGE_KEYS.SUPABASE_URL) || '';
  const key = localStorage.getItem(STORAGE_KEYS.SUPABASE_KEY) || '';
  const bucket = localStorage.getItem(STORAGE_KEYS.SUPABASE_BUCKET) || DEFAULT_PRODUCT_BUCKET;

  const urlInput = document.getElementById('supabaseUrl');
  const keyInput = document.getElementById('supabaseKey');
  const bucketInput = document.getElementById('supabaseBucket');

  if (urlInput) urlInput.value = url;
  if (keyInput) keyInput.value = key;
  if (bucketInput) bucketInput.value = bucket;
}

function getSupabaseConfig() {
  const url = normalizeSupabaseUrl(readInput('supabaseUrl') || localStorage.getItem(STORAGE_KEYS.SUPABASE_URL) || '');
  const key = readInput('supabaseKey') || localStorage.getItem(STORAGE_KEYS.SUPABASE_KEY) || '';
  const bucket = readInput('supabaseBucket') || localStorage.getItem(STORAGE_KEYS.SUPABASE_BUCKET) || DEFAULT_PRODUCT_BUCKET;

  if (!url) throw new Error('Ban chua nhap SUPABASE_URL. Vi du: https://xxxx.supabase.co');
  if (!key) throw new Error('Ban chua nhap SUPABASE_KEY. Hay dung anon/public key, khong dung service_role key o frontend.');

  return { url, key, bucket };
}

function saveSupabaseSettings(showToast = true) {
  const { url, key, bucket } = getSupabaseConfig();

  const urlInput = document.getElementById('supabaseUrl');
  if (urlInput) urlInput.value = url;

  localStorage.setItem(STORAGE_KEYS.SUPABASE_URL, url);
  localStorage.setItem(STORAGE_KEYS.SUPABASE_KEY, key);
  localStorage.setItem(STORAGE_KEYS.SUPABASE_BUCKET, bucket || DEFAULT_PRODUCT_BUCKET);

  __supabaseClient = null;
  __supabaseSignature = '';

  if (showToast) toast('Da luu cau hinh Supabase.');
}

function saveApiUrl() {
  saveSupabaseSettings();
}

function getSb() {
  const { url, key } = getSupabaseConfig();
  const signature = `${url}::${key}`;

  if (!window.supabase || !window.supabase.createClient) {
    throw new Error('Chua load Supabase CDN. Kiem tra script @supabase/supabase-js trong index.html.');
  }

  if (!__supabaseClient || __supabaseSignature !== signature) {
    __supabaseClient = window.supabase.createClient(url, key);
    __supabaseSignature = signature;
  }

  return __supabaseClient;
}

async function unwrap(request) {
  const { data, error } = await request;
  if (error) throw new Error(error.message || 'Supabase API loi.');
  return data;
}

function toNumber(value) {
  return Number(value || 0);
}

function generateProductCode(category = 'SP') {
  const prefix = String(category || 'SP')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 6) || 'SP';

  const now = new Date();
  const stamp = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
    String(now.getHours()).padStart(2, '0'),
    String(now.getMinutes()).padStart(2, '0'),
    String(now.getSeconds()).padStart(2, '0')
  ].join('');

  const random = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${prefix}-${stamp}-${random}`;
}

function parseAttributes(value) {
  if (!value) return {};
  if (typeof value === 'object') return value;

  const raw = String(value).trim();
  if (!raw) return {};

  try {
    return JSON.parse(raw);
  } catch (_) {
    const obj = {};
    raw.split(';').forEach(part => {
      const [key, ...rest] = part.split('=');
      if (key && rest.length) obj[key.trim()] = rest.join('=').trim();
    });
    return Object.keys(obj).length ? obj : { note: raw };
  }
}

function stringifyAttributes(value) {
  if (!value) return '';
  if (typeof value === 'string') return value;
  try {
    return Object.entries(value).map(([key, val]) => `${key}=${val}`).join('; ');
  } catch (_) {
    return '';
  }
}

function serializeCustomer(payload = {}) {
  return JSON.stringify({
    name: payload.customerName || payload.customer || '',
    phone: payload.customerPhone || '',
    address: payload.customerAddress || '',
    note: payload.note || ''
  });
}

function parseCustomer(value) {
  if (!value) return { name: '', phone: '', address: '', note: '' };

  if (typeof value === 'object') {
    return {
      name: value.name || value.customerName || '',
      phone: value.phone || value.customerPhone || '',
      address: value.address || value.customerAddress || '',
      note: value.note || ''
    };
  }

  try {
    const parsed = JSON.parse(value);
    return {
      name: parsed.name || '',
      phone: parsed.phone || '',
      address: parsed.address || '',
      note: parsed.note || ''
    };
  } catch (_) {
    return { name: String(value), phone: '', address: '', note: '' };
  }
}

function normalizeProduct(row) {
  return {
    id: row.id,
    code: row.id,
    name: row.name || '',
    category: row.category || '',
    stock: toNumber(row.stock),
    costPrice: toNumber(row.price_in),
    salePrice: toNumber(row.price_out),
    imageUrl: row.image_url || '',
    attributes: stringifyAttributes(row.attributes),
    createdAt: row.created_at,
    raw: row
  };
}

function normalizeOrder(row) {
  const customer = parseCustomer(row.customer);
  return {
    id: row.id,
    customerName: customer.name,
    customerPhone: customer.phone,
    customerAddress: customer.address,
    note: customer.note,
    status: row.status || ORDER_STATUS.PENDING,
    createdAt: row.created_at,
    raw: row
  };
}

function normalizeOrderItem(row) {
  const product = row.product || row.products || {};
  return {
    id: row.id,
    orderId: row.order_id,
    productId: row.product_id,
    productName: product.name || row.product_name || '',
    category: product.category || '',
    qty: toNumber(row.qty),
    salePrice: toNumber(row.sale_price),
    costPrice: toNumber(row.cost_price),
    factoryQty: toNumber(row.factory_qty),
    factoryStatus: row.factory_status || FACTORY_STATUS.RECEIVED,
    imageUrl: product.image_url || '',
    raw: row
  };
}

function normalizeRevenue(row) {
  const order = row.order || row.orders || {};
  const customer = parseCustomer(order.customer);
  const orderItems = order.order_items || [];

  if (!orderItems.length) {
    return [{
      id: row.id,
      orderId: row.order_id,
      orderRevenueId: row.id,
      amount: toNumber(row.amount),
      profit: toNumber(row.profit),
      qty: 1,
      createdAt: row.created_at,
      customerName: customer.name,
      customerPhone: customer.phone,
      productId: '',
      productName: 'Don hang',
      category: '',
      priceIn: 0,
      priceOut: toNumber(row.amount),
      orderAmount: toNumber(row.amount),
      orderProfit: toNumber(row.profit),
      raw: row
    }];
  }

  return orderItems.map(item => {
    const product = item.product || item.products || {};
    const qty = toNumber(item.qty) || 1;
    const amount = toNumber(item.sale_price) * qty;
    const profit = (toNumber(item.sale_price) - toNumber(item.cost_price)) * qty;

    return {
      id: `${row.id}-${item.id}`,
      orderId: row.order_id,
      orderRevenueId: row.id,
      orderItemId: item.id,
      amount,
      profit,
      qty,
      createdAt: row.created_at,
      customerName: customer.name,
      customerPhone: customer.phone,
      productId: item.product_id,
      productName: product.name || '',
      category: product.category || '',
      priceIn: toNumber(item.cost_price),
      priceOut: toNumber(item.sale_price),
      orderAmount: toNumber(row.amount),
      orderProfit: toNumber(row.profit),
      raw: row
    };
  });
}

function getSelectedProductImageFile(payload = {}) {
  if (payload.imageFile instanceof File) return payload.imageFile;
  const input = document.getElementById('productImageFile');
  return input && input.files && input.files[0] ? input.files[0] : null;
}

async function uploadProductImage(file, productId) {
  if (!file) return '';

  const { bucket } = getSupabaseConfig();
  const sb = getSb();
  const safeBucket = bucket || DEFAULT_PRODUCT_BUCKET;
  const ext = String(file.name || 'image.jpg').split('.').pop().toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
  const path = `${productId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

  const uploaded = await unwrap(
    sb.storage.from(safeBucket).upload(path, file, {
      cacheControl: '3600',
      upsert: true,
      contentType: file.type || undefined
    })
  );

  const { data } = sb.storage.from(safeBucket).getPublicUrl(uploaded.path);
  return data.publicUrl;
}

function normalizeOrderItemsPayload(items = []) {
  const map = new Map();

  items.forEach(item => {
    const productId = item.productId || item.product_id;
    const qty = Math.max(1, Number(item.qty || 1));
    if (!productId) return;

    if (!map.has(productId)) map.set(productId, { productId, qty: 0 });
    map.get(productId).qty += qty;
  });

  return [...map.values()];
}

async function getAllSupabase() {
  const sb = getSb();

  const [productsRaw, ordersRaw, orderItemsRaw, revenueRaw] = await Promise.all([
    unwrap(sb.from('products').select('*').order('created_at', { ascending: false })),
    unwrap(sb.from('orders').select('*').order('created_at', { ascending: false })),
    unwrap(sb.from('order_items').select('*, product:products(*)').order('created_at', { ascending: true })),
    unwrap(sb.from('revenue').select('*, order:orders(*, order_items(*, product:products(*)))').order('created_at', { ascending: false }))
  ]);

  const products = productsRaw.map(normalizeProduct);
  const orders = ordersRaw.map(normalizeOrder);
  const orderItems = orderItemsRaw.map(normalizeOrderItem);
  const revenue = revenueRaw.flatMap(normalizeRevenue);

  return { products, orders, orderItems, revenue, stats: revenue };
}

async function saveProductSupabase(payload) {
  const sb = getSb();
  const id = payload.id || generateProductCode(payload.category || 'SP');
  let imageUrl = payload.imageUrl || '';

  const file = getSelectedProductImageFile(payload);
  if (file) imageUrl = await uploadProductImage(file, id);

  const row = {
    id,
    name: payload.name,
    category: String(payload.category || '').toUpperCase(),
    stock: Math.max(0, toNumber(payload.stock)),
    price_in: Math.max(0, toNumber(payload.costPrice ?? payload.price_in)),
    price_out: Math.max(0, toNumber(payload.salePrice ?? payload.price_out)),
    image_url: imageUrl,
    attributes: parseAttributes(payload.attributes)
  };

  if (!row.name) throw new Error('Vui long nhap ten san pham.');
  if (!row.category) throw new Error('Vui long nhap category san pham.');

  await unwrap(sb.from('products').upsert(row, { onConflict: 'id' }).select().single());
  return { id, imageUrl };
}

async function deleteProductSupabase(payload) {
  if (!payload.id) throw new Error('Thieu ID san pham.');
  await unwrap(getSb().from('products').delete().eq('id', payload.id));
  return true;
}

async function createOrderSupabase(payload) {
  const items = normalizeOrderItemsPayload(payload.items);
  if (!items.length) throw new Error('Vui long them it nhat mot san pham vao don.');

  const data = await unwrap(getSb().rpc('create_order_tx', {
    p_customer: serializeCustomer(payload),
    p_items: items
  }));

  return {
    orderId: data,
    message: 'Da tao 1 don hang gom tat ca san pham.'
  };
}

async function updateOrderSupabase(payload) {
  if (!payload.id) throw new Error('Thieu ID don hang.');

  const items = normalizeOrderItemsPayload(payload.items);
  if (!items.length) throw new Error('Vui long them it nhat mot san pham vao don.');

  await unwrap(getSb().rpc('update_order_tx', {
    p_order_id: payload.id,
    p_customer: serializeCustomer(payload),
    p_items: items
  }));

  return true;
}

async function updateOrderStatusSupabase(payload) {
  const { id, status } = payload;
  if (!id || !status) throw new Error('Thieu ID hoac trang thai don hang.');

  const sb = getSb();

  if (status === ORDER_STATUS.DELIVERING) {
    await unwrap(sb.rpc('start_delivery_tx', { p_order_id: id }));
    return true;
  }

  if (status === ORDER_STATUS.COMPLETED) {
    await unwrap(sb.rpc('complete_order_tx', { p_order_id: id }));
    return true;
  }

  if (status === ORDER_STATUS.RETURNED) {
    await unwrap(sb.rpc('return_order_tx', { p_order_id: id }));
    return true;
  }

  if (status === ORDER_STATUS.CANCELLED) {
    await unwrap(sb.from('orders').update({ status }).eq('id', id));
    return true;
  }

  await unwrap(sb.from('orders').update({ status }).eq('id', id));
  return true;
}

async function updateFactoryItemSupabase(payload) {
  const orderItemId = payload.orderItemId || payload.id;
  const factoryStatus = payload.factoryStatus;
  if (!orderItemId) throw new Error('Thieu ID dong san pham can xu ly nha may.');

  const sb = getSb();

  if (factoryStatus === FACTORY_STATUS.ORDERED) {
    await unwrap(sb.rpc('mark_factory_ordered_tx', { p_order_item_id: orderItemId }));
    return true;
  }

  if (factoryStatus === FACTORY_STATUS.RECEIVED) {
    await unwrap(sb.rpc('receive_factory_item_tx', { p_order_item_id: orderItemId }));
    return true;
  }

  if (factoryStatus === FACTORY_STATUS.NEED_ORDER) {
    await unwrap(sb.rpc('reset_factory_item_tx', { p_order_item_id: orderItemId }));
    return true;
  }

  throw new Error('Trang thai nha may khong hop le.');
}

async function deleteOrderSupabase(payload) {
  if (!payload.id) throw new Error('Thieu ID don hang.');
  await unwrap(getSb().from('orders').delete().eq('id', payload.id));
  return true;
}

async function getRevenueReportSupabase(payload = {}) {
  const data = await getAllSupabase();
  let list = [...data.revenue];

  if (payload.year) list = list.filter(r => new Date(r.createdAt).getFullYear() === Number(payload.year));
  if (payload.month) list = list.filter(r => new Date(r.createdAt).getMonth() + 1 === Number(payload.month));

  if (payload.sortBy === 'sales_desc') list.sort((a, b) => b.amount - a.amount);
  else if (payload.sortBy === 'profit_desc') list.sort((a, b) => b.profit - a.profit);
  else if (payload.sortBy === 'product_best_seller') {
    const countMap = {};
    list.forEach(r => { countMap[r.productId] = (countMap[r.productId] || 0) + Number(r.qty || 1); });
    list.sort((a, b) => (countMap[b.productId] || 0) - (countMap[a.productId] || 0));
  } else list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  return list;
}

async function api(action, payload = {}, loadingText = 'Dang xu ly...') {
  const handlers = {
    getAll: getAllSupabase,
    saveProduct: saveProductSupabase,
    deleteProduct: deleteProductSupabase,
    createOrder: createOrderSupabase,
    updateOrder: updateOrderSupabase,
    updateOrderStatus: updateOrderStatusSupabase,
    updateFactoryItem: updateFactoryItemSupabase,
    deleteOrder: deleteOrderSupabase,
    getRevenueReport: getRevenueReportSupabase
  };

  if (!handlers[action]) throw new Error(`API action khong hop le: ${action}`);

  setBusy(true, loadingText);
  try {
    return await handlers[action](payload);
  } finally {
    setBusy(false);
  }
}

async function loadAll(options = {}) {
  try {
    if (options.keepView) saveScroll();
    saveSupabaseSettings(false);
    const data = await api('getAll', {}, 'Dang tai du lieu Supabase...');
    setState(data);
    renderAll();
    if (options.keepView) restoreScroll();
  } catch (err) {
    toast(err.message || 'Khong the tai du lieu.');
  }
}
