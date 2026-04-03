from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import asyncpg
from fastapi.middleware.cors import CORSMiddleware
import os

# Mengambil DB_URL dari environment variable Docker.
DB_URL = os.getenv("DB_URL")

app = FastAPI(title="Smart Storage API")


app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Mengizinkan React mengakses API ini
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

# Mengelola koneksi database saat server menyala/mati
@app.on_event("startup")
async def startup():
    app.state.pool = await asyncpg.create_pool(DB_URL)

@app.on_event("shutdown")
async def shutdown():
    await app.state.pool.close()

# Endpoint 1: Mengambil katalog barang untuk UI React
@app.get("/api/items")
async def get_items():
    async with app.state.pool.acquire() as connection:
        # Mengambil item yang stoknya masih tersedia
        query = """
            SELECT i.id, i.name, i.sku, i.price, i.stock_quantity, s.gate_code 
            FROM items i
            LEFT JOIN storage_locations s ON i.location_id = s.id
            WHERE i.stock_quantity > 0
        """
        rows = await connection.fetch(query)
        return [dict(row) for row in rows]

# Endpoint 2: Menerima request pengambilan barang (Dari UI atau LLM)
@app.post("/api/dispense")
async def dispense_item(req: DispenseRequest):
    # Di sinilah nanti logika transaksi (LOCK row) dan pengurangan stok dieksekusi
    # Setelah itu, sistem akan mengirim instruksi ke mikrokontroler via Serial/MQTT
    
    # Untuk sementara, kita buat simulasi kembalian sukses
    return {
        "message": f"Instruksi pengambilan barang ID {req.item_id} dikirim ke mesin.", 
        "transaction_id": 999
    }

# Endpoint 3: Webhook untuk menerima laporan dari Hardware
@app.post("/api/hardware-status")
async def update_hardware_status(payload: HardwareStatus):
    # Saat sensor mendeteksi barang jatuh, mesin menembak endpoin   t ini
    # Di sini status log di database akan diubah menjadi 'SUCCESS'
    
    return {
        "message": f"Transaksi {payload.transaction_id} berhasil dikonfirmasi oleh mesin."
    }