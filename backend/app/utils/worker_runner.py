import time
from app.services.blockchain_worker import process_pending

def worker():
    """Background loop: flush pending blockchain anchors every 3 seconds."""
    while True:
        try:
            process_pending()
        except Exception as exc:
            print(f"[worker_runner] Unhandled error in process_pending: {exc}")
        time.sleep(3)