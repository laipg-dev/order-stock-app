const appState = {
  products: [],
  orders: [],
  orderItems: [],
  stats: [],
  busy: false,
  activeTab: 'dashboard',
  scrollY: 0
};

function setState(data) {
  appState.products = data.products || [];
  appState.orders = data.orders || [];
  appState.orderItems = data.orderItems || [];
  appState.stats = data.stats || [];
}
