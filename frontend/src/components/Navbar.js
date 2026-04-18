import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { ShoppingCart, Heart, User, MagnifyingGlass, SignOut } from '@phosphor-icons/react';
import axios from 'axios';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const Navbar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [cartCount, setCartCount] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [showUserMenu, setShowUserMenu] = useState(false);

  useEffect(() => {
    if (user) {
      fetchCartCount();
    }
  }, [user]);

  const fetchCartCount = async () => {
    try {
      const { data } = await axios.get(`${API_URL}/api/cart`, { withCredentials: true });
      setCartCount(data.length);
    } catch (error) {
      console.error('Error fetching cart:', error);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/products?search=${searchQuery}`);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <nav className="sticky top-0 z-50 bg-white border-b border-gray-200" data-testid="main-navbar">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link to="/" className="flex items-center" data-testid="logo-link">
            <span className="text-2xl font-extrabold text-[#0052FF]" style={{ fontFamily: 'Manrope, sans-serif', letterSpacing: '-0.02em' }}>
              Supi<span className="text-[#111827]">shop</span>
            </span>
          </Link>

          <form onSubmit={handleSearch} className="flex-1 max-w-2xl mx-8" data-testid="search-form">
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search for products..."
                className="w-full px-4 py-2 pl-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#0052FF] focus:border-transparent"
                data-testid="search-input"
              />
              <MagnifyingGlass className="absolute left-3 top-2.5 text-gray-400" size={20} />
            </div>
          </form>

          <div className="flex items-center space-x-6">
            {user ? (
              <>
                <Link to="/wishlist" className="relative" data-testid="wishlist-link">
                  <Heart size={24} className="text-gray-700 hover:text-[#0052FF] transition-colors" />
                </Link>

                <Link to="/cart" className="relative" data-testid="cart-link">
                  <ShoppingCart size={24} className="text-gray-700 hover:text-[#0052FF] transition-colors" />
                  {cartCount > 0 && (
                    <span className="absolute -top-2 -right-2 bg-[#0052FF] text-white text-xs rounded-full h-5 w-5 flex items-center justify-center" data-testid="cart-count">
                      {cartCount}
                    </span>
                  )}
                </Link>

                <div className="relative">
                  <button
                    onClick={() => setShowUserMenu(!showUserMenu)}
                    className="flex items-center space-x-2 hover:text-[#0052FF] transition-colors"
                    data-testid="user-menu-button"
                  >
                    <User size={24} className="text-gray-700" />
                    <span className="text-sm font-semibold">{user.name}</span>
                  </button>

                  {showUserMenu && (
                    <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg border border-gray-200" data-testid="user-dropdown-menu">
                      <Link
                        to="/orders"
                        className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                        onClick={() => setShowUserMenu(false)}
                        data-testid="orders-link"
                      >
                        My Orders
                      </Link>
                      {user.role === 'admin' && (
                        <Link
                          to="/admin"
                          className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                          onClick={() => setShowUserMenu(false)}
                          data-testid="admin-link"
                        >
                          Admin Dashboard
                        </Link>
                      )}
                      <button
                        onClick={handleLogout}
                        className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-50 flex items-center space-x-2"
                        data-testid="logout-button"
                      >
                        <SignOut size={16} />
                        <span>Logout</span>
                      </button>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <Link
                to="/login"
                className="px-4 py-2 bg-[#0052FF] text-white rounded-md hover:bg-[#0040CC] transition-all font-semibold"
                data-testid="login-link"
              >
                Login
              </Link>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
