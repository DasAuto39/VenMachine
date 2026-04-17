"""
Database connection management dan pool management
Security: Centralized database connection handling
"""
import asyncpg
import os
from typing import Optional
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

DB_URL = os.getenv("DB_URL")

class DatabasePool:
    """Singleton untuk manage database connection pool"""
    _pool: Optional[asyncpg.Pool] = None
    
    @classmethod
    async def init(cls) -> asyncpg.Pool:
        """Initialize database pool pada startup"""
        if cls._pool is None:
            cls._pool = await asyncpg.create_pool(DB_URL)
        return cls._pool
    
    @classmethod
    async def close(cls) -> None:
        """Close database pool pada shutdown"""
        if cls._pool:
            await cls._pool.close()
            cls._pool = None
    
    @classmethod
    def get_pool(cls) -> asyncpg.Pool:
        """Get current pool instance"""
        if cls._pool is None:
            raise RuntimeError("Database pool not initialized. Call DatabasePool.init() first")
        return cls._pool
