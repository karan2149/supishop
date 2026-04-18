from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, Response, BackgroundTasks
from fastapi.responses import JSONResponse
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, EmailStr, Field, ConfigDict
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone, timedelta
from bson import ObjectId
import os
import logging
import bcrypt
import jwt
import secrets
import razorpay
import asyncio
from functools import wraps

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Razorpay client
razorpay_client = razorpay.Client(auth=(os.environ.get('RAZORPAY_KEY_ID', ''), os.environ.get('RAZORPAY_KEY_SECRET', '')))

# JWT Configuration
JWT_ALGORITHM = "HS256"
JWT_SECRET = os.environ['JWT_SECRET']

# Simple in-memory cache
product_cache = {"data": None, "timestamp": None}
CACHE_TTL = 300  # 5 minutes

# Logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Create the main app
app = FastAPI(title="F-Commerce API")
api_router = APIRouter(prefix="/api")

# ==================== Models ====================

class UserRegister(BaseModel):
    email: EmailStr
    password: str
    name: str
    phone: Optional[str] = None

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    id: str
    email: str
    name: str
    role: str
    phone: Optional[str] = None
    created_at: datetime

class CategoryCreate(BaseModel):
    name: str
    slug: str
    description: Optional[str] = None
    image_url: Optional[str] = None

class CategoryResponse(BaseModel):
    id: str
    name: str
    slug: str
    description: Optional[str] = None
    image_url: Optional[str] = None

class ProductCreate(BaseModel):
    name: str
    description: str
    price: float
    discount_price: Optional[float] = None
    images: List[str]
    category_id: str
    stock: int
    sku: str
    specifications: Optional[Dict[str, Any]] = None
    is_active: bool = True

class ProductResponse(BaseModel):
    id: str
    name: str
    description: str
    price: float
    discount_price: Optional[float] = None
    images: List[str]
    category_id: str
    stock: int
    sku: str
    specifications: Optional[Dict[str, Any]] = None
    is_active: bool
    rating: float = 0.0
    review_count: int = 0
    created_at: datetime

class CartItemCreate(BaseModel):
    product_id: str
    quantity: int = 1

class CartItemResponse(BaseModel):
    id: str
    product_id: str
    quantity: int
    product: Optional[ProductResponse] = None

class OrderCreate(BaseModel):
    items: List[Dict[str, Any]]
    shipping_address: Dict[str, str]
    payment_method: str = "razorpay"

class OrderResponse(BaseModel):
    id: str
    user_id: str
    items: List[Dict[str, Any]]
    total_amount: float
    status: str
    payment_id: Optional[str] = None
    shipping_address: Dict[str, str]
    created_at: datetime

class ReviewCreate(BaseModel):
    product_id: str
    rating: int = Field(..., ge=1, le=5)
    comment: str

class ReviewResponse(BaseModel):
    id: str
    product_id: str
    user_id: str
    user_name: str
    rating: int
    comment: str
    created_at: datetime

class RazorpayOrderCreate(BaseModel):
    amount: float
    order_id: str

class PaymentVerification(BaseModel):
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str
    order_id: str

class ForgotPasswordRequest(BaseModel):
    email: EmailStr

class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str

# ==================== Auth Utilities ====================

def hash_password(password: str) -> str:
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password.encode("utf-8"), salt)
    return hashed.decode("utf-8")

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))

def create_access_token(user_id: str, email: str) -> str:
    payload = {"sub": user_id, "email": email, "exp": datetime.now(timezone.utc) + timedelta(minutes=15), "type": "access"}
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

def create_refresh_token(user_id: str) -> str:
    payload = {"sub": user_id, "exp": datetime.now(timezone.utc) + timedelta(days=7), "type": "refresh"}
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

async def get_current_user(request: Request) -> dict:
    token = request.cookies.get("access_token")
    if not token:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:]
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "access":
            raise HTTPException(status_code=401, detail="Invalid token type")
        user = await db.users.find_one({"_id": ObjectId(payload["sub"])})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        user["_id"] = str(user["_id"])
        user.pop("password_hash", None)
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

async def get_admin_user(request: Request) -> dict:
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return user

# ==================== Background Tasks ====================

def send_order_confirmation(order_id: str, user_email: str):
    logger.info(f"Order confirmation sent to {user_email} for order {order_id}")

# ==================== Startup Events ====================

@app.on_event("startup")
async def startup_event():
    # Create indexes
    await db.users.create_index("email", unique=True)
    await db.products.create_index("category_id")
    await db.products.create_index("name")
    await db.cart_items.create_index("user_id")
    await db.orders.create_index("user_id")
    await db.reviews.create_index("product_id")
    await db.password_reset_tokens.create_index("expires_at", expireAfterSeconds=0)
    await db.login_attempts.create_index("identifier")
    
    # Seed admin user
    await seed_admin()
    
    # Seed initial data
    await seed_initial_data()
    
    logger.info("Application startup complete")

async def seed_admin():
    admin_email = os.environ.get("ADMIN_EMAIL", "admin@fcommerce.com")
    admin_password = os.environ.get("ADMIN_PASSWORD", "admin123")
    existing = await db.users.find_one({"email": admin_email})
    if existing is None:
        hashed = hash_password(admin_password)
        await db.users.insert_one({
            "email": admin_email,
            "password_hash": hashed,
            "name": "Admin",
            "role": "admin",
            "phone": None,
            "created_at": datetime.now(timezone.utc)
        })
        logger.info(f"Admin user created: {admin_email}")
    elif not verify_password(admin_password, existing["password_hash"]):
        await db.users.update_one({"email": admin_email}, {"$set": {"password_hash": hash_password(admin_password)}})
        logger.info("Admin password updated")
    
    # Write test credentials
    credentials = f"""# Test Credentials

## Admin Account
- Email: {admin_email}
- Password: {admin_password}
- Role: admin

## Test User Account
- Email: user@test.com
- Password: user123
- Role: customer

## Auth Endpoints
- POST /api/auth/register
- POST /api/auth/login
- POST /api/auth/logout
- GET /api/auth/me
- POST /api/auth/refresh
- POST /api/auth/forgot-password
- POST /api/auth/reset-password
"""
    
    os.makedirs("/app/memory", exist_ok=True)
    with open("/app/memory/test_credentials.md", "w") as f:
        f.write(credentials)

async def seed_initial_data():
    # Check if categories exist
    cat_count = await db.categories.count_documents({})
    if cat_count == 0:
        categories = [
            {"name": "Electronics", "slug": "electronics", "description": "Latest gadgets and electronics", "image_url": "https://images.unsplash.com/photo-1750055129957-6e757ce881dc?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NDk1Nzd8MHwxfHNlYXJjaHwzfHxwcmVtaXVtJTIwdGVjaCUyMGdhZGdldHMlMjBpc29sYXRlZHxlbnwwfHx8fDE3NzY1MDM5MTh8MA&ixlib=rb-4.1.0&q=85"},
            {"name": "Fashion", "slug": "fashion", "description": "Trending fashion and apparel", "image_url": "https://images.unsplash.com/photo-1610664676282-55c8de64f746?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA2OTV8MHwxfHNlYXJjaHwxfHxuaWtlJTIwcnVubmluZyUyMHNob2VzJTIwaXNvbGF0ZWR8ZW58MHx8fHwxNzc2NTAzOTM0fDA&ixlib=rb-4.1.0&q=85"},
            {"name": "Home & Living", "slug": "home-living", "description": "Home essentials and decor", "image_url": "https://images.unsplash.com/photo-1722891067479-5fd39edbfc3d?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjAzMzJ8MHwxfHNlYXJjaHwxfHxwcmVtaXVtJTIwaGVhZHBob25lcyUyMGlzb2xhdGVkfGVufDB8fHx8MTc3NjUwMzkzNHww&ixlib=rb-4.1.0&q=85"}
        ]
        result = await db.categories.insert_many(categories)
        cat_ids = result.inserted_ids
        logger.info(f"Created {len(cat_ids)} categories")
        
        # Create sample products
        products = [
            {
                "name": "Premium Smartphone X1",
                "description": "Latest flagship smartphone with cutting-edge technology, 5G support, and stunning display",
                "price": 79999,
                "discount_price": 69999,
                "images": ["https://images.unsplash.com/photo-1767978139637-fe09cbcd13fc?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA1NjZ8MHwxfHNlYXJjaHwxfHxsYXRlc3QlMjBzbWFydHBob25lJTIwaXNvbGF0ZWR8ZW58MHx8fHwxNzc2NTAzOTM0fDA&ixlib=rb-4.1.0&q=85"],
                "category_id": str(cat_ids[0]),
                "stock": 50,
                "sku": "PHONE-X1-001",
                "specifications": {"RAM": "12GB", "Storage": "256GB", "Display": "6.7 inch AMOLED", "Battery": "5000mAh"},
                "is_active": True,
                "created_at": datetime.now(timezone.utc)
            },
            {
                "name": "Ultra-Thin Laptop Pro",
                "description": "Powerful laptop for professionals with high-performance processor and graphics",
                "price": 124999,
                "discount_price": 109999,
                "images": ["https://images.unsplash.com/photo-1759297044036-19a0256fade2?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjAzMzN8MHwxfHNlYXJjaHwxfHxtb2Rlcm4lMjBsYXB0b3AlMjBmbGF0JTIwbGF5fGVufDB8fHx8MTc3NjUwMzkzNHww&ixlib=rb-4.1.0&q=85"],
                "category_id": str(cat_ids[0]),
                "stock": 30,
                "sku": "LAP-PRO-001",
                "specifications": {"Processor": "Intel i7", "RAM": "16GB", "Storage": "512GB SSD", "Display": "15.6 inch 4K"},
                "is_active": True,
                "created_at": datetime.now(timezone.utc)
            },
            {
                "name": "Wireless Noise-Cancelling Headphones",
                "description": "Premium headphones with active noise cancellation and studio-quality sound",
                "price": 24999,
                "discount_price": 19999,
                "images": ["https://images.unsplash.com/photo-1722891067479-5fd39edbfc3d?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjAzMzJ8MHwxfHNlYXJjaHwxfHxwcmVtaXVtJTIwaGVhZHBob25lcyUyMGlzb2xhdGVkfGVufDB8fHx8MTc3NjUwMzkzNHww&ixlib=rb-4.1.0&q=85"],
                "category_id": str(cat_ids[0]),
                "stock": 100,
                "sku": "HEAD-ANC-001",
                "specifications": {"Battery Life": "30 hours", "Connectivity": "Bluetooth 5.0", "Weight": "250g"},
                "is_active": True,
                "created_at": datetime.now(timezone.utc)
            },
            {
                "name": "Running Shoes Pro",
                "description": "Lightweight and comfortable running shoes with advanced cushioning technology",
                "price": 8999,
                "discount_price": 6999,
                "images": ["https://images.unsplash.com/photo-1610664676282-55c8de64f746?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA2OTV8MHwxfHNlYXJjaHwxfHxuaWtlJTIwcnVubmluZyUyMHNob2VzJTIwaXNvbGF0ZWR8ZW58MHx8fHwxNzc2NTAzOTM0fDA&ixlib=rb-4.1.0&q=85"],
                "category_id": str(cat_ids[1]),
                "stock": 150,
                "sku": "SHOE-RUN-001",
                "specifications": {"Size": "UK 6-12", "Material": "Mesh & Synthetic", "Color": "Black/Orange"},
                "is_active": True,
                "created_at": datetime.now(timezone.utc)
            }
        ]
        await db.products.insert_many(products)
        logger.info(f"Created {len(products)} sample products")

# ==================== Auth Routes ====================

@api_router.post("/auth/register", response_model=UserResponse)
async def register(user_data: UserRegister, response: Response):
    email = user_data.email.lower()
    existing = await db.users.find_one({"email": email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    password_hash = hash_password(user_data.password)
    user_doc = {
        "email": email,
        "password_hash": password_hash,
        "name": user_data.name,
        "phone": user_data.phone,
        "role": "customer",
        "created_at": datetime.now(timezone.utc)
    }
    result = await db.users.insert_one(user_doc)
    user_id = str(result.inserted_id)
    
    access_token = create_access_token(user_id, email)
    refresh_token = create_refresh_token(user_id)
    
    response.set_cookie(key="access_token", value=access_token, httponly=True, secure=False, samesite="lax", max_age=900, path="/")
    response.set_cookie(key="refresh_token", value=refresh_token, httponly=True, secure=False, samesite="lax", max_age=604800, path="/")
    
    return UserResponse(
        id=user_id,
        email=email,
        name=user_data.name,
        role="customer",
        phone=user_data.phone,
        created_at=user_doc["created_at"]
    )

@api_router.post("/auth/login", response_model=UserResponse)
async def login(credentials: UserLogin, response: Response, request: Request):
    email = credentials.email.lower()
    
    # Check brute force
    identifier = f"{request.client.host}:{email}"
    attempts = await db.login_attempts.find_one({"identifier": identifier})
    if attempts and attempts.get("count", 0) >= 5:
        lockout_time = attempts.get("locked_until", datetime.now(timezone.utc))
        if lockout_time > datetime.now(timezone.utc):
            raise HTTPException(status_code=429, detail="Too many failed attempts. Try again later.")
    
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(credentials.password, user["password_hash"]):
        # Increment failed attempts
        if attempts:
            count = attempts.get("count", 0) + 1
            locked_until = datetime.now(timezone.utc) + timedelta(minutes=15) if count >= 5 else None
            await db.login_attempts.update_one(
                {"identifier": identifier},
                {"$set": {"count": count, "locked_until": locked_until, "last_attempt": datetime.now(timezone.utc)}}
            )
        else:
            await db.login_attempts.insert_one({
                "identifier": identifier,
                "count": 1,
                "last_attempt": datetime.now(timezone.utc)
            })
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    # Clear failed attempts
    await db.login_attempts.delete_one({"identifier": identifier})
    
    user_id = str(user["_id"])
    access_token = create_access_token(user_id, email)
    refresh_token = create_refresh_token(user_id)
    
    response.set_cookie(key="access_token", value=access_token, httponly=True, secure=False, samesite="lax", max_age=900, path="/")
    response.set_cookie(key="refresh_token", value=refresh_token, httponly=True, secure=False, samesite="lax", max_age=604800, path="/")
    
    return UserResponse(
        id=user_id,
        email=user["email"],
        name=user["name"],
        role=user["role"],
        phone=user.get("phone"),
        created_at=user["created_at"]
    )

@api_router.post("/auth/logout")
async def logout(response: Response):
    response.delete_cookie("access_token", path="/")
    response.delete_cookie("refresh_token", path="/")
    return {"message": "Logged out successfully"}

@api_router.get("/auth/me", response_model=UserResponse)
async def get_me(request: Request):
    user = await get_current_user(request)
    return UserResponse(
        id=user["_id"],
        email=user["email"],
        name=user["name"],
        role=user["role"],
        phone=user.get("phone"),
        created_at=user["created_at"]
    )

@api_router.post("/auth/refresh")
async def refresh_token(request: Request, response: Response):
    token = request.cookies.get("refresh_token")
    if not token:
        raise HTTPException(status_code=401, detail="Refresh token not found")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "refresh":
            raise HTTPException(status_code=401, detail="Invalid token type")
        
        user = await db.users.find_one({"_id": ObjectId(payload["sub"])})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        
        user_id = str(user["_id"])
        access_token = create_access_token(user_id, user["email"])
        response.set_cookie(key="access_token", value=access_token, httponly=True, secure=False, samesite="lax", max_age=900, path="/")
        
        return {"message": "Token refreshed"}
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Refresh token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid refresh token")

@api_router.post("/auth/forgot-password")
async def forgot_password(request_data: ForgotPasswordRequest):
    email = request_data.email.lower()
    user = await db.users.find_one({"email": email})
    if not user:
        return {"message": "If the email exists, a reset link has been sent"}
    
    token = secrets.token_urlsafe(32)
    expires_at = datetime.now(timezone.utc) + timedelta(hours=1)
    
    await db.password_reset_tokens.insert_one({
        "token": token,
        "user_id": str(user["_id"]),
        "expires_at": expires_at,
        "used": False
    })
    
    reset_link = f"https://java-ecommerce-hub-1.preview.emergentagent.com/reset-password?token={token}"
    logger.info(f"Password reset link for {email}: {reset_link}")
    
    return {"message": "If the email exists, a reset link has been sent"}

@api_router.post("/auth/reset-password")
async def reset_password(request_data: ResetPasswordRequest):
    token_doc = await db.password_reset_tokens.find_one({"token": request_data.token})
    if not token_doc or token_doc.get("used") or token_doc.get("expires_at") < datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="Invalid or expired token")
    
    new_hash = hash_password(request_data.new_password)
    await db.users.update_one(
        {"_id": ObjectId(token_doc["user_id"])},
        {"$set": {"password_hash": new_hash}}
    )
    
    await db.password_reset_tokens.update_one(
        {"token": request_data.token},
        {"$set": {"used": True}}
    )
    
    return {"message": "Password reset successful"}

# ==================== Category Routes ====================

@api_router.get("/categories", response_model=List[CategoryResponse])
async def get_categories():
    categories = await db.categories.find({}, {"_id": 0}).to_list(100)
    result = []
    async for cat in db.categories.find():
        result.append(CategoryResponse(
            id=str(cat["_id"]),
            name=cat["name"],
            slug=cat["slug"],
            description=cat.get("description"),
            image_url=cat.get("image_url")
        ))
    return result

@api_router.post("/categories", response_model=CategoryResponse)
async def create_category(category: CategoryCreate, request: Request):
    await get_admin_user(request)
    cat_doc = category.model_dump()
    result = await db.categories.insert_one(cat_doc)
    return CategoryResponse(id=str(result.inserted_id), **cat_doc)

# ==================== Product Routes ====================

@api_router.get("/products", response_model=List[ProductResponse])
async def get_products(
    category: Optional[str] = None,
    search: Optional[str] = None,
    min_price: Optional[float] = None,
    max_price: Optional[float] = None,
    sort: Optional[str] = "created_at",
    limit: int = 20,
    skip: int = 0
):
    # Check cache
    cache_key = f"{category}_{search}_{min_price}_{max_price}_{sort}_{limit}_{skip}"
    if product_cache["data"] and product_cache["timestamp"]:
        if (datetime.now(timezone.utc) - product_cache["timestamp"]).seconds < CACHE_TTL:
            cached = product_cache["data"].get(cache_key)
            if cached:
                logger.info("Returning cached products")
                return cached
    
    query = {"is_active": True}
    if category:
        query["category_id"] = category
    if search:
        query["name"] = {"$regex": search, "$options": "i"}
    if min_price is not None:
        query["price"] = {"$gte": min_price}
    if max_price is not None:
        query.setdefault("price", {})["$lte"] = max_price
    
    sort_field = sort if sort in ["price", "created_at", "name"] else "created_at"
    products = await db.products.find(query).sort(sort_field, -1).skip(skip).limit(limit).to_list(limit)
    
    result = []
    for prod in products:
        # Get average rating
        reviews = await db.reviews.find({"product_id": str(prod["_id"])}).to_list(1000)
        avg_rating = sum(r["rating"] for r in reviews) / len(reviews) if reviews else 0.0
        
        result.append(ProductResponse(
            id=str(prod["_id"]),
            name=prod["name"],
            description=prod["description"],
            price=prod["price"],
            discount_price=prod.get("discount_price"),
            images=prod["images"],
            category_id=prod["category_id"],
            stock=prod["stock"],
            sku=prod["sku"],
            specifications=prod.get("specifications"),
            is_active=prod["is_active"],
            rating=round(avg_rating, 1),
            review_count=len(reviews),
            created_at=prod["created_at"]
        ))
    
    # Update cache
    if not product_cache["data"]:
        product_cache["data"] = {}
    product_cache["data"][cache_key] = result
    product_cache["timestamp"] = datetime.now(timezone.utc)
    
    return result

@api_router.get("/products/{product_id}", response_model=ProductResponse)
async def get_product(product_id: str):
    try:
        prod = await db.products.find_one({"_id": ObjectId(product_id)})
    except:
        raise HTTPException(status_code=404, detail="Product not found")
    
    if not prod:
        raise HTTPException(status_code=404, detail="Product not found")
    
    reviews = await db.reviews.find({"product_id": product_id}).to_list(1000)
    avg_rating = sum(r["rating"] for r in reviews) / len(reviews) if reviews else 0.0
    
    return ProductResponse(
        id=str(prod["_id"]),
        name=prod["name"],
        description=prod["description"],
        price=prod["price"],
        discount_price=prod.get("discount_price"),
        images=prod["images"],
        category_id=prod["category_id"],
        stock=prod["stock"],
        sku=prod["sku"],
        specifications=prod.get("specifications"),
        is_active=prod["is_active"],
        rating=round(avg_rating, 1),
        review_count=len(reviews),
        created_at=prod["created_at"]
    )

@api_router.post("/products", response_model=ProductResponse)
async def create_product(product: ProductCreate, request: Request):
    await get_admin_user(request)
    prod_doc = product.model_dump()
    prod_doc["created_at"] = datetime.now(timezone.utc)
    result = await db.products.insert_one(prod_doc)
    
    # Clear cache
    product_cache["data"] = None
    
    return ProductResponse(id=str(result.inserted_id), rating=0.0, review_count=0, **prod_doc)

@api_router.put("/products/{product_id}", response_model=ProductResponse)
async def update_product(product_id: str, product: ProductCreate, request: Request):
    await get_admin_user(request)
    try:
        prod_doc = product.model_dump()
        await db.products.update_one({"_id": ObjectId(product_id)}, {"$set": prod_doc})
        product_cache["data"] = None
        return await get_product(product_id)
    except:
        raise HTTPException(status_code=404, detail="Product not found")

@api_router.delete("/products/{product_id}")
async def delete_product(product_id: str, request: Request):
    await get_admin_user(request)
    try:
        await db.products.update_one({"_id": ObjectId(product_id)}, {"$set": {"is_active": False}})
        product_cache["data"] = None
        return {"message": "Product deleted"}
    except:
        raise HTTPException(status_code=404, detail="Product not found")

# ==================== Cart Routes ====================

@api_router.get("/cart", response_model=List[CartItemResponse])
async def get_cart(request: Request):
    user = await get_current_user(request)
    cart_items = await db.cart_items.find({"user_id": user["_id"]}).to_list(100)
    
    result = []
    for item in cart_items:
        prod = await db.products.find_one({"_id": ObjectId(item["product_id"])})
        prod_response = None
        if prod:
            reviews = await db.reviews.find({"product_id": str(prod["_id"])}).to_list(1000)
            avg_rating = sum(r["rating"] for r in reviews) / len(reviews) if reviews else 0.0
            prod_response = ProductResponse(
                id=str(prod["_id"]),
                name=prod["name"],
                description=prod["description"],
                price=prod["price"],
                discount_price=prod.get("discount_price"),
                images=prod["images"],
                category_id=prod["category_id"],
                stock=prod["stock"],
                sku=prod["sku"],
                specifications=prod.get("specifications"),
                is_active=prod["is_active"],
                rating=round(avg_rating, 1),
                review_count=len(reviews),
                created_at=prod["created_at"]
            )
        
        result.append(CartItemResponse(
            id=str(item["_id"]),
            product_id=item["product_id"],
            quantity=item["quantity"],
            product=prod_response
        ))
    
    return result

@api_router.post("/cart", response_model=CartItemResponse)
async def add_to_cart(item: CartItemCreate, request: Request):
    user = await get_current_user(request)
    
    # Check if product exists and has stock
    try:
        prod = await db.products.find_one({"_id": ObjectId(item.product_id)})
    except:
        raise HTTPException(status_code=404, detail="Product not found")
    
    if not prod or not prod["is_active"]:
        raise HTTPException(status_code=404, detail="Product not found")
    if prod["stock"] < item.quantity:
        raise HTTPException(status_code=400, detail="Insufficient stock")
    
    # Check if item already in cart
    existing = await db.cart_items.find_one({"user_id": user["_id"], "product_id": item.product_id})
    if existing:
        new_qty = existing["quantity"] + item.quantity
        if prod["stock"] < new_qty:
            raise HTTPException(status_code=400, detail="Insufficient stock")
        await db.cart_items.update_one(
            {"_id": existing["_id"]},
            {"$set": {"quantity": new_qty}}
        )
        return CartItemResponse(id=str(existing["_id"]), product_id=item.product_id, quantity=new_qty)
    
    cart_doc = {
        "user_id": user["_id"],
        "product_id": item.product_id,
        "quantity": item.quantity,
        "added_at": datetime.now(timezone.utc)
    }
    result = await db.cart_items.insert_one(cart_doc)
    return CartItemResponse(id=str(result.inserted_id), product_id=item.product_id, quantity=item.quantity)

@api_router.put("/cart/{item_id}")
async def update_cart_item(item_id: str, quantity: int, request: Request):
    user = await get_current_user(request)
    try:
        item = await db.cart_items.find_one({"_id": ObjectId(item_id), "user_id": user["_id"]})
        if not item:
            raise HTTPException(status_code=404, detail="Cart item not found")
        
        prod = await db.products.find_one({"_id": ObjectId(item["product_id"])})
        if prod["stock"] < quantity:
            raise HTTPException(status_code=400, detail="Insufficient stock")
        
        await db.cart_items.update_one({"_id": ObjectId(item_id)}, {"$set": {"quantity": quantity}})
        return {"message": "Cart updated"}
    except:
        raise HTTPException(status_code=404, detail="Cart item not found")

@api_router.delete("/cart/{item_id}")
async def remove_from_cart(item_id: str, request: Request):
    user = await get_current_user(request)
    try:
        await db.cart_items.delete_one({"_id": ObjectId(item_id), "user_id": user["_id"]})
        return {"message": "Item removed from cart"}
    except:
        raise HTTPException(status_code=404, detail="Cart item not found")

# ==================== Wishlist Routes ====================

@api_router.get("/wishlist")
async def get_wishlist(request: Request):
    user = await get_current_user(request)
    wishlist = await db.wishlists.find({"user_id": user["_id"]}).to_list(100)
    
    result = []
    for item in wishlist:
        prod = await db.products.find_one({"_id": ObjectId(item["product_id"])})
        if prod:
            reviews = await db.reviews.find({"product_id": str(prod["_id"])}).to_list(1000)
            avg_rating = sum(r["rating"] for r in reviews) / len(reviews) if reviews else 0.0
            result.append(ProductResponse(
                id=str(prod["_id"]),
                name=prod["name"],
                description=prod["description"],
                price=prod["price"],
                discount_price=prod.get("discount_price"),
                images=prod["images"],
                category_id=prod["category_id"],
                stock=prod["stock"],
                sku=prod["sku"],
                specifications=prod.get("specifications"),
                is_active=prod["is_active"],
                rating=round(avg_rating, 1),
                review_count=len(reviews),
                created_at=prod["created_at"]
            ))
    
    return result

@api_router.post("/wishlist/{product_id}")
async def add_to_wishlist(product_id: str, request: Request):
    user = await get_current_user(request)
    
    existing = await db.wishlists.find_one({"user_id": user["_id"], "product_id": product_id})
    if existing:
        return {"message": "Product already in wishlist"}
    
    await db.wishlists.insert_one({
        "user_id": user["_id"],
        "product_id": product_id,
        "added_at": datetime.now(timezone.utc)
    })
    return {"message": "Added to wishlist"}

@api_router.delete("/wishlist/{product_id}")
async def remove_from_wishlist(product_id: str, request: Request):
    user = await get_current_user(request)
    await db.wishlists.delete_one({"user_id": user["_id"], "product_id": product_id})
    return {"message": "Removed from wishlist"}

# ==================== Order Routes ====================

@api_router.get("/orders", response_model=List[OrderResponse])
async def get_orders(request: Request):
    user = await get_current_user(request)
    orders = await db.orders.find({"user_id": user["_id"]}).sort("created_at", -1).to_list(100)
    
    result = []
    for order in orders:
        result.append(OrderResponse(
            id=str(order["_id"]),
            user_id=order["user_id"],
            items=order["items"],
            total_amount=order["total_amount"],
            status=order["status"],
            payment_id=order.get("payment_id"),
            shipping_address=order["shipping_address"],
            created_at=order["created_at"]
        ))
    
    return result

@api_router.get("/orders/{order_id}", response_model=OrderResponse)
async def get_order(order_id: str, request: Request):
    user = await get_current_user(request)
    try:
        order = await db.orders.find_one({"_id": ObjectId(order_id), "user_id": user["_id"]})
        if not order:
            raise HTTPException(status_code=404, detail="Order not found")
        
        return OrderResponse(
            id=str(order["_id"]),
            user_id=order["user_id"],
            items=order["items"],
            total_amount=order["total_amount"],
            status=order["status"],
            payment_id=order.get("payment_id"),
            shipping_address=order["shipping_address"],
            created_at=order["created_at"]
        )
    except:
        raise HTTPException(status_code=404, detail="Order not found")

@api_router.post("/orders", response_model=OrderResponse)
async def create_order(order_data: OrderCreate, request: Request, background_tasks: BackgroundTasks):
    user = await get_current_user(request)
    
    # Calculate total and validate stock
    total = 0
    for item in order_data.items:
        prod = await db.products.find_one({"_id": ObjectId(item["product_id"])})
        if not prod or not prod["is_active"]:
            raise HTTPException(status_code=400, detail=f"Product {item['product_id']} not found")
        if prod["stock"] < item["quantity"]:
            raise HTTPException(status_code=400, detail=f"Insufficient stock for {prod['name']}")
        
        price = prod.get("discount_price", prod["price"])
        total += price * item["quantity"]
    
    order_doc = {
        "user_id": user["_id"],
        "items": order_data.items,
        "total_amount": total,
        "status": "pending",
        "shipping_address": order_data.shipping_address,
        "created_at": datetime.now(timezone.utc)
    }
    result = await db.orders.insert_one(order_doc)
    order_id = str(result.inserted_id)
    
    # Clear cart
    await db.cart_items.delete_many({"user_id": user["_id"]})
    
    # Background task for notification
    background_tasks.add_task(send_order_confirmation, order_id, user["email"])
    
    return OrderResponse(
        id=order_id,
        user_id=user["_id"],
        items=order_data.items,
        total_amount=total,
        status="pending",
        shipping_address=order_data.shipping_address,
        created_at=order_doc["created_at"]
    )

# ==================== Payment Routes ====================

@api_router.post("/payments/create-order")
async def create_razorpay_order(order_data: RazorpayOrderCreate, request: Request):
    await get_current_user(request)
    
    try:
        razorpay_order = razorpay_client.order.create({
            "amount": int(order_data.amount * 100),  # Convert to paise
            "currency": "INR",
            "payment_capture": 1
        })
        
        await db.payment_transactions.insert_one({
            "order_id": order_data.order_id,
            "razorpay_order_id": razorpay_order["id"],
            "amount": order_data.amount,
            "status": "created",
            "created_at": datetime.now(timezone.utc)
        })
        
        return {
            "razorpay_order_id": razorpay_order["id"],
            "amount": razorpay_order["amount"],
            "currency": razorpay_order["currency"],
            "key_id": os.environ.get('RAZORPAY_KEY_ID', '')
        }
    except Exception as e:
        logger.error(f"Razorpay order creation failed: {str(e)}")
        raise HTTPException(status_code=500, detail="Payment order creation failed")

@api_router.post("/payments/verify")
async def verify_payment(payment_data: PaymentVerification, request: Request):
    user = await get_current_user(request)
    
    try:
        # Verify signature
        razorpay_client.utility.verify_payment_signature({
            "razorpay_order_id": payment_data.razorpay_order_id,
            "razorpay_payment_id": payment_data.razorpay_payment_id,
            "razorpay_signature": payment_data.razorpay_signature
        })
        
        # Update order status
        await db.orders.update_one(
            {"_id": ObjectId(payment_data.order_id)},
            {"$set": {"status": "paid", "payment_id": payment_data.razorpay_payment_id}}
        )
        
        # Update payment transaction
        await db.payment_transactions.update_one(
            {"razorpay_order_id": payment_data.razorpay_order_id},
            {"$set": {"razorpay_payment_id": payment_data.razorpay_payment_id, "status": "success"}}
        )
        
        # Reduce stock
        order = await db.orders.find_one({"_id": ObjectId(payment_data.order_id)})
        for item in order["items"]:
            await db.products.update_one(
                {"_id": ObjectId(item["product_id"])},
                {"$inc": {"stock": -item["quantity"]}}
            )
        
        return {"message": "Payment verified successfully", "status": "success"}
    except Exception as e:
        logger.error(f"Payment verification failed: {str(e)}")
        await db.orders.update_one(
            {"_id": ObjectId(payment_data.order_id)},
            {"$set": {"status": "failed"}}
        )
        raise HTTPException(status_code=400, detail="Payment verification failed")

# ==================== Review Routes ====================

@api_router.get("/reviews/{product_id}", response_model=List[ReviewResponse])
async def get_reviews(product_id: str):
    reviews = await db.reviews.find({"product_id": product_id}).sort("created_at", -1).to_list(100)
    
    result = []
    for review in reviews:
        user = await db.users.find_one({"_id": ObjectId(review["user_id"])})
        result.append(ReviewResponse(
            id=str(review["_id"]),
            product_id=review["product_id"],
            user_id=review["user_id"],
            user_name=user["name"] if user else "Anonymous",
            rating=review["rating"],
            comment=review["comment"],
            created_at=review["created_at"]
        ))
    
    return result

@api_router.post("/reviews", response_model=ReviewResponse)
async def create_review(review: ReviewCreate, request: Request):
    user = await get_current_user(request)
    
    # Check if user has ordered this product
    order = await db.orders.find_one({
        "user_id": user["_id"],
        "status": "paid",
        "items.product_id": review.product_id
    })
    if not order:
        raise HTTPException(status_code=400, detail="You can only review products you've purchased")
    
    # Check if already reviewed
    existing = await db.reviews.find_one({"product_id": review.product_id, "user_id": user["_id"]})
    if existing:
        raise HTTPException(status_code=400, detail="You have already reviewed this product")
    
    review_doc = {
        "product_id": review.product_id,
        "user_id": user["_id"],
        "rating": review.rating,
        "comment": review.comment,
        "created_at": datetime.now(timezone.utc)
    }
    result = await db.reviews.insert_one(review_doc)
    
    return ReviewResponse(
        id=str(result.inserted_id),
        product_id=review.product_id,
        user_id=user["_id"],
        user_name=user["name"],
        rating=review.rating,
        comment=review.comment,
        created_at=review_doc["created_at"]
    )

# ==================== Admin Routes ====================

@api_router.get("/admin/stats")
async def get_admin_stats(request: Request):
    await get_admin_user(request)
    
    total_users = await db.users.count_documents({"role": "customer"})
    total_products = await db.products.count_documents({"is_active": True})
    total_orders = await db.orders.count_documents({})
    total_revenue = await db.orders.aggregate([
        {"$match": {"status": "paid"}},
        {"$group": {"_id": None, "total": {"$sum": "$total_amount"}}}
    ]).to_list(1)
    
    revenue = total_revenue[0]["total"] if total_revenue else 0
    
    # Recent orders
    recent_orders = await db.orders.find().sort("created_at", -1).limit(10).to_list(10)
    
    return {
        "total_users": total_users,
        "total_products": total_products,
        "total_orders": total_orders,
        "total_revenue": revenue,
        "recent_orders": [
            {
                "id": str(o["_id"]),
                "user_id": o["user_id"],
                "total_amount": o["total_amount"],
                "status": o["status"],
                "created_at": o["created_at"].isoformat()
            } for o in recent_orders
        ]
    }

@api_router.get("/admin/orders")
async def get_all_orders(request: Request, status: Optional[str] = None, limit: int = 50, skip: int = 0):
    await get_admin_user(request)
    
    query = {}
    if status:
        query["status"] = status
    
    orders = await db.orders.find(query).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    
    result = []
    for order in orders:
        user = await db.users.find_one({"_id": ObjectId(order["user_id"])})
        result.append({
            "id": str(order["_id"]),
            "user_id": order["user_id"],
            "user_email": user["email"] if user else "Unknown",
            "items": order["items"],
            "total_amount": order["total_amount"],
            "status": order["status"],
            "shipping_address": order["shipping_address"],
            "created_at": order["created_at"].isoformat()
        })
    
    return result

@api_router.put("/admin/orders/{order_id}/status")
async def update_order_status(order_id: str, status: str, request: Request):
    await get_admin_user(request)
    
    valid_statuses = ["pending", "paid", "processing", "shipped", "delivered", "cancelled"]
    if status not in valid_statuses:
        raise HTTPException(status_code=400, detail="Invalid status")
    
    try:
        await db.orders.update_one({"_id": ObjectId(order_id)}, {"$set": {"status": status}})
        return {"message": "Order status updated"}
    except:
        raise HTTPException(status_code=404, detail="Order not found")

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=[os.environ.get('FRONTEND_URL', 'http://localhost:3000')],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
