const SHEETS = {
  PRODUCTS: 'Products',
  ORDERS: 'Orders',
  ORDER_ITEMS: 'OrderItems',
  STATS: 'Stats',
  SETTINGS: 'Settings'
};

const HEADERS = {
  Products: ['id','code','name','category','costPrice','salePrice','stock','attributes','imageUrl','createdAt','updatedAt'],
  Orders: ['id','createdAt','updatedAt','customerName','customerPhone','customerAddress','status','note'],
  OrderItems: ['id','orderId','productId','productCode','productName','qty','costPrice','salePrice','reservedQty','factoryQty','factoryStatus','factoryNote'],
  Stats: ['id','createdAt','orderId','productId','productName','qty','revenue','profit'],
  Settings: ['key','value']
};

function doGet(e) {
  return handle_(e && e.parameter ? e.parameter.action : 'getAll', e && e.parameter && e.parameter.payload ? JSON.parse(e.parameter.payload) : {});
}

function doPost(e) {
  var body = {};
  if (e && e.postData && e.postData.contents) {
    body = JSON.parse(e.postData.contents);
  }
  return handle_(body.action || 'getAll', body.payload || {});
}

function handle_(action, payload) {
  try {
    setupSheets_();
    var data;
    switch (action) {
      case 'getAll': data = getAll_(); break;
      case 'saveProduct': data = saveProduct_(payload); break;
      case 'deleteProduct': data = deleteProduct_(payload); break;
      case 'createOrder': data = createOrder_(payload); break;
      case 'updateOrder': data = updateOrder_(payload); break;
      case 'updateOrderStatus': data = updateOrderStatus_(payload); break;
      case 'updateFactoryItem': data = updateFactoryItem_(payload); break;
      case 'deleteOrder': data = deleteOrder_(payload); break;
      default: throw new Error('Action không hợp lệ: ' + action);
    }
    return json_({ ok: true, data: data });
  } catch (err) {
    return json_({ ok: false, message: err.message });
  }
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function setupSheets_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  Object.keys(SHEETS).forEach(function(key) {
    var sheetName = SHEETS[key];
    var headers = HEADERS[sheetName];
    var sheet = ss.getSheetByName(sheetName);
    if (!sheet) sheet = ss.insertSheet(sheetName);

    var currentLastCol = Math.max(sheet.getLastColumn(), 1);
    var currentHeaders = sheet.getRange(1, 1, 1, currentLastCol).getValues()[0].map(String);
    var empty = currentHeaders.every(function(v) { return !v; });

    if (empty) {
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      sheet.setFrozenRows(1);
    } else {
      headers.forEach(function(h) {
        if (currentHeaders.indexOf(h) === -1) {
          sheet.getRange(1, sheet.getLastColumn() + 1).setValue(h);
        }
      });
    }
  });
}

function getAll_() {
  return {
    products: readObjects_(SHEETS.PRODUCTS),
    orders: readObjects_(SHEETS.ORDERS),
    orderItems: readObjects_(SHEETS.ORDER_ITEMS),
    stats: readObjects_(SHEETS.STATS)
  };
}

function saveProduct_(p) {
  if (!p.name || !p.category) throw new Error('Thiếu tên hoặc loại sản phẩm.');

  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var sheet = getSheet_(SHEETS.PRODUCTS);
    var rows = readObjects_(SHEETS.PRODUCTS);
    var now = new Date().toISOString();

    if (p.id) {
      var idx = findIndexById_(rows, p.id);
      if (idx < 0) throw new Error('Không tìm thấy sản phẩm.');
      var old = rows[idx];
      var updated = {
        id: old.id,
        code: old.code,
        name: p.name,
        category: p.category,
        costPrice: Number(p.costPrice || 0),
        salePrice: Number(p.salePrice || 0),
        stock: Number(p.stock || 0),
        attributes: p.attributes || '',
        imageUrl: p.imageUrl || '',
        createdAt: old.createdAt,
        updatedAt: now
      };
      writeObjectAtRow_(sheet, getHeaders_(sheet), idx + 2, updated);
      return updated;
    }

    var product = {
      id: makeId_('P'),
      code: generateProductCode_(p.category),
      name: p.name,
      category: p.category,
      costPrice: Number(p.costPrice || 0),
      salePrice: Number(p.salePrice || 0),
      stock: Number(p.stock || 0),
      attributes: p.attributes || '',
      imageUrl: p.imageUrl || '',
      createdAt: now,
      updatedAt: now
    };
    appendObject_(sheet, getHeaders_(sheet), product);
    return product;
  } finally {
    lock.releaseLock();
  }
}

function deleteProduct_(payload) {
  var id = payload.id;
  if (!id) throw new Error('Thiếu product id.');
  var used = readObjects_(SHEETS.ORDER_ITEMS).some(function(i) { return i.productId === id; });
  if (used) throw new Error('Sản phẩm đã nằm trong đơn hàng, không nên xóa. Hãy sửa tồn kho hoặc ngừng dùng sản phẩm này.');
  var sheet = getSheet_(SHEETS.PRODUCTS);
  var rows = readObjects_(SHEETS.PRODUCTS);
  var idx = findIndexById_(rows, id);
  if (idx < 0) throw new Error('Không tìm thấy sản phẩm.');
  sheet.deleteRow(idx + 2);
  return { id: id };
}

function createOrder_(payload) {
  return saveOrderInternal_(payload, false);
}

function updateOrder_(payload) {
  if (!payload.id) throw new Error('Thiếu order id.');
  return saveOrderInternal_(payload, true);
}

function saveOrderInternal_(payload, isUpdate) {
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    if (!payload.customerName || !payload.customerPhone) throw new Error('Thiếu tên khách hoặc số điện thoại.');
    if (!payload.items || !payload.items.length) throw new Error('Đơn hàng phải có ít nhất một sản phẩm.');

    var existingOrder = null;
    if (isUpdate) {
      existingOrder = getOrderById_(payload.id);
      if (!existingOrder) throw new Error('Không tìm thấy đơn hàng.');
      if (['DELIVERING','COMPLETED','RETURNED','CANCELLED'].indexOf(existingOrder.status) !== -1) {
        throw new Error('Không được sửa đơn khi đơn đã giao, đã hủy hoặc đã kết thúc.');
      }
      removeOrderItems_(payload.id);
    }

    var now = new Date().toISOString();
    var orderId = isUpdate ? payload.id : makeId_('O');
    var order = {
      id: orderId,
      createdAt: isUpdate ? existingOrder.createdAt : now,
      updatedAt: now,
      customerName: payload.customerName,
      customerPhone: payload.customerPhone,
      customerAddress: payload.customerAddress || '',
      status: isUpdate ? (existingOrder.status || 'PENDING') : 'PENDING',
      note: payload.note || ''
    };

    if (isUpdate) {
      updateOrderRow_(orderId, order);
    } else {
      appendObject_(getSheet_(SHEETS.ORDERS), getHeaders_(getSheet_(SHEETS.ORDERS)), order);
    }

    var shortageMessages = [];
    payload.items.forEach(function(item) {
      var product = getProductById_(item.productId);
      if (!product) throw new Error('Không tìm thấy sản phẩm trong đơn.');
      var qty = Number(item.qty || 0);
      if (qty <= 0) throw new Error('Số lượng sản phẩm phải lớn hơn 0.');

      var currentStock = Number(product.stock || 0);
      var factoryQty = Math.max(0, qty - currentStock);

      if (factoryQty > 0) {
        shortageMessages.push(product.name + ' thiếu ' + factoryQty);
      }

      var orderItem = {
        id: makeId_('I'),
        orderId: orderId,
        productId: product.id,
        productCode: product.code,
        productName: product.name,
        qty: qty,
        costPrice: Number(product.costPrice || 0),
        salePrice: Number(product.salePrice || 0),
        reservedQty: 0,
        factoryQty: factoryQty,
        factoryStatus: factoryQty > 0 ? 'NEED_ORDER' : 'RECEIVED',
        factoryNote: ''
      };
      appendObject_(getSheet_(SHEETS.ORDER_ITEMS), getHeaders_(getSheet_(SHEETS.ORDER_ITEMS)), orderItem);
    });

    syncOrderFactoryStatus_(orderId);

    var message = 'Đã lưu đơn hàng.';
    if (shortageMessages.length) {
      message += ' Có sản phẩm thiếu kho cần đặt nhà máy: ' + shortageMessages.join('; ') + '.';
    } else {
      message += ' Tất cả sản phẩm đủ kho, có thể giao hàng.';
    }

    return { order: getOrderById_(orderId), message: message };
  } finally {
    lock.releaseLock();
  }
}

function updateOrderStatus_(payload) {
  var id = payload.id;
  var nextStatus = payload.status;

  if (!id) throw new Error('Thiếu order id.');

  var valid = ['PENDING','FACTORY_ORDERED','DELIVERING','CANCELLED','COMPLETED','RETURNED'];
  if (valid.indexOf(nextStatus) === -1) {
    throw new Error('Trạng thái đơn hàng không hợp lệ.');
  }

  var lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    var order = getOrderById_(id);
    if (!order) throw new Error('Không tìm thấy đơn hàng.');

    var currentStatus = order.status || 'PENDING';

    if (['COMPLETED','RETURNED'].indexOf(currentStatus) !== -1) {
      throw new Error('Đơn đã kết thúc, không thể đổi trạng thái tiếp.');
    }

    validateOrderTransition_(id, currentStatus, nextStatus);

    if (nextStatus === 'DELIVERING') {
      deductOrderStockForDelivery_(id);
    }

    if (nextStatus === 'RETURNED') {
      addOrderQtyBackToStock_(id);
    }

    if (nextStatus === 'COMPLETED') {
      writeStatsForOrder_(id);
    }

    order.status = nextStatus;
    order.updatedAt = new Date().toISOString();
    updateOrderRow_(id, order);

    return { order: order };
  } finally {
    lock.releaseLock();
  }
}

function validateOrderTransition_(orderId, currentStatus, nextStatus) {
  if (currentStatus === nextStatus) return;

  var map = {
    PENDING: ['FACTORY_ORDERED', 'DELIVERING', 'CANCELLED'],
    FACTORY_ORDERED: ['DELIVERING', 'CANCELLED'],
    DELIVERING: ['COMPLETED', 'RETURNED'],
    CANCELLED: [],
    COMPLETED: [],
    RETURNED: []
  };

  var allowed = map[currentStatus] || [];
  if (allowed.indexOf(nextStatus) === -1) {
    throw new Error('Không thể chuyển đơn từ "' + statusLabel_(currentStatus) + '" sang "' + statusLabel_(nextStatus) + '".');
  }

  if (nextStatus === 'DELIVERING' && !isOrderReadyForDelivery_(orderId)) {
    throw new Error('Chưa thể giao hàng vì tồn kho hiện tại chưa đủ cho đơn này. Hãy xử lý bên Nhà máy trước.');
  }
}

function statusLabel_(status) {
  var labels = {
    PENDING: 'Đang xử lý',
    FACTORY_ORDERED: 'Đã order nhà máy',
    DELIVERING: 'Giao hàng',
    CANCELLED: 'Đã hủy order',
    COMPLETED: 'Giao hàng thành công',
    RETURNED: 'Giao hàng không thành công'
  };
  return labels[status] || status;
}

function updateFactoryItem_(payload) {
  var orderItemId = payload.orderItemId;
  var factoryStatus = payload.factoryStatus;

  if (!orderItemId) throw new Error('Thiếu order item id.');

  if (['NEED_ORDER','ORDERED','RECEIVED'].indexOf(factoryStatus) === -1) {
    throw new Error('Trạng thái nhà máy không hợp lệ.');
  }

  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var sheet = getSheet_(SHEETS.ORDER_ITEMS);
    var rows = readObjects_(SHEETS.ORDER_ITEMS);
    var idx = findIndexById_(rows, orderItemId);

    if (idx < 0) throw new Error('Không tìm thấy sản phẩm đặt nhà máy.');

    var item = rows[idx];
    var order = getOrderById_(item.orderId);
    if (!order) throw new Error('Không tìm thấy đơn hàng liên quan.');
    if (['DELIVERING','COMPLETED','RETURNED','CANCELLED'].indexOf(order.status) !== -1) {
      throw new Error('Đơn đã giao, đã hủy hoặc đã kết thúc nên không thể đổi trạng thái nhà máy.');
    }

    var current = item.factoryStatus || 'NEED_ORDER';
    var allowedMap = {
      NEED_ORDER: ['ORDERED'],
      ORDERED: ['RECEIVED', 'NEED_ORDER'],
      RECEIVED: []
    };

    var allowed = allowedMap[current] || [];
    if (allowed.indexOf(factoryStatus) === -1) {
      throw new Error('Không thể chuyển hàng nhà máy từ ' + current + ' sang ' + factoryStatus + '.');
    }

    if (factoryStatus === 'RECEIVED') {
      receiveFactoryItemToStock_(item);
      item.factoryStatus = 'RECEIVED';
      item.reservedQty = 0;
      item.factoryQty = 0;
    } else {
      item.factoryStatus = factoryStatus;
    }

    writeObjectAtRow_(sheet, getHeaders_(sheet), idx + 2, item);
    syncOrderFactoryStatus_(item.orderId);

    return item;
  } finally {
    lock.releaseLock();
  }
}

function deleteOrder_(payload) {
  var id = payload.id;
  if (!id) throw new Error('Thiếu order id.');

  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var order = getOrderById_(id);
    if (!order) throw new Error('Không tìm thấy đơn hàng.');
    if (order.status !== 'CANCELLED') {
      throw new Error('Chỉ được xóa đơn sau khi đã Hủy order.');
    }

    removeOrderItems_(id);
    deleteOrderRow_(id);
    removeStatsForOrder_(id);

    return { id: id };
  } finally {
    lock.releaseLock();
  }
}

function releaseOrderReservations_(orderId) {
  // Luồng mới không trừ kho khi tạo đơn, nên không cần hoàn kho ở bước hủy trước giao.
  return;
}

function addOrderQtyBackToStock_(orderId) {
  var items = readObjects_(SHEETS.ORDER_ITEMS).filter(function(i) { return i.orderId === orderId; });
  items.forEach(function(item) {
    var qty = Number(item.qty || 0);
    var product = getProductById_(item.productId);
    if (product) {
      product.stock = Number(product.stock || 0) + qty;
      product.updatedAt = new Date().toISOString();
      updateProductRow_(product.id, product);
    }
  });
}

function cancelFactoryItems_(orderId) {
  // Luồng mới chỉ ẩn dữ liệu nhà máy khi đơn bị hủy. Dữ liệu thật sự bị xóa trong deleteOrder_.
  return;
}

function markNeedOrderItemsAsOrdered_(orderId) {
  // Không còn dùng nút order nhà máy trong panel Đơn hàng. Thao tác này nằm ở panel Nhà máy.
  return;
}

function markOrderedItemsAsReceived_(orderId) {
  // Không còn dùng nút nhận hàng nhà máy trong panel Đơn hàng. Thao tác này nằm ở panel Nhà máy.
  return;
}

function syncOrderFactoryStatus_(orderId) {
  var order = getOrderById_(orderId);
  if (!order) return;

  if (['CANCELLED','COMPLETED','RETURNED','DELIVERING'].indexOf(order.status) !== -1) return;

  var items = readObjects_(SHEETS.ORDER_ITEMS).filter(function(i) {
    return i.orderId === orderId && Number(i.factoryQty || 0) > 0;
  });

  var anyOrdered = items.some(function(i) { return i.factoryStatus === 'ORDERED'; });
  var nextStatus = anyOrdered ? 'FACTORY_ORDERED' : 'PENDING';

  if (order.status !== nextStatus) {
    order.status = nextStatus;
    order.updatedAt = new Date().toISOString();
    updateOrderRow_(orderId, order);
  }
}

function isOrderReadyForDelivery_(orderId) {
  var items = readObjects_(SHEETS.ORDER_ITEMS).filter(function(i) { return i.orderId === orderId; });
  return items.every(function(item) {
    var product = getProductById_(item.productId);
    return product && Number(product.stock || 0) >= Number(item.qty || 0);
  });
}

function deductOrderStockForDelivery_(orderId) {
  var items = readObjects_(SHEETS.ORDER_ITEMS).filter(function(i) { return i.orderId === orderId; });
  items.forEach(function(item) {
    var product = getProductById_(item.productId);
    if (!product) throw new Error('Không tìm thấy sản phẩm để giao hàng.');
    var qty = Number(item.qty || 0);
    if (Number(product.stock || 0) < qty) {
      throw new Error('Tồn kho không đủ cho sản phẩm: ' + item.productName + '.');
    }
    product.stock = Number(product.stock || 0) - qty;
    product.updatedAt = new Date().toISOString();
    updateProductRow_(product.id, product);
  });
}

function receiveFactoryItemToStock_(item) {
  var qty = Number(item.factoryQty || 0);
  if (qty <= 0) throw new Error('Sản phẩm này không còn số lượng cần nhận từ nhà máy.');
  var product = getProductById_(item.productId);
  if (!product) throw new Error('Không tìm thấy sản phẩm để cập nhật tồn kho.');
  product.stock = Number(product.stock || 0) + qty;
  product.updatedAt = new Date().toISOString();
  updateProductRow_(product.id, product);
}

function writeStatsForOrder_(orderId) {
  removeStatsForOrder_(orderId);
  var items = readObjects_(SHEETS.ORDER_ITEMS).filter(function(i) { return i.orderId === orderId; });
  var sheet = getSheet_(SHEETS.STATS);
  var headers = getHeaders_(sheet);
  var now = new Date().toISOString();

  items.forEach(function(item) {
    var qty = Number(item.qty || 0);
    var revenue = Number(item.salePrice || 0) * qty;
    var profit = (Number(item.salePrice || 0) - Number(item.costPrice || 0)) * qty;
    appendObject_(sheet, headers, {
      id: makeId_('S'),
      createdAt: now,
      orderId: orderId,
      productId: item.productId,
      productName: item.productName,
      qty: qty,
      revenue: revenue,
      profit: profit
    });
  });
}

function removeStatsForOrder_(orderId) {
  var sheet = getSheet_(SHEETS.STATS);
  var rows = readObjects_(SHEETS.STATS);
  for (var i = rows.length - 1; i >= 0; i--) {
    if (rows[i].orderId === orderId) sheet.deleteRow(i + 2);
  }
}

function removeOrderItems_(orderId) {
  var sheet = getSheet_(SHEETS.ORDER_ITEMS);
  var rows = readObjects_(SHEETS.ORDER_ITEMS);
  for (var i = rows.length - 1; i >= 0; i--) {
    if (rows[i].orderId === orderId) sheet.deleteRow(i + 2);
  }
}

function getProductById_(id) {
  return readObjects_(SHEETS.PRODUCTS).find(function(p) { return p.id === id; });
}

function getOrderById_(id) {
  return readObjects_(SHEETS.ORDERS).find(function(o) { return o.id === id; });
}

function updateProductRow_(id, product) {
  var sheet = getSheet_(SHEETS.PRODUCTS);
  var rows = readObjects_(SHEETS.PRODUCTS);
  var idx = findIndexById_(rows, id);
  if (idx < 0) throw new Error('Không tìm thấy sản phẩm để cập nhật.');
  writeObjectAtRow_(sheet, getHeaders_(sheet), idx + 2, product);
}

function updateOrderRow_(id, order) {
  var sheet = getSheet_(SHEETS.ORDERS);
  var rows = readObjects_(SHEETS.ORDERS);
  var idx = findIndexById_(rows, id);
  if (idx < 0) throw new Error('Không tìm thấy đơn để cập nhật.');
  writeObjectAtRow_(sheet, getHeaders_(sheet), idx + 2, order);
}

function deleteOrderRow_(id) {
  var sheet = getSheet_(SHEETS.ORDERS);
  var rows = readObjects_(SHEETS.ORDERS);
  var idx = findIndexById_(rows, id);
  if (idx >= 0) sheet.deleteRow(idx + 2);
}

function findIndexById_(rows, id) {
  for (var i = 0; i < rows.length; i++) {
    if (rows[i].id === id) return i;
  }
  return -1;
}

function generateProductCode_(category) {
  var cleanCategory = String(category || 'SP').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12) || 'SP';
  var date = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd');
  var key = cleanCategory + '-' + date;
  var current = Number(getSetting_(key) || 0) + 1;
  setSetting_(key, current);
  return cleanCategory + '-' + date + '-' + String(current).padStart(3, '0');
}

function getSetting_(key) {
  var rows = readObjects_(SHEETS.SETTINGS);
  var found = rows.find(function(r) { return r.key === key; });
  return found ? found.value : '';
}

function setSetting_(key, value) {
  var sheet = getSheet_(SHEETS.SETTINGS);
  var rows = readObjects_(SHEETS.SETTINGS);
  var idx = rows.findIndex(function(r) { return r.key === key; });
  var obj = { key: key, value: String(value) };
  if (idx >= 0) writeObjectAtRow_(sheet, getHeaders_(sheet), idx + 2, obj);
  else appendObject_(sheet, getHeaders_(sheet), obj);
}

function getSheet_(name) {
  return SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
}

function getHeaders_(sheet) {
  var lastCol = sheet.getLastColumn();
  if (lastCol < 1) return [];
  return sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(String);
}

function readObjects_(sheetName) {
  var sheet = getSheet_(sheetName);
  if (!sheet) return [];
  var values = sheet.getDataRange().getValues();
  if (values.length <= 1) return [];
  var headers = values[0].map(String);
  return values.slice(1).filter(function(row) {
    return row.some(function(cell) { return cell !== ''; });
  }).map(function(row) {
    var obj = {};
    headers.forEach(function(h, i) { obj[h] = row[i]; });
    return obj;
  });
}

function appendObject_(sheet, headers, obj) {
  sheet.appendRow(headers.map(function(h) {
    return obj[h] !== undefined ? obj[h] : '';
  }));
}

function writeObjectAtRow_(sheet, headers, rowNumber, obj) {
  sheet.getRange(rowNumber, 1, 1, headers.length).setValues([
    headers.map(function(h) {
      return obj[h] !== undefined ? obj[h] : '';
    })
  ]);
}

function makeId_(prefix) {
  return prefix + '-' + Utilities.getUuid().slice(0, 8).toUpperCase();
}
