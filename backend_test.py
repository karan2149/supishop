#!/usr/bin/env python3

import requests
import sys
import json
from datetime import datetime

class ECommerceAPITester:
    def __init__(self, base_url="https://java-ecommerce-hub-1.preview.emergentagent.com"):
        self.base_url = base_url
        self.session = requests.Session()
        self.admin_token = None
        self.user_token = None
        self.tests_run = 0
        self.tests_passed = 0
        self.product_id = None
        self.cart_item_id = None
        self.order_id = None

    def log_test(self, name, success, details=""):
        """Log test results"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
            print(f"✅ {name} - PASSED {details}")
        else:
            print(f"❌ {name} - FAILED {details}")

    def make_request(self, method, endpoint, data=None, use_admin=False, use_user=False):
        """Make HTTP request with proper headers"""
        url = f"{self.base_url}/api/{endpoint}"
        headers = {'Content-Type': 'application/json'}
        
        # For httpOnly cookies, we need to use the session cookies
        # The tokens are stored in cookies, not as Bearer tokens
        
        try:
            if method == 'GET':
                response = self.session.get(url, headers=headers)
            elif method == 'POST':
                response = self.session.post(url, json=data, headers=headers)
            elif method == 'PUT':
                response = self.session.put(url, json=data, headers=headers)
            elif method == 'DELETE':
                response = self.session.delete(url, headers=headers)
            
            return response
        except Exception as e:
            print(f"Request failed: {str(e)}")
            return None

    def test_admin_login(self):
        """Test admin login"""
        print("\n🔐 Testing Admin Authentication...")
        
        response = self.make_request('POST', 'auth/login', {
            "email": "admin@fcommerce.com",
            "password": "admin123"
        })
        
        if response and response.status_code == 200:
            data = response.json()
            if data.get('role') == 'admin':
                # Extract token from cookies if using httpOnly cookies
                cookies = response.cookies
                if 'access_token' in cookies:
                    self.admin_token = cookies['access_token']
                self.log_test("Admin Login", True, f"- Role: {data.get('role')}")
                return True
            else:
                self.log_test("Admin Login", False, f"- Wrong role: {data.get('role')}")
        else:
            self.log_test("Admin Login", False, f"- Status: {response.status_code if response else 'No response'}")
        return False

    def test_user_registration(self):
        """Test user registration"""
        print("\n👤 Testing User Registration...")
        
        timestamp = datetime.now().strftime("%H%M%S")
        test_user = {
            "email": f"testuser{timestamp}@test.com",
            "password": "testpass123",
            "name": f"Test User {timestamp}",
            "phone": "9876543210"
        }
        
        response = self.make_request('POST', 'auth/register', test_user)
        
        if response and response.status_code == 200:
            data = response.json()
            if data.get('email') == test_user['email']:
                # Extract token from cookies
                cookies = response.cookies
                if 'access_token' in cookies:
                    self.user_token = cookies['access_token']
                self.log_test("User Registration", True, f"- Email: {data.get('email')}")
                return True
        
        self.log_test("User Registration", False, f"- Status: {response.status_code if response else 'No response'}")
        return False

    def test_products_api(self):
        """Test products API endpoints"""
        print("\n📦 Testing Products API...")
        
        # Test GET /api/products
        response = self.make_request('GET', 'products')
        if response and response.status_code == 200:
            products = response.json()
            if isinstance(products, list) and len(products) > 0:
                self.product_id = products[0]['id']
                self.log_test("GET /api/products", True, f"- Found {len(products)} products")
            else:
                self.log_test("GET /api/products", False, "- No products found")
                return False
        else:
            self.log_test("GET /api/products", False, f"- Status: {response.status_code if response else 'No response'}")
            return False
        
        # Test GET /api/products/{id}
        if self.product_id:
            response = self.make_request('GET', f'products/{self.product_id}')
            if response and response.status_code == 200:
                product = response.json()
                if product.get('id') == self.product_id:
                    self.log_test("GET /api/products/{id}", True, f"- Product: {product.get('name')}")
                else:
                    self.log_test("GET /api/products/{id}", False, "- Product ID mismatch")
            else:
                self.log_test("GET /api/products/{id}", False, f"- Status: {response.status_code if response else 'No response'}")
        
        return True

    def test_categories_api(self):
        """Test categories API"""
        print("\n🏷️ Testing Categories API...")
        
        response = self.make_request('GET', 'categories')
        if response and response.status_code == 200:
            categories = response.json()
            if isinstance(categories, list) and len(categories) > 0:
                self.log_test("GET /api/categories", True, f"- Found {len(categories)} categories")
                return True
            else:
                self.log_test("GET /api/categories", False, "- No categories found")
        else:
            self.log_test("GET /api/categories", False, f"- Status: {response.status_code if response else 'No response'}")
        return False

    def test_cart_operations(self):
        """Test cart operations"""
        print("\n🛒 Testing Cart Operations...")
        
        if not self.user_token or not self.product_id:
            self.log_test("Cart Operations", False, "- Missing user token or product ID")
            return False
        
        # Test POST /api/cart (Add to cart)
        response = self.make_request('POST', 'cart', {
            "product_id": self.product_id,
            "quantity": 2
        }, use_user=True)
        
        if response and response.status_code == 200:
            cart_item = response.json()
            self.cart_item_id = cart_item.get('id')
            self.log_test("POST /api/cart", True, f"- Added product to cart")
        else:
            self.log_test("POST /api/cart", False, f"- Status: {response.status_code if response else 'No response'}")
            return False
        
        # Test GET /api/cart
        response = self.make_request('GET', 'cart', use_user=True)
        if response and response.status_code == 200:
            cart_items = response.json()
            if isinstance(cart_items, list) and len(cart_items) > 0:
                self.log_test("GET /api/cart", True, f"- Found {len(cart_items)} items")
            else:
                self.log_test("GET /api/cart", False, "- Empty cart")
        else:
            self.log_test("GET /api/cart", False, f"- Status: {response.status_code if response else 'No response'}")
        
        # Test PUT /api/cart/{id} (Update quantity)
        if self.cart_item_id:
            response = self.make_request('PUT', f'cart/{self.cart_item_id}?quantity=3', use_user=True)
            if response and response.status_code == 200:
                self.log_test("PUT /api/cart/{id}", True, "- Updated quantity")
            else:
                self.log_test("PUT /api/cart/{id}", False, f"- Status: {response.status_code if response else 'No response'}")
        
        return True

    def test_wishlist_operations(self):
        """Test wishlist operations"""
        print("\n❤️ Testing Wishlist Operations...")
        
        if not self.user_token or not self.product_id:
            self.log_test("Wishlist Operations", False, "- Missing user token or product ID")
            return False
        
        # Test POST /api/wishlist/{product_id}
        response = self.make_request('POST', f'wishlist/{self.product_id}', use_user=True)
        if response and response.status_code == 200:
            self.log_test("POST /api/wishlist/{product_id}", True, "- Added to wishlist")
        else:
            self.log_test("POST /api/wishlist/{product_id}", False, f"- Status: {response.status_code if response else 'No response'}")
        
        # Test GET /api/wishlist
        response = self.make_request('GET', 'wishlist', use_user=True)
        if response and response.status_code == 200:
            wishlist = response.json()
            if isinstance(wishlist, list):
                self.log_test("GET /api/wishlist", True, f"- Found {len(wishlist)} items")
            else:
                self.log_test("GET /api/wishlist", False, "- Invalid response format")
        else:
            self.log_test("GET /api/wishlist", False, f"- Status: {response.status_code if response else 'No response'}")
        
        # Test DELETE /api/wishlist/{product_id}
        response = self.make_request('DELETE', f'wishlist/{self.product_id}', use_user=True)
        if response and response.status_code == 200:
            self.log_test("DELETE /api/wishlist/{product_id}", True, "- Removed from wishlist")
        else:
            self.log_test("DELETE /api/wishlist/{product_id}", False, f"- Status: {response.status_code if response else 'No response'}")
        
        return True

    def test_order_operations(self):
        """Test order operations"""
        print("\n📋 Testing Order Operations...")
        
        if not self.user_token or not self.product_id:
            self.log_test("Order Operations", False, "- Missing user token or product ID")
            return False
        
        # Test POST /api/orders
        order_data = {
            "items": [
                {
                    "product_id": self.product_id,
                    "quantity": 1
                }
            ],
            "shipping_address": {
                "name": "Test User",
                "address": "123 Test Street",
                "city": "Test City",
                "state": "Test State",
                "pincode": "123456",
                "phone": "9876543210"
            },
            "payment_method": "razorpay"
        }
        
        response = self.make_request('POST', 'orders', order_data, use_user=True)
        if response and response.status_code == 200:
            order = response.json()
            self.order_id = order.get('id')
            self.log_test("POST /api/orders", True, f"- Order created: {self.order_id}")
        else:
            self.log_test("POST /api/orders", False, f"- Status: {response.status_code if response else 'No response'}")
            return False
        
        # Test GET /api/orders
        response = self.make_request('GET', 'orders', use_user=True)
        if response and response.status_code == 200:
            orders = response.json()
            if isinstance(orders, list):
                self.log_test("GET /api/orders", True, f"- Found {len(orders)} orders")
            else:
                self.log_test("GET /api/orders", False, "- Invalid response format")
        else:
            self.log_test("GET /api/orders", False, f"- Status: {response.status_code if response else 'No response'}")
        
        return True

    def test_admin_operations(self):
        """Test admin operations"""
        print("\n👑 Testing Admin Operations...")
        
        # Need to login as admin again to get fresh session
        admin_response = self.make_request('POST', 'auth/login', {
            "email": "admin@fcommerce.com",
            "password": "admin123"
        })
        
        if not admin_response or admin_response.status_code != 200:
            self.log_test("Admin Operations", False, "- Failed to login as admin")
            return False
        
        # Test GET /api/admin/stats
        response = self.make_request('GET', 'admin/stats')
        if response and response.status_code == 200:
            stats = response.json()
            if 'total_users' in stats and 'total_products' in stats:
                self.log_test("GET /api/admin/stats", True, f"- Users: {stats.get('total_users')}, Products: {stats.get('total_products')}")
            else:
                self.log_test("GET /api/admin/stats", False, "- Missing required stats")
        else:
            self.log_test("GET /api/admin/stats", False, f"- Status: {response.status_code if response else 'No response'}")
        
        # Test GET /api/admin/orders
        response = self.make_request('GET', 'admin/orders')
        if response and response.status_code == 200:
            orders = response.json()
            if isinstance(orders, list):
                self.log_test("GET /api/admin/orders", True, f"- Found {len(orders)} orders")
            else:
                self.log_test("GET /api/admin/orders", False, "- Invalid response format")
        else:
            self.log_test("GET /api/admin/orders", False, f"- Status: {response.status_code if response else 'No response'}")
        
        return True

    def run_all_tests(self):
        """Run all API tests"""
        print("🚀 Starting E-Commerce API Tests...")
        print(f"Base URL: {self.base_url}")
        
        # Authentication tests
        admin_login_success = self.test_admin_login()
        user_reg_success = self.test_user_registration()
        
        # Core API tests
        products_success = self.test_products_api()
        categories_success = self.test_categories_api()
        
        # User operations (require authentication)
        cart_success = self.test_cart_operations() if user_reg_success else False
        wishlist_success = self.test_wishlist_operations() if user_reg_success else False
        order_success = self.test_order_operations() if user_reg_success else False
        
        # Admin operations (require admin auth)
        admin_success = self.test_admin_operations()
        
        # Print summary
        print(f"\n📊 Test Summary:")
        print(f"Tests Run: {self.tests_run}")
        print(f"Tests Passed: {self.tests_passed}")
        print(f"Success Rate: {(self.tests_passed/self.tests_run*100):.1f}%")
        
        return self.tests_passed == self.tests_run

def main():
    tester = ECommerceAPITester()
    success = tester.run_all_tests()
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())