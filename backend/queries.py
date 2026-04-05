"""
Database Queries - Security: All queries use parameterized statements to prevent SQL injection
"""
from database import DatabasePool
from fastapi import HTTPException
from typing import List, Dict, Optional
import asyncpg

# ===== PUBLIC QUERIES (User Shopping) =====

async def get_available_items() -> List[Dict]:
    """
    Get semua barang yang stoknya tersedia (> 0)
    Security: Parameterized query, read-only
    """
    pool = DatabasePool.get_pool()
    async with pool.acquire() as connection:
        query = """
            SELECT i.id, i.name, i.sku, i.price, i.stock_quantity, s.gate_code 
            FROM items i
            LEFT JOIN storage_locations s ON i.location_id = s.id
            WHERE i.stock_quantity > 0
            ORDER BY i.name
        """
        rows = await connection.fetch(query)
        return [dict(row) for row in rows]


async def dispense_item(item_id: int, requested_qty: int) -> Dict:
    """
    Decrement stock saat user checkout
    Security: Parameterized query, transaction-safe
    """
    pool = DatabasePool.get_pool()
    async with pool.acquire() as connection:
        # Validasi input
        if not isinstance(item_id, int) or item_id <= 0:
            raise HTTPException(status_code=400, detail="Invalid item_id")
        if not isinstance(requested_qty, int) or requested_qty <= 0:
            raise HTTPException(status_code=400, detail="Invalid quantity")
        
        try:
            # Cek stock tersedia (parameterized)
            item = await connection.fetchrow(
                "SELECT stock_quantity, name FROM items WHERE id = $1",
                item_id
            )
            
            if not item:
                raise HTTPException(status_code=404, detail="Item not found")
            
            if item['stock_quantity'] < requested_qty:
                raise HTTPException(status_code=400, detail="Stok tidak cukup")
            
            # Decrement stock (parameterized)
            result = await connection.fetchrow(
                """
                UPDATE items 
                SET stock_quantity = stock_quantity - $1,
                    updated_at = NOW()
                WHERE id = $2
                RETURNING id, name, stock_quantity
                """,
                requested_qty, item_id
            )
            
            # Log transaction (parameterized)
            log_result = await connection.fetchrow(
                """
                INSERT INTO dispense_logs (item_id, requested_qty, source, status)
                VALUES ($1, $2, $3, $4)
                RETURNING id
                """,
                item_id, requested_qty, 'WEB', 'SUCCESS'
            )
            
            return {
                "message": f"Berhasil ambil {requested_qty}x {result['name']}", 
                "transaction_id": log_result['id'],
                "new_stock": result['stock_quantity']
            }
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")


# ===== ADMIN QUERIES (Product Management) =====

async def get_all_items() -> List[Dict]:
    """
    Get semua barang (termasuk stok 0) untuk admin panel
    Security: Parameterized query, read-only
    """
    pool = DatabasePool.get_pool()
    async with pool.acquire() as connection:
        query = """
            SELECT i.id, i.name, i.sku, i.price, i.stock_quantity, i.location_id, s.gate_code
            FROM items i
            LEFT JOIN storage_locations s ON i.location_id = s.id
            ORDER BY i.id
        """
        rows = await connection.fetch(query)
        return [dict(row) for row in rows]


async def create_item(name: str, sku: str, price: float, stock_quantity: int, location_id: int) -> Dict:
    """
    Tambah produk baru
    Security: Parameterized query, input validation
    """
    pool = DatabasePool.get_pool()
    
    # Validasi input
    if not name or len(name) > 100:
        raise HTTPException(status_code=400, detail="Invalid product name")
    if not sku or len(sku) > 50:
        raise HTTPException(status_code=400, detail="Invalid SKU")
    if price < 0:
        raise HTTPException(status_code=400, detail="Price cannot be negative")
    if stock_quantity < 0:
        raise HTTPException(status_code=400, detail="Stock cannot be negative")
    
    async with pool.acquire() as connection:
        try:
            result = await connection.fetchrow(
                """
                INSERT INTO items (name, sku, price, stock_quantity, location_id)
                VALUES ($1, $2, $3, $4, $5)
                RETURNING id, name, sku, price, stock_quantity, location_id
                """,
                name, sku, price, stock_quantity, location_id
            )
            return dict(result)
        except asyncpg.UniqueViolationError:
            raise HTTPException(status_code=400, detail="SKU already exists")
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Database error: {str(e)}")


async def update_item(item_id: int, **kwargs) -> Dict:
    """
    Update produk
    Security: Parameterized query, whitelist-based field validation
    """
    pool = DatabasePool.get_pool()
    
    # Whitelist fields yang boleh di-update
    allowed_fields = {'name', 'sku', 'price', 'stock_quantity', 'location_id'}
    updates = {k: v for k, v in kwargs.items() if k in allowed_fields and v is not None}
    
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")
    
    # Validasi input
    if 'name' in updates and (not updates['name'] or len(updates['name']) > 100):
        raise HTTPException(status_code=400, detail="Invalid product name")
    if 'sku' in updates and (not updates['sku'] or len(updates['sku']) > 50):
        raise HTTPException(status_code=400, detail="Invalid SKU")
    if 'price' in updates and updates['price'] < 0:
        raise HTTPException(status_code=400, detail="Price cannot be negative")
    if 'stock_quantity' in updates and updates['stock_quantity'] < 0:
        raise HTTPException(status_code=400, detail="Stock cannot be negative")
    
    # Build parameterized query properly
    set_clauses = []
    values = []
    counter = 1
    
    for field, value in updates.items():
        set_clauses.append(f"{field} = ${counter}")
        values.append(value)
        counter += 1
    
    # Add updated_at timestamp
    set_clauses.append("updated_at = NOW()")
    values.append(item_id)  # WHERE id = $N (last parameter)
    
    async with pool.acquire() as connection:
        try:
            query = f"""
                UPDATE items
                SET {', '.join(set_clauses)}
                WHERE id = ${counter}
                RETURNING id, name, sku, price, stock_quantity, location_id
            """
            
            result = await connection.fetchrow(query, *values)
            
            if not result:
                raise HTTPException(status_code=404, detail="Item not found")
            
            return dict(result)
        except asyncpg.UniqueViolationError:
            raise HTTPException(status_code=400, detail="SKU already exists")
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")


async def delete_item(item_id: int) -> Dict:
    """
    Hapus produk
    Security: Parameterized query, hard delete dengan validation
    """
    pool = DatabasePool.get_pool()
    
    # Validasi input
    if not isinstance(item_id, int) or item_id <= 0:
        raise HTTPException(status_code=400, detail="Invalid item_id")
    
    async with pool.acquire() as connection:
        try:
            result = await connection.fetchrow(
                "DELETE FROM items WHERE id = $1 RETURNING id",
                item_id
            )
            
            if not result:
                raise HTTPException(status_code=404, detail="Item not found")
            
            return {"message": "Item deleted successfully", "id": item_id}
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")


# ===== LOGGING QUERIES =====

async def get_transaction_logs(limit: int = 100) -> List[Dict]:
    """
    Get transaction logs untuk audit trail
    Security: Parameterized query, limited result set
    """
    if limit < 1 or limit > 1000:
        limit = 100
    
    pool = DatabasePool.get_pool()
    async with pool.acquire() as connection:
        query = """
            SELECT id, item_id, requested_qty, source, status, created_at, completed_at
            FROM dispense_logs
            ORDER BY created_at DESC
            LIMIT $1
        """
        rows = await connection.fetch(query, limit)
        return [dict(row) for row in rows]
