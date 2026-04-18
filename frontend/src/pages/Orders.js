import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const Orders = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    try {
      const { data } = await axios.get(`${API_URL}/api/orders`, { withCredentials: true });
      setOrders(data);
    } catch (error) {
      toast.error('Failed to load orders');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      pending: 'bg-[#FACC15] text-[#111827]',
      paid: 'bg-[#10B981] text-white',
      processing: 'bg-[#0052FF] text-white',
      shipped: 'bg-[#0052FF] text-white',
      delivered: 'bg-[#10B981] text-white',
      cancelled: 'bg-[#EF4444] text-white',
      failed: 'bg-[#EF4444] text-white'
    };
    return colors[status] || 'bg-gray-200 text-gray-700';
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0052FF]"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8F9FA]" data-testid="orders-page">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-2xl md:text-3xl lg:text-4xl tracking-tight font-bold text-[#111827] mb-8" style={{ fontFamily: 'Manrope, sans-serif' }}>
          My Orders
        </h1>

        {orders.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-lg border border-gray-200" data-testid="no-orders">
            <p className="text-xl text-[#4B5563] mb-4">No orders yet</p>
            <Link
              to="/products"
              className="inline-block px-6 py-3 bg-[#0052FF] text-white rounded-md hover:bg-[#0040CC] transition-all font-semibold"
              data-testid="start-shopping-button"
            >
              Start Shopping
            </Link>
          </div>
        ) : (
          <div className="space-y-4" data-testid="orders-list">
            {orders.map((order) => (
              <div key={order.id} className="bg-white p-6 rounded-lg border border-gray-200" data-testid={`order-${order.id}`}>
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <p className="text-sm text-[#4B5563]">Order ID: <span className="font-mono" data-testid="order-id">{order.id}</span></p>
                    <p className="text-sm text-[#4B5563]">Date: {new Date(order.created_at).toLocaleDateString()}</p>
                  </div>
                  <span className={`px-3 py-1 rounded-md text-sm font-semibold ${getStatusColor(order.status)}`} data-testid="order-status">
                    {order.status.toUpperCase()}
                  </span>
                </div>

                <div className="space-y-2 mb-4">
                  {order.items.map((item, idx) => (
                    <div key={idx} className="text-sm text-[#4B5563]">
                      Product ID: {item.product_id} - Quantity: {item.quantity}
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                  <span className="text-lg font-bold text-[#111827]">Total: ₹{order.total_amount}</span>
                  <Link
                    to={`/orders/${order.id}`}
                    className="text-[#0052FF] hover:text-[#0040CC] font-semibold"
                    data-testid="view-details-button"
                  >
                    View Details
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Orders;
