import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Star, ShoppingCart, Heart } from '@phosphor-icons/react';
import axios from 'axios';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const ProductDetail = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const [product, setProduct] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [quantity, setQuantity] = useState(1);
  const [selectedImage, setSelectedImage] = useState(0);

  useEffect(() => {
    fetchProduct();
    fetchReviews();
  }, [id]);

  const fetchProduct = async () => {
    try {
      const { data } = await axios.get(`${API_URL}/api/products/${id}`);
      setProduct(data);
    } catch (error) {
      toast.error('Failed to load product');
    }
  };

  const fetchReviews = async () => {
    try {
      const { data } = await axios.get(`${API_URL}/api/reviews/${id}`);
      setReviews(data);
    } catch (error) {
      console.error('Error fetching reviews:', error);
    }
  };

  const addToCart = async () => {
    if (!user) {
      toast.error('Please login to add items to cart');
      return;
    }

    try {
      await axios.post(
        `${API_URL}/api/cart`,
        { product_id: id, quantity },
        { withCredentials: true }
      );
      toast.success('Added to cart!');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to add to cart');
    }
  };

  const addToWishlist = async () => {
    if (!user) {
      toast.error('Please login to add items to wishlist');
      return;
    }

    try {
      await axios.post(`${API_URL}/api/wishlist/${id}`, {}, { withCredentials: true });
      toast.success('Added to wishlist!');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to add to wishlist');
    }
  };

  if (!product) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0052FF]"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8F9FA]" data-testid="product-detail-page">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          {/* Image Gallery */}
          <div className="space-y-4">
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <img
                src={product.images[selectedImage]}
                alt={product.name}
                className="w-full h-96 object-contain"
                data-testid="main-product-image"
              />
            </div>
            {product.images.length > 1 && (
              <div className="flex space-x-2">
                {product.images.map((img, idx) => (
                  <button
                    key={idx}
                    onClick={() => setSelectedImage(idx)}
                    className={`w-20 h-20 border-2 rounded-md overflow-hidden ${
                      selectedImage === idx ? 'border-[#0052FF]' : 'border-gray-200'
                    }`}
                    data-testid={`thumbnail-${idx}`}
                  >
                    <img src={img} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Product Info */}
          <div>
            <h1 className="text-2xl md:text-3xl lg:text-4xl tracking-tight font-bold text-[#111827] mb-4" style={{ fontFamily: 'Manrope, sans-serif' }}>
              {product.name}
            </h1>

            <div className="flex items-center space-x-2 mb-6">
              <div className="flex items-center space-x-1">
                {[...Array(5)].map((_, i) => (
                  <Star
                    key={i}
                    size={20}
                    weight={i < Math.floor(product.rating) ? 'fill' : 'regular'}
                    className="text-[#FACC15]"
                  />
                ))}
              </div>
              <span className="text-[#4B5563]" data-testid="rating-text">
                {product.rating.toFixed(1)} ({product.review_count} reviews)
              </span>
            </div>

            <div className="flex items-center space-x-4 mb-6">
              {product.discount_price ? (
                <>
                  <span className="text-3xl font-bold text-[#111827]" data-testid="discount-price">₹{product.discount_price}</span>
                  <span className="text-xl text-[#9CA3AF] line-through" data-testid="original-price">₹{product.price}</span>
                  <span className="px-3 py-1 bg-[#10B981] text-white rounded-md text-sm font-semibold">
                    {Math.round(((product.price - product.discount_price) / product.price) * 100)}% OFF
                  </span>
                </>
              ) : (
                <span className="text-3xl font-bold text-[#111827]" data-testid="price">₹{product.price}</span>
              )}
            </div>

            <p className="text-[#4B5563] mb-6 leading-relaxed" style={{ fontFamily: 'IBM Plex Sans, sans-serif' }} data-testid="product-description">
              {product.description}
            </p>

            {product.specifications && (
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-[#111827] mb-3">Specifications</h3>
                <div className="space-y-2">
                  {Object.entries(product.specifications).map(([key, value]) => (
                    <div key={key} className="flex items-center justify-between py-2 border-b border-gray-200">
                      <span className="text-[#4B5563] font-medium">{key}</span>
                      <span className="text-[#111827]">{value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="mb-6">
              <span className={`text-sm font-semibold ${
                product.stock > 0 ? 'text-[#10B981]' : 'text-[#EF4444]'
              }`} data-testid="stock-status">
                {product.stock > 0 ? `In Stock (${product.stock} available)` : 'Out of Stock'}
              </span>
            </div>

            <div className="flex items-center space-x-4 mb-6">
              <div>
                <label className="block text-sm font-semibold text-[#111827] mb-2">Quantity</label>
                <input
                  type="number"
                  min="1"
                  max={product.stock}
                  value={quantity}
                  onChange={(e) => setQuantity(parseInt(e.target.value))}
                  className="w-24 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#0052FF]"
                  data-testid="quantity-input"
                />
              </div>
            </div>

            <div className="flex space-x-4">
              <button
                onClick={addToCart}
                disabled={product.stock === 0}
                className="flex-1 flex items-center justify-center space-x-2 px-6 py-3 bg-[#0052FF] text-white rounded-md hover:bg-[#0040CC] transition-all duration-200 font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                data-testid="add-to-cart-button"
              >
                <ShoppingCart size={20} />
                <span>Add to Cart</span>
              </button>
              <button
                onClick={addToWishlist}
                className="px-6 py-3 border border-gray-300 bg-white hover:bg-gray-50 rounded-md transition-all"
                data-testid="add-to-wishlist-button"
              >
                <Heart size={20} />
              </button>
            </div>
          </div>
        </div>

        {/* Reviews Section */}
        <div className="mt-16">
          <h2 className="text-2xl md:text-3xl tracking-tight font-bold text-[#111827] mb-6" style={{ fontFamily: 'Manrope, sans-serif' }}>
            Customer Reviews
          </h2>
          {reviews.length === 0 ? (
            <p className="text-[#4B5563]" data-testid="no-reviews">No reviews yet</p>
          ) : (
            <div className="space-y-4" data-testid="reviews-list">
              {reviews.map((review) => (
                <div key={review.id} className="bg-white p-6 rounded-lg border border-gray-200" data-testid={`review-${review.id}`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold text-[#111827]">{review.user_name}</span>
                    <div className="flex items-center space-x-1">
                      {[...Array(5)].map((_, i) => (
                        <Star
                          key={i}
                          size={16}
                          weight={i < review.rating ? 'fill' : 'regular'}
                          className="text-[#FACC15]"
                        />
                      ))}
                    </div>
                  </div>
                  <p className="text-[#4B5563]" style={{ fontFamily: 'IBM Plex Sans, sans-serif' }}>{review.comment}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProductDetail;
