from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api.auth import router as auth_router
from api.manufacturer_routes import router as manufacturer_router
from api.distributor_routes import router as distributor_router
from api.hospital_routes import router as hospital_router
from api.query_routes import router as query_router
from api.frontend_compat_routes import router as frontend_compat_router
from blockchain.chain import blockchain
from db.database import Base, SessionLocal, engine
import db.models


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Ensure database schema is ready without dropping tables
    Base.metadata.create_all(bind=engine)

    # Startup: Restore blockchain from database persistence
    db = SessionLocal()
    try:
        blockchain.load_chain_from_db(db)
    except Exception as e:
        print(f"Warning: Could not restore chain from database: {e}")
    finally:
        db.close()
    yield


app = FastAPI(
    title="Pharma-Chain",
    version="1.0.0",
    lifespan=lifespan
)

# Enable CORS for frontend integration
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "*"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Primary routers
app.include_router(auth_router)
app.include_router(manufacturer_router)
app.include_router(distributor_router)
app.include_router(hospital_router)
app.include_router(query_router)
app.include_router(frontend_compat_router)

# Also mount under /api prefix for frontend compatibility
app.include_router(auth_router, prefix="/api")
app.include_router(manufacturer_router, prefix="/api")
app.include_router(distributor_router, prefix="/api")
app.include_router(hospital_router, prefix="/api")
app.include_router(query_router, prefix="/api")
app.include_router(frontend_compat_router, prefix="/api")


@app.get("/")
def home():
    return {
        "message": "Pharma-Chain Backend Running",
        "chain_length": len(blockchain.chain),
        "is_valid": blockchain.is_chain_valid()
    }