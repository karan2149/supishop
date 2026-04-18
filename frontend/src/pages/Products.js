import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Star, Faders } from '@phosphor-icons/react';
import axios from 'axios';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const Products = () => {
  const [searchParams] = useSearchParams();
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [filters, setFilters] = useState({
    category: searchParams.get('category') || '',
    search: searchParams.get('search') || '',
    minPrice: '',
    maxPrice: '',
    sort: 'created_at'
  });
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    fetchCategories();
  }, []);

  useEffect(() => {
    fetchProducts();
  }, [filters]);

  const fetchCategories = async () => {
    try {
      const { data } = await axios.get(`${API_URL}/api/categories`);
      setCategories(data);
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  };

  const fetchProducts = async () => {
    try {
      const params = new URLSearchParams();
      if (filters.category) params.append('category', filters.category);
      if (filters.search) params.append('search', filters.search);
      if (filters.minPrice) params.append('min_price', filters.minPrice);
      if (filters.maxPrice) params.append('max_price', filters.maxPrice);
      params.append('sort', filters.sort);
      params.append('limit', '20');

      const { data } = await axios.get(`${API_URL}/api/products?${params}`);
      setProducts(data);
    } catch (error) {
      toast.error('Failed to load products');
    }
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA]" data-testid="products-page">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl md:text-3xl lg:text-4xl tracking-tight font-bold text-[#111827]" style={{ fontFamily: 'Manrope, sans-serif' }}>
            Products
          </h1>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center space-x-2 px-4 py-2 border border-gray-300 bg-white hover:bg-gray-50 rounded-md transition-all"
            data-testid="toggle-filters-button"
          >
            <Faders size={20} />
            <span className="font-semibold">Filters</span>
          </button>
        </div>

        {showFilters && (
          <div className="bg-white p-6 rounded-lg border border-gray-200 mb-6" data-testid="filters-panel">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-semibold text-[#111827] mb-2">Category</label>
                <select
                  value={filters.category}
                  onChange={(e) => setFilters({ ...filters, category: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#0052FF]"
                  data-testid="category-filter"
                >
                  <option value="">All Categories</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-[#111827] mb-2">Min Price</label>
                <input
                  type="number"
                  value={filters.minPrice}
                  onChange={(e) => setFilters({ ...filters, minPrice: e.target.value })}
                  placeholder="0"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#0052FF]"
                  data-testid="min-price-filter"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-[#111827] mb-2">Max Price</label>
                <input
                  type="number"
                  value={filters.maxPrice}
                  onChange={(e) => setFilters({ ...filters, maxPrice: e.target.value })}
                  placeholder="999999"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#0052FF]"
                  data-testid="max-price-filter"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-[#111827] mb-2">Sort By</label>
                <select
                  value={filters.sort}
                  onChange={(e) => setFilters({ ...filters, sort: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#0052FF]"
                  data-testid="sort-filter"
                >
                  <option value="created_at">Latest</option>
                  <option value="price">Price</option>
                  <option value="name">Name</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {products.length === 0 ? (
          <div className="text-center py-20" data-testid="no-products">
            <p className="text-xl text-[#4B5563]">No products found</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6" data-testid="products-grid">
            {products.map((product) => (
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
        )}
      </div>
    </div>
  );
};

export default Products;
