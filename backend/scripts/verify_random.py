import random
from web3 import Web3
from app.services.db import get_conn

def verify_random():
    conn = get_conn()
    cur = conn.cursor()

    cur.execute("SELECT inputHash, outputHash FROM predictions WHERE status='MINED'")
    rows = cur.fetchall()

    sample = random.choice(rows)

    inputHash, outputHash = sample
    
    result = contract.functions.verifyPrediction(
        inputHash, outputHash
    ).call()

    print("Verification:", result)