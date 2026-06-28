from fastapi import FastAPI, HTTPException, Depends, Request, UploadFile, File
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
from typing import Optional, List, Dict
import requests
import json
import os
from database import DatabasePool
from auth import get_current_user, get_admin_user
from mqtt_client import start_mqtt, stop_mqtt, publish_dispense, publish_active_config_async
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
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
    cancel_transaction,
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
    delete_post,
    get_all_locations,
    create_location,
    update_location,
    delete_location,
    get_analytics_data
)

app = FastAPI(title="Smart Storage API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)

# Mount static files directory
import os
os.makedirs("uploads", exist_ok=True)
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")



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
    payment_method: str  # CASH, QRIS, TRANSFER, CARD, MIDTRANS

class MidtransTokenRequest(BaseModel):
    transaction_id: int

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

class LocationCreate(BaseModel):
    row_position: int
    location_code: str
    is_active: bool = True

# Mengelola koneksi database saat server menyala/mati
@app.on_event("startup")
async def startup():
    await DatabasePool.init()
    import asyncio
    loop = asyncio.get_running_loop()
    start_mqtt(loop)

@app.on_event("shutdown")
async def shutdown():
    await DatabasePool.close()
    stop_mqtt()

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
@limiter.limit("5/minute")
async def chat_endpoint(request: Request, req: ChatRequest):
    """Chatbot AI Endpoint with Dynamic DB Context"""
    available_items = await get_available_items()
    
    # Format available items secara singkat untuk menghemat token (tanpa deskripsi panjang)
    item_list_str = "\n".join([f"- ID: {item['id']} | Kategori: {item.get('category', 'Lainnya')} | Nama: {item['name']} | Harga: Rp{item['price']} | Stok: {item['machine_stock']}" for item in available_items])
    
    system_prompt = f"""
Anda adalah Asisten Cerdas Vending Machine Khusus Masakan Indonesia.
Bantu pengguna berbelanja bahan makanan yang tersedia.

STOK BAHAN:
{item_list_str}

TUGAS ANDA:
1. PERKENALAN AWAL: Jika pengguna hanya menyapa (contoh: "Halo", "Hai", "Pagi"), perkenalkan diri Anda dengan ramah sebagai asisten dan tanyakan apa yang bisa Anda bantu. JANGAN memberikan rekomendasi sebelum diminta.
2. REKOMENDASI SPESIFIK INDONESIA: Jika pengguna meminta rekomendasi, fokuslah pada MASAKAN INDONESIA secara umum. Jika pengguna secara spesifik meminta "tradisional", barulah rekomendasikan menu tradisional. Sesuaikan dengan konteks yang diminta pengguna (contoh: makanan yang bergizi untuk anak kecil, makanan lembut untuk orang tua, masakan pedas, dll) menggunakan "STOK BAHAN" di atas.
3. JIKA pengguna membalas setuju/mengonfirmasi saran Anda (contoh: "oke", "ya", "tambahkan"), Anda WAJIB merespons dengan memasukkan ID barang ke dalam array `action_items` dan mengkonfirmasi bahwa barang telah ditambahkan.
4. JIKA pengguna belum setuju/masih bertanya, `action_items` HARUS kosong [].
5. PENTING: Dalam "message" yang Anda berikan ke pengguna, sebutkan NAMA BARANG saja dan cetak tebal (bold) menggunakan markdown (contoh: **Bayam Segar**), JANGAN PERNAH menyebutkan nomor ID (contoh: "ID 1", "ID 2"). ID barang HANYA boleh diletakkan di dalam array `action_items`.
6. PENTING (VARIASI JAWABAN): Jangan mengulangi kalimat atau rekomendasi dari contoh di bawah ini (seperti selalu menyarankan Sayur Bening). Buatlah jawaban, gaya bahasa, sapaan, dan rekomendasi masakan yang sangat variatif, kreatif, dan natural sesuai dengan bahan yang sedang tersedia.
7. Berikan output HANYA dalam JSON valid, tanpa teks lain.
8. PENOLAKAN HALUS: JIKA pengguna meminta resep atau bahan yang TIDAK ADA di dalam STOK BAHAN, Anda HARUS meminta maaf dengan sopan dan memberi tahu bahwa bahan tersebut sedang kosong. Lalu, berikan alternatif resep lain menggunakan HANYA bahan yang sedang TERSEDIA.
9. BATASAN TOPIK: Anda adalah asisten Vending Machine. JIKA pengguna bertanya hal-hal di luar konteks makanan, bahan masakan, atau cara berbelanja di FreshMart, tolak dengan sopan dan kembalikan percakapan ke topik berbelanja.
10. KUANTITAS: JIKA pengguna secara spesifik meminta jumlah barang lebih dari satu (contoh: minta 2 bayam dengan ID 1), Anda harus memasukkan ID tersebut berkali-kali ke dalam array `action_items` sesuai jumlah yang diminta (contoh: `[1, 1]`).
11. ANGGARAN: Anda memiliki informasi harga. JIKA pengguna menyebutkan batas anggaran (budget), berikan rekomendasi kombinasi bahan masakan yang total harganya TIDAK MELEBIHI anggaran tersebut.
12. PERSETUJUAN SEBAGIAN: Saat pengguna menyetujui rekomendasi, baca baik-baik apakah mereka menyetujui semua rekomendasi atau hanya sebagian. HANYA masukkan ID barang ke `action_items` yang secara eksplisit disetujui oleh pengguna.
13. PROFIL USIA & DIET: Perhatikan kata kunci usia (anak, bayi, lansia) atau pantangan (diet, alergi). Jangan merekomendasikan masakan pedas/keras untuk balita atau lansia. Utamakan sayur dan masakan rebusan/kukus untuk permintaan diet sehat.
14. MASAKAN DAERAH (REGIONAL): JIKA pengguna meminta masakan khas daerah tertentu (Padang, Sunda, Jawa, Bali, dll), gunakan pengetahuan kuliner nusantara Anda untuk meracik menu dari bahan yang TERSEDIA.
15. PROFIL RASA & WAKTU MAKAN: JIKA pengguna meminta rasa tertentu (Pedas, Gurih, Segar) atau waktu (Sarapan, Makan Malam), sesuaikan resepnya. (Contoh: Kuah segar sangat cocok untuk siang hari).
16. CROSS-SELLING (PENAWARAN PELENGKAP): Jika pengguna telah menyetujui untuk membeli suatu barang, cobalah tawarkan SATU bahan pelengkap lain yang ada di STOK BAHAN untuk menyempurnakan masakannya secara natural, jika tidak ada bahan pelengkap yang cocok, jangan memaksakan.
17. KEPRIBADIAN (TONE): Gunakan sapaan yang hangat, sopan, dan ramah selayaknya asisten belanja yang ceria. Jangan membalas dengan bahasa yang terlalu kaku atau teknis.

CONTOH STRUKTUR JSON (HANYA CONTOH FORMAT, BUAT KONTEN ANDA SENDIRI):
{{
  "message": "Halo! Saya asisten mesin otomatis Anda. Ada yang bisa saya bantu hari ini? Anda bisa menanyakan rekomendasi masakan Indonesia atau Menu Makanan yang anda Inginkan .",
  "action_items": []
}}
CONTOH JSON JIKA MENAWARKAN:
{{
  "message": "Untuk masakan berkuah yang segar dan sehat untuk si kecil, saya sarankan membuat Sayur Bening dengan **Bayam Segar** dan **Wortel Premium**. Mau saya tambahkan ke keranjang?",
  "action_items": []
}}
CONTOH JSON JIKA USER MENJAWAB SETUJU:
{{
  "message": "Baik, **Bayam Segar** dan **Wortel Premium** telah ditambahkan ke keranjang belanja Anda.",
  "action_items": [1, 2]
}}
"""
    
    gemini_api_key = os.getenv("GEMINI_API_KEY")
    if not gemini_api_key:
        return {
            "message": "Sistem AI belum dikonfigurasi (GEMINI_API_KEY tidak ditemukan).",
            "action_items": []
        }

    contents_payload = []
    
    if req.history:
        for msg in req.history[-3:]: # Kurangi history menjadi 3 riwayat terakhir untuk menghemat token
            role = msg.get("role", "user")
            content = msg.get("content", "")
            
            if role == "bot" or role == "assistant": 
                role = "model" # Gemini menggunakan "model", bukan "bot" atau "assistant"
                # Bungkus kembali history AI menjadi JSON agar AI tetap konsisten membalas dengan JSON
                content = json.dumps({"message": content, "action_items": []})
            else:
                role = "user"
                
            contents_payload.append({
                "role": role,
                "parts": [{"text": content}]
            })
            
    # Tambahkan pesan user saat ini
    contents_payload.append({
        "role": "user",
        "parts": [{"text": req.message}]
    })

    import asyncio
    max_retries = 3
    
    for attempt in range(max_retries):
        try:
            # Menggunakan model gemini-1.5-flash yang sangat cepat dan stabil
            url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={gemini_api_key}"
            
            payload = {
                "system_instruction": {
                    "parts": {"text": system_prompt}
                },
                "contents": contents_payload,
                "generationConfig": {
                    "temperature": 0.6,
                    "maxOutputTokens": 150, # Membatasi output agar AI merespons dengan cepat dan padat
                    "response_mime_type": "application/json" # Memaksa Gemini untuk mengembalikan format JSON yang valid
                }
            }
            
            # Set timeout lebih kecil, karena kita akan mencoba berulang kali jika gagal
            response = requests.post(url, json=payload, timeout=20)
            response.raise_for_status()
            data = response.json()
            
            # Ekstrak teks balasan dari struktur payload Gemini
            raw_text = data.get("candidates", [{}])[0].get("content", {}).get("parts", [{}])[0].get("text", "").strip()
            
            if not raw_text:
                raise json.JSONDecodeError("Empty response from Gemini", "", 0)
                
            parsed = json.loads(raw_text)
            
            # Fallback safeguard jika format dari AI tidak ada
            if "message" not in parsed:
                parsed["message"] = "Terjadi kesalahan format dari AI."
            if "action_items" not in parsed:
                parsed["action_items"] = []
                
            return parsed
            
        except (requests.exceptions.RequestException, json.JSONDecodeError) as e:
            if attempt < max_retries - 1:
                # Menunggu sebelum mencoba lagi (Exponential backoff sederhana: 1s, 2s)
                await asyncio.sleep(1 * (attempt + 1))
                continue
                
            print(f"Gemini API Error after {max_retries} attempts:", e)
            if isinstance(e, requests.exceptions.RequestException) and hasattr(e, 'response') and e.response is not None:
                print("Response:", e.response.text)
                
            return {
                "message": "Maaf, asisten cerdas sedang sibuk melayani banyak antrean. Anda bisa langsung menekan tombol 'Tambah' pada etalase produk di bawah ya!",
                "action_items": []
            }
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
    # Ambil gate_id dari transaction untuk MQTT
    transaction = await get_transaction_status(req.transaction_id)
    gate_id = transaction['gate_id']
    
    result = await process_payment(req.transaction_id, req.payment_method)
    
    if result.get("status") == "SUCCESS":
        dispensed_items = result.get("dispensed_items", [])
        if dispensed_items:
            # Build payload untuk ESP32 (contoh array [1, 1, 2] jika qty > 1)
            items_to_dispense = []
            for item in dispensed_items:
                items_to_dispense.extend([item['location_id']] * item['quantity'])
                
            # Publish perintah keluarkan barang
            publish_dispense(gate_id, items_to_dispense)
            
    return result

import base64
@app.post("/api/midtrans/token")
async def get_midtrans_token(request: Request, req: MidtransTokenRequest):
    """Mendapatkan Snap Token dari Midtrans"""
    transaction = await get_transaction_status(req.transaction_id)
    
    server_key = os.getenv("MIDTRANS_SERVER_KEY")
    if not server_key or server_key.startswith("SB-Mid-server-ganti"):
        raise HTTPException(status_code=500, detail="Midtrans Server Key belum dikonfigurasi di backend .env")
        
    auth_string = base64.b64encode(f"{server_key}:".encode('utf-8')).decode('utf-8')
    
    headers = {
        "Accept": "application/json",
        "Content-Type": "application/json",
        "Authorization": f"Basic {auth_string}"
    }
    
    # Gunakan 'referer' untuk mendapatkan URL penuh (termasuk ?gate=...), jika tidak ada, gunakan 'origin'
    frontend_url = request.headers.get("referer") or request.headers.get("origin")
    if not frontend_url:
        raise HTTPException(status_code=400, detail="Tidak dapat mendeteksi Origin/Referer dari browser.")
    
    # Referer kadang berakhiran dengan trailing slash, kita bersihkan jika Midtrans memintanya
    # Tapi tidak apa-apa karena kita ingin Midtrans mengembalikan URL utuh.
    
    payload = {
        "transaction_details": {
            "order_id": transaction["transaction_code"],
            "gross_amount": int(transaction["total_amount"])
        },
        "callbacks": {
            "finish": frontend_url
        },
        "expiry": {
            "unit": "minutes",
            "duration": 3
        }
    }
    
    try:
        response = requests.post(
            "https://app.sandbox.midtrans.com/snap/v1/transactions",
            headers=headers,
            json=payload
        )
        response.raise_for_status()
        data = response.json()
        return {"token": data["token"], "redirect_url": data["redirect_url"]}
    except requests.exceptions.RequestException as e:
        print("Midtrans Error:", e)
        if hasattr(e, 'response') and e.response is not None:
            print("Response:", e.response.text)
        raise HTTPException(status_code=500, detail="Gagal menghubungi server Midtrans")

class PaymentCallbackRequest(BaseModel):
    order_id: str
    transaction_status: str

@app.post("/api/payment/callback")
async def payment_callback_endpoint(req: PaymentCallbackRequest):
    """Fallback endpoint untuk menangani redirect dari Midtrans jika Webhook tidak jalan (localhost)"""
    pool = DatabasePool.get_pool()
    async with pool.acquire() as connection:
        transaction = await connection.fetchrow(
            "SELECT id, gate_id, payment_status FROM transactions WHERE transaction_code = $1",
            req.order_id
        )
        
        if not transaction:
            raise HTTPException(status_code=404, detail="Transaction not found")
            
        # Jika sudah dibayar sebelumnya (oleh onSuccess frontend), abaikan
        if transaction['payment_status'] == 'PAID':
            return {"status": "SUCCESS", "message": "Already paid"}
            
        if req.transaction_status in ['settlement', 'capture']:
            # Proses pembayaran
            result = await process_payment(transaction['id'], 'MIDTRANS')
            if result.get("status") == "SUCCESS":
                dispensed_items = result.get("dispensed_items", [])
                if dispensed_items:
                    items_to_dispense = []
                    for item in dispensed_items:
                        items_to_dispense.extend([item['location_id']] * item['quantity'])
                    publish_dispense(transaction['gate_id'], items_to_dispense)
            return result
        else:
            return {"status": "FAILED", "message": "Transaction not settled"}

# Endpoint 3: Get transaction status
@app.get("/api/transaction/{transaction_id}")
async def get_transaction_status_endpoint(transaction_id: int):
    """Get transaction and payment status"""
    return await get_transaction_status(transaction_id)

@app.post("/api/transaction/{transaction_id}/cancel")
async def cancel_transaction_endpoint(transaction_id: int):
    """Membatalkan transaksi secara manual (misal: user menutup popup Midtrans)"""
    return await cancel_transaction(transaction_id)

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
async def get_all_items_endpoint(current_user: dict = Depends(get_admin_user)):
    """Get all items including stock 0"""
    return await get_all_items()

# Endpoint 5: Create new item
@app.post("/api/admin/items")
async def create_item_endpoint(item: ItemCreate, current_user: dict = Depends(get_admin_user)):
    """Create a new item"""
    res = await create_item(item.name, item.sku, item.price, item.machine_stock, item.warehouse_stock, item.location_id, item.description, item.image_url, item.category)
    await publish_active_config_async()
    return res

# Endpoint 6: Update item
@app.put("/api/admin/items/{item_id}")
async def update_item_endpoint(item_id: int, item: ItemUpdate, current_user: dict = Depends(get_admin_user)):
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
    res = await update_item(item_id, **update_kwargs)
    await publish_active_config_async()
    return res

# Endpoint 7: Delete item
@app.delete("/api/admin/items/{item_id}")
async def delete_item_endpoint(item_id: int, current_user: dict = Depends(get_admin_user)):
    """Delete an item"""
    res = await delete_item(item_id)
    await publish_active_config_async()
    return res

# ===== ADMIN ENDPOINTS (Locations Management) =====

@app.get("/api/admin/locations")
async def get_locations_endpoint(current_user: dict = Depends(get_admin_user)):
    return await get_all_locations()

@app.post("/api/admin/locations")
async def create_location_endpoint(loc: LocationCreate, current_user: dict = Depends(get_admin_user)):
    return await create_location(loc.row_position, loc.location_code, loc.is_active)

@app.put("/api/admin/locations/{loc_id}")
async def update_location_endpoint(loc_id: int, loc: LocationCreate, current_user: dict = Depends(get_admin_user)):
    return await update_location(loc_id, loc.row_position, loc.location_code, loc.is_active)

@app.delete("/api/admin/locations/{loc_id}")
async def delete_location_endpoint(loc_id: int, current_user: dict = Depends(get_admin_user)):
    return await delete_location(loc_id)

import uuid
import shutil

@app.post("/api/admin/upload")
async def upload_image(file: UploadFile = File(...), current_user: dict = Depends(get_admin_user)):
    """Upload an image and return its URL"""
    try:
        # VALIDASI KEAMANAN: Pastikan yang diupload BENAR-BENAR gambar
        allowed_mime_types = ["image/jpeg", "image/png", "image/webp"]
        if file.content_type not in allowed_mime_types:
            raise HTTPException(status_code=400, detail="Format file tidak didukung. Harap gunakan JPG, PNG, atau WebP.")
            
        # Ambil ekstensi yang valid berdasarkan MIME type
        ext_map = {"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp"}
        ext = ext_map[file.content_type]
        
        # Generate unique filename (mencegah path traversal dan menimpa file)
        filename = f"{uuid.uuid4().hex}.{ext}"
        filepath = os.path.join("uploads", filename)
        
        with open(filepath, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
            
        # Return relative URL
        return {"url": f"/uploads/{filename}"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# Endpoint: Restock Item
@app.post("/api/items/{item_id}/restock")
async def restock_item_endpoint(item_id: int):
    """Triggered when ESP32 finishes restocking to move warehouse stock to machine stock"""
    return await process_restock(item_id)

# ===== ADMIN PAYMENT MANAGEMENT ENDPOINTS =====

# Endpoint: Get all transactions
@app.get("/api/admin/transactions")
async def get_transactions_endpoint(limit: int = 50, current_user: dict = Depends(get_admin_user)):
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
async def get_admin_posts(current_user: dict = Depends(get_admin_user)):
    """Get all posts including unpublished"""
    return await get_all_posts()

@app.post("/api/admin/posts")
async def create_post_endpoint(post: InformationPostCreate, current_user: dict = Depends(get_admin_user)):
    """Create a new post"""
    return await create_post(post.title, post.content, post.image_url, post.item_id, post.is_published)

@app.put("/api/admin/posts/{post_id}")
async def update_post_endpoint(post_id: int, post: InformationPostUpdate, current_user: dict = Depends(get_admin_user)):
    """Update a post"""
    return await update_post(post_id, title=post.title, content=post.content, image_url=post.image_url, item_id=post.item_id, is_published=post.is_published)

@app.delete("/api/admin/posts/{post_id}")
async def delete_post_endpoint(post_id: int, current_user: dict = Depends(get_admin_user)):
    """Delete a post"""
    return await delete_post(post_id)

# ===== ADMIN ANALYTICS =====

@app.get("/api/admin/analytics")
async def admin_analytics_endpoint(current_user: dict = Depends(get_admin_user)):
    """Get aggregated analytics data"""
    return await get_analytics_data()