import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { useRazorpay } from 'react-razorpay';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const Checkout = () => {
  const { Razorpay } = useRazorpay();
  const navigate = useNavigate();
  const [cartItems, setCartItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [address, setAddress] = useState({
    name: '',
    phone: '',
    street: '',
    city: '',
    state: '',
    pincode: ''
  });

  useEffect(() => {
    fetchCart();
  }, []);

  const fetchCart = async () => {
    try {
      const { data } = await axios.get(`${API_URL}/api/cart`, { withCredentials: true });
      if (data.length === 0) {
        toast.error('Your cart is empty');
        navigate('/cart');
      }
      setCartItems(data);
    } catch (error) {
      toast.error('Failed to load cart');
    }
  };

  const getTotal = () => {
    return cartItems.reduce((sum, item) => {
      if (item.product) {
        const price = item.product.discount_price || item.product.price;
        return sum + price * item.quantity;
      }
      return sum;
    }, 0);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const orderItems = cartItems.map(item => ({
        product_id: item.product_id,
        quantity: item.quantity,
        price: item.product.discount_price || item.product.price
      }));

      const { data: order } = await axios.post(
        `${API_URL}/api/orders`,
        {
          items: orderItems,
          shipping_address: address
        },
        { withCredentials: true }
      );

      const { data: razorpayOrder } = await axios.post(
        `${API_URL}/api/payments/create-order`,
        {
          amount: order.total_amount,
          order_id: order.id
        },
        { withCredentials: true }
      );

      // DEMO MODE: skip Razorpay and go directly to orders page
      if (razorpayOrder.demo_mode) {
        toast.success('Demo Payment Successful! Order placed.');
        navigate('/orders');
        return;
      }

      const options = {
        key: razorpayOrder.key_id,
        amount: razorpayOrder.amount,
        currency: razorpayOrder.currency,
        order_id: razorpayOrder.razorpay_order_id,
        name: 'KPCollection',
        description: 'Order Payment',
        handler: async (response) => {
          try {
            await axios.post(
              `${API_URL}/api/payments/verify`,
              {
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                order_id: order.id
              },
              { withCredentials: true }
            );
            toast.success('Payment successful!');
            navigate('/orders');
          } catch (error) {
            toast.error('Payment verification failed');
          }
        },
        prefill: {
          name: address.name,
          contact: address.phone
        },
        theme: {
          color: '#0052FF'
        }
      };

      const razorpayInstance = new Razorpay(options);
      razorpayInstance.open();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Checkout failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA]" data-testid="checkout-page">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-2xl md:text-3xl lg:text-4xl tracking-tight font-bold text-[#111827] mb-8" style={{ fontFamily: 'Manrope, sans-serif' }}>
          Checkout
        </h1>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <div className="bg-white p-6 rounded-lg border border-gray-200">
              <h2 className="text-xl font-bold text-[#111827] mb-4" style={{ fontFamily: 'Manrope, sans-serif' }}>Shipping Address</h2>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-[#111827] mb-1">Full Name</label>
                  <input
                    type="text"
                    value={address.name}
                    onChange={(e) => setAddress({ ...address, name: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#0052FF]"
                    required
                    data-testid="name-input"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-[#111827] mb-1">Phone Number</label>
                  <input
                    type="tel"
                    value={address.phone}
                    onChange={(e) => setAddress({ ...address, phone: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#0052FF]"
                    required
                    data-testid="phone-input"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-[#111827] mb-1">Street Address</label>
                  <input
                    type="text"
                    value={address.street}
                    onChange={(e) => setAddress({ ...address, street: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#0052FF]"
                    required
                    data-testid="street-input"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-[#111827] mb-1">City</label>
                    <input
                      type="text"
                      value={address.city}
                      onChange={(e) => setAddress({ ...address, city: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#0052FF]"
                      required
                      data-testid="city-input"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-[#111827] mb-1">State</label>
                    <input
                      type="text"
                      value={address.state}
                      onChange={(e) => setAddress({ ...address, state: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#0052FF]"
                      required
                      data-testid="state-input"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-[#111827] mb-1">Pincode</label>
                  <input
                    type="text"
                    value={address.pincode}
                    onChange={(e) => setAddress({ ...address, pincode: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#0052FF]"
                    required
                    data-testid="pincode-input"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 bg-[#0052FF] text-white rounded-md hover:bg-[#0040CC] transition-all font-semibold disabled:opacity-50"
                  data-testid="place-order-button"
                >
                  {loading ? 'Processing...' : 'Place Order'}
                </button>
              </form>
            </div>
          </div>

          <div>
            <div className="bg-white p-6 rounded-lg border border-gray-200 sticky top-20" data-testid="order-summary">
              <h2 className="text-xl font-bold text-[#111827] mb-4" style={{ fontFamily: 'Manrope, sans-serif' }}>Order Summary</h2>
              <div className="space-y-3">
                {cartItems.map((item) => item.product && (
                  <div key={item.id} className="flex justify-between text-sm">
                    <span className="text-[#4B5563]">{item.product.name} x {item.quantity}</span>
                    <span className="font-semibold text-[#111827]">
                      ₹{(item.product.discount_price || item.product.price) * item.quantity}
                    </span>
                  </div>
                ))}
                <div className="border-t border-gray-200 pt-3 mt-3">
                  <div className="flex items-center justify-between">
                    <span className="text-lg font-bold text-[#111827]">Total</span>
                    <span className="text-xl font-bold text-[#111827]" data-testid="total">₹{getTotal()}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Checkout;
