from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api.auth import router as auth_router
from api.manufacturer_routes import router as manufacturer_router
from api.distributor_routes import router as distributor_router
from api.hospital_routes import router as hospital_router
from api.query_routes import router as query_router
from blockchain.chain import blockchain
from db.database import SessionLocal


@asynccontextmanager
async def lifespan(app: FastAPI):
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
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register all API routers
app.include_router(auth_router)
app.include_router(manufacturer_router)
app.include_router(distributor_router)
app.include_router(hospital_router)
app.include_router(query_router)


@app.get("/")
def home():
    return {
        "message": "Pharma-Chain Backend Running",
        "chain_length": len(blockchain.chain),
        "is_valid": blockchain.is_chain_valid()
    }