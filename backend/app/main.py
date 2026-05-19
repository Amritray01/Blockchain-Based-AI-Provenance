import threading
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from app.routes import dataset, model, prediction, verify, batch
from app.services.db import init_db
from app.utils.worker_runner import worker 

@asynccontextmanager
async def lifespan(app: FastAPI):
    # --- STARTUP LOGIC ---
    print("Initializing Provenance Database...")
    init_db()
    
    print("Starting Blockchain Flusher Thread...")
    # daemon=True ensures the thread dies automatically when you stop FastAPI
    threading.Thread(target=worker, daemon=True).start()
    
    yield
    # --- SHUTDOWN LOGIC ---
    print("Shutting down Provenance Node.")

app = FastAPI(title="Blockchain AI Provenance Tracker", lifespan=lifespan)

# ── CORS ─────────────────────────────────────────────────────────────────────
# Allow the Vite dev server (any localhost port) and MetaMask injected pages.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173",
                   "http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(dataset.router)
app.include_router(model.router)
app.include_router(prediction.router)
app.include_router(verify.router)
app.include_router(batch.router)