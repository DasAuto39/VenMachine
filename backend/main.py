from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
from typing import Optional, List, Dict
import requests
import json
import os
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
    get_user_transactions,
    get_transaction_items,
    register_user,
    login_user,
    verify_admin,
    process_restock,
    get_all_posts,
    get_published_posts,
    create_post,
    update_post,
    delete_post
)

app = FastAPI(title="Smart Storage API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
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
    role: str = 'customer'

class ChatRequest(BaseModel):
    message: str
    full_name: str
    phone: Optional[str] = None
    history: Optional[List[Dict[str, str]]] = []

class LoginRequest(BaseModel):
    username: str
    password: str

class ItemCreate(BaseModel):
    name: str
    sku: str
    category: str = 'Lainnya'
    price: float
    machine_stock: int
    warehouse_stock: int
    location_id: int
    description: str = None
    image_url: str = None

class ItemUpdate(BaseModel):
    name: str = None
    sku: str = None
    category: str = None
    price: float = None
    machine_stock: int = None
    warehouse_stock: int = None
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

# ===== AI ASSISTANT ENDPOINT =====
@app.post("/api/chat")
async def chat_endpoint(req: ChatRequest):
    """Chatbot AI Endpoint with Dynamic DB Context"""
    available_items = await get_available_items()
    
    # Format available items for the prompt
    item_list_str = "\n".join([f"- ID: {item['id']} | Name: {item['name']} | Price: Rp{item['price']} | Stock: {item['machine_stock']}" for item in available_items])
    
    system_prompt = f"""
Anda adalah Koki Ahli Masakan Indonesia untuk Smart Vending Machine.
Bantu pengguna memasak dengan bahan yang tersedia.

STOK BAHAN:
{item_list_str}

TUGAS ANDA:
1. Jika pengguna meminta saran masakan, berikan rekomendasi menu yang MASUK AKAL berdasarkan "STOK BAHAN" di atas. JANGAN menyarankan masakan aneh. Tanyakan apakah mereka ingin memasukkannya ke keranjang.
2. JIKA pengguna membalas setuju/mengonfirmasi saran Anda (contoh: "oke", "ya", "tambahkan"), Anda WAJIB merespons dengan memasukkan ID barang ke dalam array `action_items` dan mengkonfirmasi bahwa barang telah ditambahkan.
3. JIKA pengguna belum setuju/masih bertanya, `action_items` HARUS kosong [].
4. Berikan output HANYA dalam JSON valid, tanpa teks lain.

CONTOH JSON JIKA MENAWARKAN:
{{
  "message": "Untuk masakan berkuah, saya sarankan Sayur Bening dengan Bayam Segar. Mau saya tambahkan ke keranjang?",
  "action_items": []
}}
CONTOH JSON JIKA USER MENJAWAB SETUJU:
{{
  "message": "Baik, Bayam Segar (ID 2) telah ditambahkan ke keranjang Anda.",
  "action_items": [2]
}}
"""
    
    messages_payload = [{"role": "system", "content": system_prompt}]
    
    if req.history:
        for msg in req.history[-5:]: # Ambil 5 riwayat terakhir
            role = msg.get("role", "user")
            content = msg.get("content", "")
            if role == "bot": 
                role = "assistant"
                # Bungkus kembali history AI menjadi JSON agar AI tetap konsisten membalas dengan JSON
                content = json.dumps({"message": content, "action_items": []})
            messages_payload.append({"role": role, "content": content})
            
    messages_payload.append({"role": "user", "content": req.message})


    
    llm_host = os.getenv("LLM_HOST")
    
    try:
        response = requests.post(
            f"{llm_host}/api/chat",
            json={
                "model": "llama3",
                "messages": messages_payload,
                "stream": False,
                "options": {
                    "temperature": 0.6
                }
            },
            timeout=120
        )
        response.raise_for_status()
        data = response.json()
        
        raw_text = data.get("message", {}).get("content", "").strip()
        
        # Ekstrak teks yang hanya berada di antara { dan } untuk membuang percakapan basa-basi LLM
        start_idx = raw_text.find('{')
        end_idx = raw_text.rfind('}')
        
        if start_idx != -1 and end_idx != -1 and end_idx > start_idx:
            json_text = raw_text[start_idx:end_idx+1]
            parsed = json.loads(json_text)
            return parsed
        else:
            raise json.JSONDecodeError("No JSON object found", raw_text, 0)
        
    except requests.exceptions.RequestException as e:
        print("LLM Connection Error:", e)
        return {
            "message": "Maaf, asisten AI saat ini sedang offline. Silakan tambahkan barang ke keranjang secara manual.",
            "action_items": []
        }
    except json.JSONDecodeError as e:
        print("LLM JSON Parsing Error:", e, "Raw output:", raw_text)
        return {
            "message": "Maaf, saya tidak dapat memproses permintaan Anda saat ini. Silakan pilih barang secara manual.",
            "action_items": []
        }


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
    # Validate stock availability for all items in cart
    available_items = await get_all_items()  # Get current stock from database
    
    for item_id_str, cart_item in req.items_cart.items():
        item_id = int(item_id_str)
        requested_qty = cart_item['qty']
        
        # Find item in database
        db_item = next((it for it in available_items if it['id'] == item_id), None)
        
        if not db_item:
            raise HTTPException(status_code=404, detail=f"Item {item_id} tidak ditemukan")
        
        if db_item['machine_stock'] < requested_qty:
            raise HTTPException(
                status_code=400, 
                detail=f"{db_item['name']}: stok hanya {db_item['machine_stock']} buah, Anda meminta {requested_qty} buah"
            )
    
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
    return await create_item(item.name, item.sku, item.price, item.machine_stock, item.warehouse_stock, item.location_id, item.description, item.image_url, item.category)

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
    if item.machine_stock is not None:
        update_kwargs['machine_stock'] = item.machine_stock
    if item.warehouse_stock is not None:
        update_kwargs['warehouse_stock'] = item.warehouse_stock
    if item.location_id is not None:
        update_kwargs['location_id'] = item.location_id
    if item.category is not None:
        update_kwargs['category'] = item.category
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

# Endpoint: Restock Item
@app.post("/api/items/{item_id}/restock")
async def restock_item_endpoint(item_id: int):
    """Triggered when ESP32 finishes restocking to move warehouse stock to machine stock"""
    return await process_restock(item_id)

# ===== ADMIN PAYMENT MANAGEMENT ENDPOINTS =====

# Endpoint: Get all transactions
@app.get("/api/admin/transactions")
async def get_transactions_endpoint(limit: int = 50):
    """Get all transactions (Admin view)"""
    return await get_all_transactions(limit)

# Endpoint: Get user transactions
@app.get("/api/user/{user_id}/transactions")
async def get_user_transactions_endpoint(user_id: int, limit: int = 50):
    """Get all transactions for a specific user"""
    return await get_user_transactions(user_id, limit)

# Endpoint: Get transaction item details
@app.get("/api/transaction/{transaction_id}/items")
async def get_transaction_items_endpoint(transaction_id: int):
    """Get item details for a specific transaction"""
    return await get_transaction_items(transaction_id)

# ===== INFORMATION POSTS ENDPOINTS =====

class InformationPostCreate(BaseModel):
    title: str
    content: str
    image_url: Optional[str] = None
    item_id: Optional[int] = None
    is_published: bool = True

class InformationPostUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    image_url: Optional[str] = None
    item_id: Optional[int] = None
    is_published: Optional[bool] = None

@app.get("/api/posts")
async def get_public_posts():
    """Get all published posts"""
    return await get_published_posts()

@app.get("/api/admin/posts")
async def get_admin_posts():
    """Get all posts including unpublished"""
    return await get_all_posts()

@app.post("/api/admin/posts")
async def create_post_endpoint(post: InformationPostCreate):
    """Create a new post"""
    return await create_post(post.title, post.content, post.image_url, post.item_id, post.is_published)

@app.put("/api/admin/posts/{post_id}")
async def update_post_endpoint(post_id: int, post: InformationPostUpdate):
    """Update a post"""
    return await update_post(post_id, title=post.title, content=post.content, image_url=post.image_url, item_id=post.item_id, is_published=post.is_published)

@app.delete("/api/admin/posts/{post_id}")
async def delete_post_endpoint(post_id: int):
    """Delete a post"""
    return await delete_post(post_id)