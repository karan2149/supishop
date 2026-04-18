import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'sonner';

const Login = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: '',
    phone: ''
  });
  const [loading, setLoading] = useState(false);
  const { login, register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isLogin) {
        const result = await login(formData.email, formData.password);
        if (result.success) {
          toast.success('Login successful!');
          navigate('/');
        } else {
          toast.error(result.error);
        }
      } else {
        const result = await register(formData.email, formData.password, formData.name, formData.phone);
        if (result.success) {
          toast.success('Registration successful!');
          navigate('/');
        } else {
          toast.error(result.error);
        }
      }
    } catch (error) {
      toast.error('Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] flex items-center justify-center px-4" data-testid="auth-page">
      <div className="max-w-md w-full bg-white rounded-lg shadow-sm border border-gray-200 p-8">
        <div className="text-center mb-8">
          <img
            src="https://static.prod-images.emergentagent.com/jobs/7c659ff4-129a-4b7d-b40f-0e8b9c0c2225/images/e2b24ee87f0a758a4bcbba06f7479bcb20ce378c751bbbaad3ec1cbd238f927e.png"
            alt="F-Commerce"
            className="h-12 mx-auto mb-4"
          />
          <h2 className="text-2xl md:text-3xl font-bold text-[#111827]" style={{ fontFamily: 'Manrope, sans-serif' }}>
            {isLogin ? 'Welcome Back' : 'Create Account'}
          </h2>
          <p className="text-sm text-[#4B5563] mt-2" style={{ fontFamily: 'IBM Plex Sans, sans-serif' }}>
            {isLogin ? 'Login to continue shopping' : 'Register to start shopping'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {!isLogin && (
            <div>
              <label className="block text-sm font-semibold text-[#111827] mb-1">Full Name</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#0052FF]"
                required
                data-testid="name-input"
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-semibold text-[#111827] mb-1">Email</label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#0052FF]"
              required
              data-testid="email-input"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-[#111827] mb-1">Password</label>
            <input
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#0052FF]"
              required
              data-testid="password-input"
            />
          </div>

          {!isLogin && (
            <div>
              <label className="block text-sm font-semibold text-[#111827] mb-1">Phone (Optional)</label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#0052FF]"
                data-testid="phone-input"
              />
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 bg-[#0052FF] text-white rounded-md hover:bg-[#0040CC] transition-all duration-200 font-semibold disabled:opacity-50"
            data-testid="submit-button"
          >
            {loading ? 'Processing...' : isLogin ? 'Login' : 'Register'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button
            onClick={() => setIsLogin(!isLogin)}
            className="text-sm text-[#0052FF] hover:text-[#0040CC] font-semibold"
            data-testid="toggle-auth-mode"
          >
            {isLogin ? "Don't have an account? Register" : 'Already have an account? Login'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Login;
