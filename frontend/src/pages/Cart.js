import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Trash } from '@phosphor-icons/react';
import axios from 'axios';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const Cart = () => {
  const [cartItems, setCartItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchCart();
  }, []);

  const fetchCart = async () => {
    try {
      const { data } = await axios.get(`${API_URL}/api/cart`, { withCredentials: true });
      setCartItems(data);
    } catch (error) {
      toast.error('Failed to load cart');
    } finally {
      setLoading(false);
    }
  };

  const updateQuantity = async (itemId, quantity) => {
    if (quantity < 1) return;
    try {
      await axios.put(`${API_URL}/api/cart/${itemId}?quantity=${quantity}`, {}, { withCredentials: true });
      fetchCart();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to update quantity');
    }
  };

  const removeItem = async (itemId) => {
    try {
      await axios.delete(`${API_URL}/api/cart/${itemId}`, { withCredentials: true });
      toast.success('Item removed from cart');
      fetchCart();
    } catch (error) {
      toast.error('Failed to remove item');
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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0052FF]"></div>
      </div>
    );
  }

  if (cartItems.length === 0) {
    return (
      <div className="min-h-screen bg-[#F8F9FA] flex items-center justify-center" data-testid="empty-cart">
        <div className="text-center">
          <img
            src="https://static.prod-images.emergentagent.com/jobs/7c659ff4-129a-4b7d-b40f-0e8b9c0c2225/images/594054c6a675e4c979b433bdc39ab08f81b4fc1dafd520de6678700ccf0b89b0.png"
            alt="Empty Cart"
            className="w-64 mx-auto mb-6"
          />
          <h2 className="text-2xl font-bold text-[#111827] mb-4" style={{ fontFamily: 'Manrope, sans-serif' }}>Your cart is empty</h2>
          <Link
            to="/products"
            className="inline-block px-6 py-3 bg-[#0052FF] text-white rounded-md hover:bg-[#0040CC] transition-all font-semibold"
            data-testid="continue-shopping-button"
          >
            Continue Shopping
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8F9FA]" data-testid="cart-page">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-2xl md:text-3xl lg:text-4xl tracking-tight font-bold text-[#111827] mb-8" style={{ fontFamily: 'Manrope, sans-serif' }}>
          Shopping Cart
        </h1>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-4">
            {cartItems.map((item) => item.product && (
              <div key={item.id} className="bg-white p-6 rounded-lg border border-gray-200" data-testid={`cart-item-${item.id}`}>
                <div className="flex space-x-4">
                  <img
                    src={item.product.images[0]}
                    alt={item.product.name}
                    className="w-24 h-24 object-cover rounded-md"
                  />
                  <div className="flex-1">
                    <Link
                      to={`/products/${item.product.id}`}
                      className="text-lg font-semibold text-[#111827] hover:text-[#0052FF]"
                    >
                      {item.product.name}
                    </Link>
                    <div className="flex items-center space-x-2 mt-2">
                      {item.product.discount_price ? (
                        <>
                          <span className="text-xl font-bold text-[#111827]">₹{item.product.discount_price}</span>
                          <span className="text-sm text-[#9CA3AF] line-through">₹{item.product.price}</span>
                        </>
                      ) : (
                        <span className="text-xl font-bold text-[#111827]">₹{item.product.price}</span>
                      )}
                    </div>
                    <div className="flex items-center space-x-4 mt-4">
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => updateQuantity(item.id, item.quantity - 1)}
                          className="px-3 py-1 border border-gray-300 rounded-md hover:bg-gray-50"
                          data-testid="decrease-quantity-button"
                        >
                          -
                        </button>
                        <span className="text-[#111827] font-semibold" data-testid="item-quantity">{item.quantity}</span>
                        <button
                          onClick={() => updateQuantity(item.id, item.quantity + 1)}
                          className="px-3 py-1 border border-gray-300 rounded-md hover:bg-gray-50"
                          data-testid="increase-quantity-button"
                        >
                          +
                        </button>
                      </div>
                      <button
                        onClick={() => removeItem(item.id)}
                        className="text-[#EF4444] hover:text-[#DC2626] flex items-center space-x-1"
                        data-testid="remove-item-button"
                      >
                        <Trash size={16} />
                        <span>Remove</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div>
            <div className="bg-white p-6 rounded-lg border border-gray-200 sticky top-20" data-testid="cart-summary">
              <h2 className="text-xl font-bold text-[#111827] mb-4" style={{ fontFamily: 'Manrope, sans-serif' }}>Order Summary</h2>
              <div className="space-y-3 mb-6">
                <div className="flex items-center justify-between">
                  <span className="text-[#4B5563]">Subtotal</span>
                  <span className="font-semibold text-[#111827]" data-testid="subtotal">₹{getTotal()}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[#4B5563]">Shipping</span>
                  <span className="font-semibold text-[#10B981]">FREE</span>
                </div>
                <div className="border-t border-gray-200 pt-3">
                  <div className="flex items-center justify-between">
                    <span className="text-lg font-bold text-[#111827]">Total</span>
                    <span className="text-xl font-bold text-[#111827]" data-testid="total">₹{getTotal()}</span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => navigate('/checkout')}
                className="w-full py-3 bg-[#0052FF] text-white rounded-md hover:bg-[#0040CC] transition-all font-semibold"
                data-testid="proceed-to-checkout-button"
              >
                Proceed to Checkout
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Cart;
