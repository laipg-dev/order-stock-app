const appState = {
  products: [],
  orders: [],
  orderItems: [],
  revenue: [],
  stats: [],
  busy: false,
  activeTab: 'dashboard',
  scrollY: 0
};

function setState(data) {
  appState.products = data.products || [];
  appState.orders = data.orders || [];
  appState.orderItems = data.orderItems || [];
  appState.revenue = data.revenue || [];
  appState.stats = data.stats || [];
}
