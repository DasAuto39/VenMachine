from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
from typing import Optional
from database import DatabasePool
from queries import (
    get_available_items,
    dispense_item,
    get_all_items,
    create_item,
    update_item,
    delete_item,
    get_transaction_logs,
    create_transaction,
    process_payment,
    get_transaction_status,
    get_all_transactions,
    register_user,
    login_user
)

app = FastAPI(title="Smart Storage API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Skema data (Pydantic Models) untuk Request Body
class DispenseRequest(BaseModel):
    item_id: int
    requested_qty: int = 1

class HardwareStatus(BaseModel):
    transaction_id: int
    status: str  # "SUCCESS" atau "FAILED"

class CheckoutRequest(BaseModel):
    gate_id: int
    items_cart: dict  # {item_id: {item, qty}}
    user_id: Optional[int] = None  # Optional for guest checkout

class PaymentRequest(BaseModel):
    transaction_id: int
    payment_method: str  # CASH, QRIS, TRANSFER, CARD

class RegisterRequest(BaseModel):
    username: str
    email: str
    password: str
    full_name: str
    phone: Optional[str] = None

class LoginRequest(BaseModel):
    username: str
    password: str

class ItemCreate(BaseModel):
    name: str
    sku: str
    price: float
    stock_quantity: int
    location_id: int
    description: str = None
    image_url: str = None

class ItemUpdate(BaseModel):
    name: str = None
    sku: str = None
    price: float = None
    stock_quantity: int = None
    location_id: int = None
    description: str = None
    image_url: str = None

# Mengelola koneksi database saat server menyala/mati
@app.on_event("startup")
async def startup():
    await DatabasePool.init()

@app.on_event("shutdown")
async def shutdown():
    await DatabasePool.close()

# ===== AUTHENTICATION ENDPOINTS =====

# Endpoint: User Registration
@app.post("/api/register")
async def register_endpoint(req: RegisterRequest):
    """Register new user account"""
    return await register_user(req.username, req.email, req.password, req.full_name, req.phone)

# Endpoint: User Login
@app.post("/api/login")
async def login_endpoint(req: LoginRequest):
    """Login user with username and password"""
    return await login_user(req.username, req.password)

# Endpoint 1: Mengambil katalog barang untuk UI React
@app.get("/api/items")
async def get_items():
    """Get semua barang yang tersedia (stok > 0)"""
    return await get_available_items()

# ===== PAYMENT GATEWAY ENDPOINTS =====

# Endpoint 1: Create transaction (step 1 - customer checkout)
@app.post("/api/checkout")
async def checkout_endpoint(req: CheckoutRequest):
    """Create transaction - customer siap bayar"""
    return await create_transaction(req.gate_id, req.items_cart, req.user_id)

# Endpoint 2: Process payment (step 2 - customer bayar)
@app.post("/api/payment")
async def process_payment_endpoint(req: PaymentRequest):
    """Process payment untuk transaction"""
    return await process_payment(req.transaction_id, req.payment_method)

# Endpoint 3: Get transaction status
@app.get("/api/transaction/{transaction_id}")
async def get_transaction_status_endpoint(transaction_id: int):
    """Get transaction and payment status"""
    return await get_transaction_status(transaction_id)

# Endpoint 2: Menerima request pengambilan barang (Dari UI atau LLM)
@app.post("/api/dispense")
async def dispense_item_endpoint(req: DispenseRequest):
    """Decrement stock saat user checkout"""
    return await dispense_item(req.item_id, req.requested_qty)

# Endpoint 3: Webhook untuk menerima laporan dari Hardware
@app.post("/api/hardware-status")
async def update_hardware_status(payload: HardwareStatus):
    # Saat sensor mendeteksi barang jatuh, mesin menembak endpoin   t ini
    # Di sini status log di database akan diubah menjadi 'SUCCESS'
    
    return {
        "message": f"Transaksi {payload.transaction_id} berhasil dikonfirmasi oleh mesin."
    }

# ===== ADMIN ENDPOINTS (Product Management) =====

# Endpoint 4: Get all items (admin - termasuk stok 0)
@app.get("/api/admin/items")
async def get_all_items_endpoint():
    """Get all items including stock 0"""
    return await get_all_items()

# Endpoint 5: Create new item
@app.post("/api/admin/items")
async def create_item_endpoint(item: ItemCreate):
    """Create a new item"""
    return await create_item(item.name, item.sku, item.price, item.stock_quantity, item.location_id, item.description, item.image_url)

# Endpoint 6: Update item
@app.put("/api/admin/items/{item_id}")
async def update_item_endpoint(item_id: int, item: ItemUpdate):
    """Update an item"""
    update_kwargs = {}
    if item.name is not None:
        update_kwargs['name'] = item.name
    if item.sku is not None:
        update_kwargs['sku'] = item.sku
    if item.price is not None:
        update_kwargs['price'] = item.price
    if item.stock_quantity is not None:
        update_kwargs['stock_quantity'] = item.stock_quantity
    if item.location_id is not None:
        update_kwargs['location_id'] = item.location_id
    if item.description is not None:
        update_kwargs['description'] = item.description
    if item.image_url is not None:
        update_kwargs['image_url'] = item.image_url
    
    return await update_item(item_id, **update_kwargs)

# Endpoint 7: Delete item
@app.delete("/api/admin/items/{item_id}")
async def delete_item_endpoint(item_id: int):
    """Delete an item"""
    return await delete_item(item_id)

# ===== ADMIN PAYMENT MANAGEMENT ENDPOINTS =====

# Endpoint: Get all transactions
@app.get("/api/admin/transactions")
async def get_transactions_endpoint(limit: int = 50):
    """Get all transactions (Admin view)"""
    return await get_all_transactions(limit)