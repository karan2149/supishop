import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Trash, Heart } from '@phosphor-icons/react';
import axios from 'axios';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const Wishlist = () => {
  const [wishlist, setWishlist] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchWishlist();
  }, []);

  const fetchWishlist = async () => {
    try {
      const { data } = await axios.get(`${API_URL}/api/wishlist`, { withCredentials: true });
      setWishlist(data);
    } catch (error) {
      toast.error('Failed to load wishlist');
    } finally {
      setLoading(false);
    }
  };

  const removeFromWishlist = async (productId) => {
    try {
      await axios.delete(`${API_URL}/api/wishlist/${productId}`, { withCredentials: true });
      toast.success('Removed from wishlist');
      fetchWishlist();
    } catch (error) {
      toast.error('Failed to remove item');
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
    <div className="min-h-screen bg-[#F8F9FA]" data-testid="wishlist-page">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-2xl md:text-3xl lg:text-4xl tracking-tight font-bold text-[#111827] mb-8" style={{ fontFamily: 'Manrope, sans-serif' }}>
          My Wishlist
        </h1>

        {wishlist.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-lg border border-gray-200" data-testid="empty-wishlist">
            <Heart size={64} className="mx-auto text-gray-300 mb-4" />
            <p className="text-xl text-[#4B5563] mb-4">Your wishlist is empty</p>
            <Link
              to="/products"
              className="inline-block px-6 py-3 bg-[#0052FF] text-white rounded-md hover:bg-[#0040CC] transition-all font-semibold"
              data-testid="browse-products-button"
            >
              Browse Products
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6" data-testid="wishlist-grid">
            {wishlist.map((product) => (
              <div
                key={product.id}
                className="group bg-white rounded-lg border border-gray-200 overflow-hidden"
                data-testid={`wishlist-item-${product.id}`}
              >
                <Link to={`/products/${product.id}`} className="block">
                  <div className="h-48 overflow-hidden bg-[#F8F9FA]">
                    <img
                      src={product.images[0]}
                      alt={product.name}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-200"
                    />
                  </div>
                  <div className="p-4">
                    <h3 className="text-base font-semibold text-[#111827] mb-1 line-clamp-2" style={{ fontFamily: 'IBM Plex Sans, sans-serif' }}>
                      {product.name}
                    </h3>
                    <div className="flex items-center space-x-2 mb-2">
                      {product.discount_price ? (
                        <>
                          <span className="text-lg font-bold text-[#111827]">₹{product.discount_price}</span>
                          <span className="text-sm text-[#9CA3AF] line-through">₹{product.price}</span>
                        </>
                      ) : (
                        <span className="text-lg font-bold text-[#111827]">₹{product.price}</span>
                      )}
                    </div>
                  </div>
                </Link>
                <div className="px-4 pb-4">
                  <button
                    onClick={() => removeFromWishlist(product.id)}
                    className="w-full flex items-center justify-center space-x-2 py-2 border border-gray-300 text-[#EF4444] hover:bg-red-50 rounded-md transition-all"
                    data-testid="remove-from-wishlist-button"
                  >
                    <Trash size={16} />
                    <span className="text-sm font-semibold">Remove</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Wishlist;
