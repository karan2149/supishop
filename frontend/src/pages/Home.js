import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Star } from '@phosphor-icons/react';
import axios from 'axios';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const Home = () => {
  const [featuredProducts, setFeaturedProducts] = useState([]);
  const [categories, setCategories] = useState([]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [productsRes, categoriesRes] = await Promise.all([
        axios.get(`${API_URL}/api/products?limit=8`),
        axios.get(`${API_URL}/api/categories`)
      ]);
      setFeaturedProducts(productsRes.data);
      setCategories(categoriesRes.data);
    } catch (error) {
      toast.error('Failed to load data');
    }
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA]" data-testid="home-page">
      {/* Hero Section - Bento Grid */}
      <section
        className="relative py-20 px-4 sm:px-6 lg:px-8 overflow-hidden"
        style={{
          backgroundImage: `url(https://static.prod-images.emergentagent.com/jobs/7c659ff4-129a-4b7d-b40f-0e8b9c0c2225/images/2fc9b376d5a556391f775aaee5838604074afbab3f3c046009000c76b7b8ae78.png)`,
          backgroundSize: 'cover',
          backgroundPosition: 'center'
        }}
        data-testid="hero-section"
      >
        <div className="absolute inset-0 bg-black bg-opacity-40"></div>
        <div className="relative max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-12 gap-4">
            <div className="col-span-1 md:col-span-4 lg:col-span-8 bg-white bg-opacity-95 p-12 rounded-lg">
              <h1 className="text-4xl md:text-5xl lg:text-6xl tracking-tighter font-extrabold text-[#111827] mb-4" style={{ fontFamily: 'Manrope, sans-serif' }}>
                Welcome to KPshop
              </h1>
              <p className="text-lg text-[#4B5563] mb-8 leading-relaxed" style={{ fontFamily: 'IBM Plex Sans, sans-serif' }}>
                Discover the latest electronics, fashion, and lifestyle products at unbeatable prices
              </p>
              <Link
                to="/products"
                className="inline-flex items-center space-x-2 px-6 py-3 bg-[#0052FF] text-white rounded-md hover:bg-[#0040CC] transition-all duration-200 font-semibold"
                data-testid="shop-now-button"
              >
                <span>Shop Now</span>
                <ArrowRight size={20} />
              </Link>
            </div>

            <div className="col-span-1 md:col-span-2 lg:col-span-4 space-y-4">
              <div className="bg-[#FACC15] p-6 rounded-lg h-32 flex items-center justify-center">
                <p className="text-2xl font-bold text-[#111827]" style={{ fontFamily: 'Manrope, sans-serif' }}>Up to 50% OFF</p>
              </div>
              <div className="bg-[#10B981] p-6 rounded-lg h-32 flex items-center justify-center">
                <p className="text-2xl font-bold text-white" style={{ fontFamily: 'Manrope, sans-serif' }}>Free Shipping</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Categories Section */}
      <section className="py-16 px-4 sm:px-6 lg:px-8" data-testid="categories-section">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-2xl md:text-3xl lg:text-4xl tracking-tight font-bold text-[#111827] mb-8" style={{ fontFamily: 'Manrope, sans-serif' }}>
            Shop by Category
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {categories.map((category) => (
              <Link
                key={category.id}
                to={`/products?category=${category.id}`}
                className="group bg-white rounded-lg border border-gray-200 overflow-hidden hover:shadow-md hover:-translate-y-1 transition-all duration-200"
                data-testid={`category-card-${category.slug}`}
              >
                <div className="h-48 overflow-hidden">
                  <img
                    src={category.image_url}
                    alt={category.name}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-200"
                  />
                </div>
                <div className="p-6">
                  <h3 className="text-xl font-semibold text-[#111827] mb-2" style={{ fontFamily: 'Manrope, sans-serif' }}>{category.name}</h3>
                  <p className="text-sm text-[#4B5563]" style={{ fontFamily: 'IBM Plex Sans, sans-serif' }}>{category.description}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Featured Products Section */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-white" data-testid="featured-products-section">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-2xl md:text-3xl lg:text-4xl tracking-tight font-bold text-[#111827]" style={{ fontFamily: 'Manrope, sans-serif' }}>
              Featured Products
            </h2>
            <Link
              to="/products"
              className="text-[#0052FF] hover:text-[#0040CC] font-semibold flex items-center space-x-2"
              data-testid="view-all-products-link"
            >
              <span>View All</span>
              <ArrowRight size={20} />
            </Link>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {featuredProducts.map((product) => (
              <Link
                key={product.id}
                to={`/products/${product.id}`}
                className="group bg-white rounded-lg border border-gray-200 overflow-hidden hover:shadow-md hover:-translate-y-1 transition-all duration-200"
                data-testid={`product-card-${product.id}`}
              >
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
                  <div className="flex items-center space-x-1 mb-2">
                    <Star size={16} weight="fill" className="text-[#FACC15]" />
                    <span className="text-sm text-[#4B5563]">{product.rating.toFixed(1)}</span>
                    <span className="text-xs text-[#9CA3AF]">({product.review_count})</span>
                  </div>
                  <div className="flex items-center space-x-2">
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
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};

export default Home;
