import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Package, ShoppingBag, Users, CurrencyDollar } from '@phosphor-icons/react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const AdminDashboard = () => {
  const [stats, setStats] = useState(null);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [statsRes, ordersRes] = await Promise.all([
        axios.get(`${API_URL}/api/admin/stats`, { withCredentials: true }),
        axios.get(`${API_URL}/api/admin/orders?limit=10`, { withCredentials: true })
      ]);
      setStats(statsRes.data);
      setOrders(ordersRes.data);
    } catch (error) {
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const updateOrderStatus = async (orderId, status) => {
    try {
      await axios.put(`${API_URL}/api/admin/orders/${orderId}/status?status=${status}`, {}, { withCredentials: true });
      toast.success('Order status updated');
      fetchData();
    } catch (error) {
      toast.error('Failed to update status');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0052FF]"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8F9FA]" data-testid="admin-dashboard">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-2xl md:text-3xl lg:text-4xl tracking-tight font-bold text-[#111827] mb-8" style={{ fontFamily: 'Manrope, sans-serif' }}>
          Admin Dashboard
        </h1>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8" data-testid="stats-grid">
          <div className="bg-white p-6 rounded-lg border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-[#4B5563] mb-1">Total Users</p>
                <p className="text-3xl font-bold text-[#111827]" data-testid="total-users">{stats?.total_users || 0}</p>
              </div>
              <Users size={40} className="text-[#0052FF]" />
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-[#4B5563] mb-1">Total Products</p>
                <p className="text-3xl font-bold text-[#111827]" data-testid="total-products">{stats?.total_products || 0}</p>
              </div>
              <Package size={40} className="text-[#10B981]" />
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-[#4B5563] mb-1">Total Orders</p>
                <p className="text-3xl font-bold text-[#111827]" data-testid="total-orders">{stats?.total_orders || 0}</p>
              </div>
              <ShoppingBag size={40} className="text-[#FACC15]" />
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-[#4B5563] mb-1">Total Revenue</p>
                <p className="text-3xl font-bold text-[#111827]" data-testid="total-revenue">₹{stats?.total_revenue || 0}</p>
              </div>
              <CurrencyDollar size={40} className="text-[#EF4444]" />
            </div>
          </div>
        </div>

        {/* Recent Orders */}
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-xl font-bold text-[#111827]" style={{ fontFamily: 'Manrope, sans-serif' }}>Recent Orders</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full" data-testid="orders-table">
              <thead className="bg-[#F8F9FA]">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-[#4B5563] uppercase tracking-wider">Order ID</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-[#4B5563] uppercase tracking-wider">Customer</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-[#4B5563] uppercase tracking-wider">Amount</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-[#4B5563] uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-[#4B5563] uppercase tracking-wider">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-[#4B5563] uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {orders.map((order) => (
                  <tr key={order.id} data-testid={`order-row-${order.id}`}>
                    <td className="px-6 py-4 text-sm font-mono text-[#111827]">{order.id.substring(0, 8)}...</td>
                    <td className="px-6 py-4 text-sm text-[#4B5563]">{order.user_email}</td>
                    <td className="px-6 py-4 text-sm font-semibold text-[#111827]">₹{order.total_amount}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-md text-xs font-semibold ${
                        order.status === 'paid' ? 'bg-[#10B981] text-white' :
                        order.status === 'pending' ? 'bg-[#FACC15] text-[#111827]' :
                        'bg-gray-200 text-gray-700'
                      }`}>
                        {order.status.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-[#4B5563]">{new Date(order.created_at).toLocaleDateString()}</td>
                    <td className="px-6 py-4">
                      <select
                        value={order.status}
                        onChange={(e) => updateOrderStatus(order.id, e.target.value)}
                        className="text-sm border border-gray-300 rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-[#0052FF]"
                        data-testid={`status-select-${order.id}`}
                      >
                        <option value="pending">Pending</option>
                        <option value="paid">Paid</option>
                        <option value="processing">Processing</option>
                        <option value="shipped">Shipped</option>
                        <option value="delivered">Delivered</option>
                        <option value="cancelled">Cancelled</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
