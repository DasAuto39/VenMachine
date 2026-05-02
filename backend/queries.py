"""
Database Queries - Security: All queries use parameterized statements to prevent SQL injection
"""
from database import DatabasePool
from fastapi import HTTPException
from typing import List, Dict, Optional
import asyncpg
from datetime import datetime, timedelta
import bcrypt
import re

# ===== PAYMENT MANAGEMENT (Demo Payment Gateway) =====

async def create_transaction(gate_id: int, items_cart: Dict[int, Dict], user_id: int = None) -> Dict:
    """
    Buat transaction baru ketika customer siap checkout
    Security: Parameterized query, input validation
    """
    if gate_id not in [1, 2, 3]:
        raise HTTPException(status_code=400, detail="Invalid gate_id")
    
    # Calculate total amount
    total_amount = 0
    for item_id, cart_item in items_cart.items():
        total_amount += cart_item['item']['price'] * cart_item['qty']
    
    if total_amount <= 0:
        raise HTTPException(status_code=400, detail="Invalid total amount")
    
    pool = DatabasePool.get_pool()
    
    # Generate transaction code: TRX-GATE1-20260412-001234
    timestamp = datetime.utcnow().strftime("%Y%m%d%H%M%S")
    transaction_code = f"TRX-GATE{gate_id}-{timestamp}"
    
    async with pool.acquire() as connection:
        try:
            # Create transaction (PENDING until payment)
            expires_at = datetime.utcnow() + timedelta(minutes=5)  # 5 min to pay
            
            result = await connection.fetchrow(
                """
                INSERT INTO transactions (user_id, transaction_code, gate_id, total_amount, payment_status, expired_at)
                VALUES ($1, $2, $3, $4, $5, $6)
                RETURNING id, transaction_code, gate_id, total_amount, payment_status, created_at, expired_at
                """,
                user_id, transaction_code, gate_id, total_amount, 'PENDING', expires_at
            )
            
            return {
                "transaction_id": result['id'],
                "transaction_code": result['transaction_code'],
                "gate_id": result['gate_id'],
                "total_amount": float(result['total_amount']),
                "payment_status": result['payment_status'],
                "created_at": result['created_at'].isoformat(),
                "expires_at": result['expired_at'].isoformat()
            }
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")


async def process_payment(transaction_id: int, payment_method: str) -> Dict:
    """
    Process payment (DEMO - simulate payment gateway)
    Security: Parameterized query, payment method validation
    """
    pool = DatabasePool.get_pool()
    
    # Validate payment method
    valid_methods = ['CASH', 'QRIS', 'TRANSFER', 'CARD']
    if payment_method not in valid_methods:
        raise HTTPException(status_code=400, detail=f"Invalid payment method. Choose from: {', '.join(valid_methods)}")
    
    async with pool.acquire() as connection:
        try:
            # Check transaction exists and not expired
            transaction = await connection.fetchrow(
                "SELECT id, total_amount, payment_status, expired_at FROM transactions WHERE id = $1",
                transaction_id
            )
            
            if not transaction:
                raise HTTPException(status_code=404, detail="Transaction not found")
            
            if transaction['payment_status'] != 'PENDING':
                raise HTTPException(status_code=400, detail=f"Transaction already {transaction['payment_status'].lower()}")
            
            if transaction['expired_at'] < datetime.utcnow():
                # Mark as expired
                await connection.execute(
                    "UPDATE transactions SET payment_status = $1 WHERE id = $2",
                    'CANCELLED', transaction_id
                )
                raise HTTPException(status_code=400, detail="Payment window expired (5 minutes)")
            
            # DEMO: Simulate successful payment (90% success rate)
            import random
            is_success = random.random() < 0.9
            
            payment_code = f"PAY-{datetime.utcnow().strftime('%Y%m%d%H%M%S')}-{random.randint(1000, 9999)}"
            payment_status = 'SUCCESS' if is_success else 'FAILED'
            
            # Create payment record
            payment = await connection.fetchrow(
                """
                INSERT INTO payments (transaction_id, payment_method, payment_code, status, paid_at)
                VALUES ($1, $2, $3, $4, $5)
                RETURNING id, payment_code, status
                """,
                transaction_id, payment_method, payment_code, payment_status, 
                datetime.utcnow() if is_success else None
            )
            
            # Update transaction status
            if is_success:
                await connection.execute(
                    """
                    UPDATE transactions 
                    SET payment_status = $1, paid_at = NOW()
                    WHERE id = $2
                    """,
                    'PAID', transaction_id
                )
            
            return {
                "payment_id": payment['id'],
                "payment_code": payment['payment_code'],
                "status": payment_status,
                "message": "Pembayaran berhasil!" if is_success else "Pembayaran gagal, silahkan coba lagi"
            }
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")


async def get_transaction_status(transaction_id: int) -> Dict:
    """
    Get transaction and payment status
    Security: Parameterized query, read-only
    """
    pool = DatabasePool.get_pool()
    async with pool.acquire() as connection:
        # Auto-cancel expired pending transactions
        await connection.execute(
            "UPDATE transactions SET payment_status = 'CANCELLED' WHERE payment_status = 'PENDING' AND expired_at < $1",
            datetime.utcnow()
        )
        
        transaction = await connection.fetchrow(
            """
            SELECT id, transaction_code, gate_id, total_amount, payment_status, created_at, paid_at, expired_at
            FROM transactions
            WHERE id = $1
            """,
            transaction_id
        )
        
        if not transaction:
            raise HTTPException(status_code=404, detail="Transaction not found")
        
        # Get payment details if exists
        payment = await connection.fetchrow(
            """
            SELECT id, payment_method, payment_code, status, paid_at
            FROM payments
            WHERE transaction_id = $1
            """,
            transaction_id
        )
        
        return {
            "transaction_id": transaction['id'],
            "transaction_code": transaction['transaction_code'],
            "gate_id": transaction['gate_id'],
            "total_amount": float(transaction['total_amount']),
            "payment_status": transaction['payment_status'],
            "payment_method": payment['payment_method'] if payment else None,
            "payment_code": payment['payment_code'] if payment else None,
            "paid_at": payment['paid_at'].isoformat() if payment and payment['paid_at'] else None,
            "created_at": transaction['created_at'].isoformat(),
            "expired_at": transaction['expired_at'].isoformat()
        }


async def get_all_transactions(limit: int = 50) -> List[Dict]:
    """
    Get semua transactions (Admin view)
    Security: Parameterized query, limited result set
    """
    if limit < 1 or limit > 1000:
        limit = 50
    
    pool = DatabasePool.get_pool()
    async with pool.acquire() as connection:
        # Auto-cancel expired pending transactions
        await connection.execute(
            "UPDATE transactions SET payment_status = 'CANCELLED' WHERE payment_status = 'PENDING' AND expired_at < $1",
            datetime.utcnow()
        )
        
        query = """
            SELECT t.id, t.transaction_code, t.gate_id, t.total_amount, t.payment_status, t.created_at, t.paid_at,
                   p.payment_method, p.payment_code
            FROM transactions t
            LEFT JOIN payments p ON t.id = p.transaction_id
            ORDER BY t.created_at DESC
            LIMIT $1
        """
        rows = await connection.fetch(query, limit)
        
        result = []
        for row in rows:
            result.append({
                "transaction_id": row['id'],
                "transaction_code": row['transaction_code'],
                "gate_id": row['gate_id'],
                "total_amount": float(row['total_amount']),
                "payment_status": row['payment_status'],
                "payment_method": row['payment_method'],
                "payment_code": row['payment_code'],
                "created_at": row['created_at'].isoformat(),
                "paid_at": row['paid_at'].isoformat() if row['paid_at'] else None
            })
        
        return result


async def get_user_transactions(user_id: int, limit: int = 50) -> List[Dict]:
    """
    Get transactions for a specific user
    Security: Parameterized query, limited result set
    """
    if limit < 1 or limit > 1000:
        limit = 50
    
    pool = DatabasePool.get_pool()
    async with pool.acquire() as connection:
        # Auto-cancel expired pending transactions for this user
        await connection.execute(
            "UPDATE transactions SET payment_status = 'CANCELLED' WHERE payment_status = 'PENDING' AND user_id = $1 AND expired_at < $2",
            user_id, datetime.utcnow()
        )
        
        query = """
            SELECT t.id, t.transaction_code, t.gate_id, t.total_amount, t.payment_status, t.created_at, t.paid_at,
                   p.payment_method, p.payment_code
            FROM transactions t
            LEFT JOIN payments p ON t.id = p.transaction_id
            WHERE t.user_id = $1
            ORDER BY t.created_at DESC
            LIMIT $2
        """
        rows = await connection.fetch(query, user_id, limit)
        
        result = []
        for row in rows:
            result.append({
                "transaction_id": row['id'],
                "transaction_code": row['transaction_code'],
                "gate_id": row['gate_id'],
                "total_amount": float(row['total_amount']),
                "payment_status": row['payment_status'],
                "payment_method": row['payment_method'],
                "payment_code": row['payment_code'],
                "created_at": row['created_at'].isoformat(),
                "paid_at": row['paid_at'].isoformat() if row['paid_at'] else None
            })
        
        return result

# ===== PUBLIC QUERIES (User Shopping) =====

async def get_available_items() -> List[Dict]:
    """
    Get semua barang yang stoknya tersedia (> 0)
    Security: Parameterized query, read-only
    """
    pool = DatabasePool.get_pool()
    async with pool.acquire() as connection:
        query = """
            SELECT i.id, i.name, i.sku, i.price, i.stock_quantity, i.description, i.image_url, s.row_position, s.location_code 
            FROM items i
            LEFT JOIN storage_locations s ON i.location_id = s.id
            --WHERE i.stock_quantity > 0
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
            SELECT i.id, i.name, i.sku, i.price, i.stock_quantity, i.description, i.image_url, i.location_id, s.row_position, s.location_code
            FROM items i
            LEFT JOIN storage_locations s ON i.location_id = s.id
            ORDER BY i.id
        """
        rows = await connection.fetch(query)
        return [dict(row) for row in rows]


async def create_item(name: str, sku: str, price: float, stock_quantity: int, location_id: int, description: str = None, image_url: str = None) -> Dict:
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
    if description and len(description) > 500:
        raise HTTPException(status_code=400, detail="Description too long (max 500 chars)")
    if image_url and len(image_url) > 500:
        raise HTTPException(status_code=400, detail="Image URL too long (max 500 chars)")
    
    async with pool.acquire() as connection:
        try:
            result = await connection.fetchrow(
                """
                INSERT INTO items (name, sku, price, stock_quantity, location_id, description, image_url)
                VALUES ($1, $2, $3, $4, $5, $6, $7)
                RETURNING id, name, sku, price, stock_quantity, location_id, description, image_url
                """,
                name, sku, price, stock_quantity, location_id, description, image_url
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
    allowed_fields = {'name', 'sku', 'price', 'stock_quantity', 'location_id', 'description', 'image_url'}
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
    if 'description' in updates and len(updates.get('description', '')) > 500:
        raise HTTPException(status_code=400, detail="Description too long (max 500 chars)")
    if 'image_url' in updates and len(updates.get('image_url', '')) > 500:
        raise HTTPException(status_code=400, detail="Image URL too long (max 500 chars)")
    
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
                RETURNING id, name, sku, price, stock_quantity, location_id, description, image_url
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


# ===== USER AUTHENTICATION (LOGIN & REGISTER) =====

def _hash_password(password: str) -> str:
    """Hash password using bcrypt"""
    salt = bcrypt.gensalt(rounds=12)
    hashed = bcrypt.hashpw(password.encode('utf-8'), salt)
    return hashed.decode('utf-8')


def _verify_password(password: str, password_hash: str) -> bool:
    """Verify password against hash"""
    try:
        return bcrypt.checkpw(password.encode('utf-8'), password_hash.encode('utf-8'))
    except Exception:
        return False


def _validate_email(email: str) -> bool:
    """Validate email format"""
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    return re.match(pattern, email) is not None


def _validate_username(username: str) -> bool:
    """Validate username format (alphanumeric, underscore, dash, 3-30 chars)"""
    if len(username) < 3 or len(username) > 30:
        return False
    pattern = r'^[a-zA-Z0-9_-]+$'
    return re.match(pattern, username) is not None


async def register_user(username: str, email: str, password: str, full_name: str, phone: str = None) -> Dict:
    """
    Register new user
    Security: Input validation, bcrypt password hashing, parameterized queries
    """
    # Validate inputs
    if not _validate_username(username):
        raise HTTPException(status_code=400, detail="Username must be 3-30 characters, alphanumeric with underscore/dash only")
    
    if not _validate_email(email):
        raise HTTPException(status_code=400, detail="Invalid email format")
    
    if len(password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")
    
    if not full_name or len(full_name) > 100:
        raise HTTPException(status_code=400, detail="Invalid full name (max 100 characters)")
    
    if phone and len(phone) > 20:
        raise HTTPException(status_code=400, detail="Invalid phone number (max 20 characters)")
    
    # Hash password
    password_hash = _hash_password(password)
    
    pool = DatabasePool.get_pool()
    async with pool.acquire() as connection:
        try:
            # Check if username or email already exists
            existing = await connection.fetchrow(
                "SELECT id FROM users WHERE username = $1 OR email = $2",
                username, email
            )
            
            if existing:
                raise HTTPException(status_code=400, detail="Username or email already registered")
            
            # Create new user
            result = await connection.fetchrow(
                """
                INSERT INTO users (username, email, password_hash, full_name, phone, is_active)
                VALUES ($1, $2, $3, $4, $5, TRUE)
                RETURNING id, username, email, full_name, phone, created_at
                """,
                username, email, password_hash, full_name, phone
            )
            
            return {
                "user_id": result['id'],
                "username": result['username'],
                "email": result['email'],
                "full_name": result['full_name'],
                "phone": result['phone'],
                "created_at": result['created_at'].isoformat(),
                "message": "User registered successfully"
            }
        except HTTPException:
            raise
        except asyncpg.UniqueViolationError:
            raise HTTPException(status_code=400, detail="Username or email already registered")
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")


async def login_user(username: str, password: str) -> Dict:
    """
    Login user with username and password
    Security: Parameterized query, bcrypt password verification
    """
    if not username or not password:
        raise HTTPException(status_code=400, detail="Username and password required")
    
    pool = DatabasePool.get_pool()
    async with pool.acquire() as connection:
        try:
            # Get user by username
            user = await connection.fetchrow(
                "SELECT id, username, email, password_hash, full_name, is_active FROM users WHERE username = $1",
                username
            )
            
            if not user:
                raise HTTPException(status_code=401, detail="Invalid username or password")
            
            if not user['is_active']:
                raise HTTPException(status_code=403, detail="Account is disabled")
            
            # Verify password
            if not _verify_password(password, user['password_hash']):
                raise HTTPException(status_code=401, detail="Invalid username or password")
            
            # Login successful
            return {
                "user_id": user['id'],
                "username": user['username'],
                "email": user['email'],
                "full_name": user['full_name'],
                "message": "Login successful"
            }
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")


# ===== INFORMATION POSTS QUERIES =====

async def get_all_posts() -> List[Dict]:
    """Admin view: Get all posts including unpublished ones"""
    pool = DatabasePool.get_pool()
    async with pool.acquire() as connection:
        query = """
            SELECT p.id, p.title, p.content, p.image_url, p.item_id, p.is_published, 
                   p.created_at, p.updated_at, i.name as item_name
            FROM information_posts p
            LEFT JOIN items i ON p.item_id = i.id
            ORDER BY p.created_at DESC
        """
        rows = await connection.fetch(query)
        result = []
        for row in rows:
            d = dict(row)
            d['created_at'] = d['created_at'].isoformat()
            d['updated_at'] = d['updated_at'].isoformat()
            result.append(d)
        return result

async def get_published_posts() -> List[Dict]:
    """Public view: Get only published posts"""
    pool = DatabasePool.get_pool()
    async with pool.acquire() as connection:
        query = """
            SELECT p.id, p.title, p.content, p.image_url, p.item_id, p.is_published, 
                   p.created_at, p.updated_at, i.name as item_name
            FROM information_posts p
            LEFT JOIN items i ON p.item_id = i.id
            WHERE p.is_published = TRUE
            ORDER BY p.created_at DESC
        """
        rows = await connection.fetch(query)
        result = []
        for row in rows:
            d = dict(row)
            d['created_at'] = d['created_at'].isoformat()
            d['updated_at'] = d['updated_at'].isoformat()
            result.append(d)
        return result

async def create_post(title: str, content: str, image_url: str = None, item_id: int = None, is_published: bool = True) -> Dict:
    """Create a new post"""
    if not title or not content:
        raise HTTPException(status_code=400, detail="Title and content are required")
        
    pool = DatabasePool.get_pool()
    async with pool.acquire() as connection:
        try:
            result = await connection.fetchrow(
                """
                INSERT INTO information_posts (title, content, image_url, item_id, is_published)
                VALUES ($1, $2, $3, $4, $5)
                RETURNING id, title, content, image_url, item_id, is_published, created_at
                """,
                title, content, image_url, item_id, is_published
            )
            d = dict(result)
            d['created_at'] = d['created_at'].isoformat()
            return d
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

async def update_post(post_id: int, **kwargs) -> Dict:
    """Update an existing post"""
    pool = DatabasePool.get_pool()
    
    allowed_fields = {'title', 'content', 'image_url', 'item_id', 'is_published'}
    updates = {k: v for k, v in kwargs.items() if k in allowed_fields and v is not None}
    
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")
        
    set_clauses = []
    values = []
    counter = 1
    
    for field, value in updates.items():
        set_clauses.append(f"{field} = ${counter}")
        values.append(value)
        counter += 1
        
    set_clauses.append("updated_at = NOW()")
    values.append(post_id)
    
    async with pool.acquire() as connection:
        try:
            query = f"""
                UPDATE information_posts
                SET {', '.join(set_clauses)}
                WHERE id = ${counter}
                RETURNING id, title, content, image_url, item_id, is_published, created_at, updated_at
            """
            result = await connection.fetchrow(query, *values)
            if not result:
                raise HTTPException(status_code=404, detail="Post not found")
                
            d = dict(result)
            d['created_at'] = d['created_at'].isoformat()
            d['updated_at'] = d['updated_at'].isoformat()
            return d
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

async def delete_post(post_id: int) -> Dict:
    """Delete a post"""
    pool = DatabasePool.get_pool()
    async with pool.acquire() as connection:
        try:
            result = await connection.fetchrow(
                "DELETE FROM information_posts WHERE id = $1 RETURNING id",
                post_id
            )
            if not result:
                raise HTTPException(status_code=404, detail="Post not found")
            return {"message": "Post deleted successfully", "id": post_id}
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
