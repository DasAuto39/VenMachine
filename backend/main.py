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

class ItemCreate(BaseModel):
    name: str
    sku: str
    price: float
    stock_quantity: int
    location_id: int

class ItemUpdate(BaseModel):
    name: str = None
    sku: str = None
    price: float = None
    stock_quantity: int = None
    location_id: int = None

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
    async with app.state.pool.acquire() as connection:
        try:
            # Cek stock tersedia
            check_query = "SELECT stock_quantity FROM items WHERE id = $1"
            item = await connection.fetchrow(check_query, req.item_id)
            
            if not item:
                raise HTTPException(status_code=404, detail="Item not found")
            
            if item['stock_quantity'] < req.requested_qty:
                raise HTTPException(status_code=400, detail="Stok tidak cukup")
            
            # Decrement stock
            update_query = """
                UPDATE items 
                SET stock_quantity = stock_quantity - $1,
                    updated_at = NOW()
                WHERE id = $2
                RETURNING id, name, stock_quantity
            """
            result = await connection.fetchrow(update_query, req.requested_qty, req.item_id)
            
            # Log transactionnya
            log_query = """
                INSERT INTO dispense_logs (item_id, requested_qty, source, status)
                VALUES ($1, $2, 'WEB', 'SUCCESS')
                RETURNING id
            """
            log_result = await connection.fetchrow(log_query, req.item_id, req.requested_qty)
            
            return {
                "message": f"Berhasil ambil {req.requested_qty}x {result['name']}", 
                "transaction_id": log_result['id'],
                "new_stock": result['stock_quantity']
            }
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Error: {str(e)}")

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
async def get_all_items():
    async with app.state.pool.acquire() as connection:
        query = """
            SELECT i.id, i.name, i.sku, i.price, i.stock_quantity, i.location_id, s.gate_code
            FROM items i
            LEFT JOIN storage_locations s ON i.location_id = s.id
            ORDER BY i.id
        """
        rows = await connection.fetch(query)
        return [dict(row) for row in rows]

# Endpoint 5: Create new item
@app.post("/api/admin/items")
async def create_item(item: ItemCreate):
    async with app.state.pool.acquire() as connection:
        try:
            query = """
                INSERT INTO items (name, sku, price, stock_quantity, location_id)
                VALUES ($1, $2, $3, $4, $5)
                RETURNING id, name, sku, price, stock_quantity, location_id
            """
            result = await connection.fetchrow(query, item.name, item.sku, item.price, item.stock_quantity, item.location_id)
            return dict(result)
        except Exception as e:
            raise HTTPException(status_code=400, detail=str(e))

# Endpoint 6: Update item
@app.put("/api/admin/items/{item_id}")
async def update_item(item_id: int, item: ItemUpdate):
    async with app.state.pool.acquire() as connection:
        # Build dynamic update query
        updates = []
        values = []
        counter = 1
        
        if item.name is not None:
            updates.append(f"name = ${counter}")
            values.append(item.name)
            counter += 1
        if item.sku is not None:
            updates.append(f"sku = ${counter}")
            values.append(item.sku)
            counter += 1
        if item.price is not None:
            updates.append(f"price = ${counter}")
            values.append(item.price)
            counter += 1
        if item.stock_quantity is not None:
            updates.append(f"stock_quantity = ${counter}")
            values.append(item.stock_quantity)
            counter += 1
        if item.location_id is not None:
            updates.append(f"location_id = ${counter}")
            values.append(item.location_id)
            counter += 1
        
        if not updates:
            raise HTTPException(status_code=400, detail="No fields to update")
        
        updates.append(f"updated_at = NOW()")
        values.append(item_id)
        
        try:
            query = f"""
                UPDATE items
                SET {', '.join(updates)}
                WHERE id = ${counter}
                RETURNING id, name, sku, price, stock_quantity, location_id
            """
            result = await connection.fetchrow(query, *values)
            if not result:
                raise HTTPException(status_code=404, detail="Item not found")
            return dict(result)
        except Exception as e:
            raise HTTPException(status_code=400, detail=str(e))

# Endpoint 7: Delete item
@app.delete("/api/admin/items/{item_id}")
async def delete_item(item_id: int):
    async with app.state.pool.acquire() as connection:
        query = "DELETE FROM items WHERE id = $1 RETURNING id"
        result = await connection.fetchrow(query, item_id)
        if not result:
            raise HTTPException(status_code=404, detail="Item not found")
        return {"message": "Item deleted successfully", "id": item_id}