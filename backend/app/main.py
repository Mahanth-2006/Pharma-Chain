# Expose FastAPI app instance for uvicorn app.main:app
from main import app

__all__ = ["app"]
