"""
test_api.py

Integration tests for FastAPI endpoints:
- Authentication with custom passwords
- Role guards
- Manufacturer mint endpoint
- Distributor receive endpoint
- Hospital purchase endpoint
- Query endpoints (batch provenance, block, chain, batches)
"""

import pytest
from fastapi.testclient import TestClient

from db.seed import seed
from main import app

client = TestClient(app)


@pytest.fixture(scope="module", autouse=True)
def setup_database():
    """Seed fresh database and reset chain before API tests."""
    seed()


def get_token(username, password):
    response = client.post(
        "/auth/login",
        data={"username": username, "password": password}
    )
    assert response.status_code == 200, f"Login failed: {response.text}"
    return response.json()["access_token"]


def test_auth_success():
    # Test custom passwords for all 3 canonical participants
    assert get_token("manu_a", "mpass123") is not None
    assert get_token("dist_a", "dpass123") is not None
    assert get_token("hosp_a", "hpass123") is not None


def test_auth_invalid_credentials():
    response = client.post(
        "/auth/login",
        data={"username": "manu_a", "password": "wrongpassword"}
    )
    assert response.status_code == 401


def test_role_guard_forbidden():
    dist_token = get_token("dist_a", "dpass123")

    # Distributor cannot access manufacturer-only route
    response = client.post(
        "/manufacturer/mint",
        json={"batch_id": "B001", "price": 100.0},
        headers={"Authorization": f"Bearer {dist_token}"}
    )
    assert response.status_code == 403


def test_full_supply_chain_api_flow():
    import time
    import uuid
    from db.database import SessionLocal
    from db.models import MedicineMetadata
    from datetime import date
    from blockchain.chain import blockchain

    test_batch_id = f"TEST_{uuid.uuid4().hex[:8]}"

    # Ensure test medicine metadata exists
    db = SessionLocal()
    db.add(MedicineMetadata(
        batch_id=test_batch_id,
        drug_name="Paracetamol 500mg",
        manufacturer="Manufacturer A",
        manufacturing_date=date(2026, 1, 10),
        expiry_date=date(2028, 1, 10),
        composition="Paracetamol 500mg",
        dosage="500mg",
        pack_size="10x10 Tablets",
        therapeutic_class="Analgesic / Antipyretic"
    ))
    db.commit()
    db.close()

    manu_token = get_token("manu_a", "mpass123")
    dist_token = get_token("dist_a", "dpass123")
    hosp_token = get_token("hosp_a", "hpass123")

    # 1. Manufacturer mints test batch
    mint_res = client.post(
        "/manufacturer/mint",
        json={"batch_id": test_batch_id, "price": 100.0},
        headers={"Authorization": f"Bearer {manu_token}"}
    )
    assert mint_res.status_code == 200, mint_res.text
    mint_data = mint_res.json()
    assert mint_data["stage"] == "mint"
    assert mint_data["batch_id"] == test_batch_id
    assert "verification_code" in mint_data
    dist_code = mint_data["verification_code"]
    assert len(dist_code) == 10

    # 1b. Attempt distribution with wrong verification code must fail
    wrong_dist_res = client.post(
        "/distributor/receive",
        json={"batch_id": test_batch_id, "price": 130.0, "verification_code": "0000000000"},
        headers={"Authorization": f"Bearer {dist_token}"}
    )
    assert wrong_dist_res.status_code == 400

    # 2. Distributor receives test batch with valid 10-digit code
    dist_res = client.post(
        "/distributor/receive",
        json={"batch_id": test_batch_id, "price": 130.0, "verification_code": dist_code},
        headers={"Authorization": f"Bearer {dist_token}"}
    )
    assert dist_res.status_code == 200, dist_res.text
    dist_data = dist_res.json()
    assert dist_data["stage"] == "distribute"
    assert dist_data["owner"] == "dist_a"
    assert "hospital_verification_code" in dist_data
    hosp_code = dist_data["hospital_verification_code"]
    assert len(hosp_code) == 10

    # 2b. Attempt purchase with wrong verification code must fail
    wrong_hosp_res = client.post(
        "/hospital/purchase",
        json={"batch_id": test_batch_id, "price": 160.0, "verification_code": "9999999999"},
        headers={"Authorization": f"Bearer {hosp_token}"}
    )
    assert wrong_hosp_res.status_code == 400

    # 3. Hospital purchases test batch with valid code
    hosp_res = client.post(
        "/hospital/purchase",
        json={"batch_id": test_batch_id, "price": 160.0, "verification_code": hosp_code},
        headers={"Authorization": f"Bearer {hosp_token}"}
    )
    assert hosp_res.status_code == 200, hosp_res.text
    hosp_data = hosp_res.json()
    assert hosp_data["stage"] == "purchase"
    assert hosp_data["owner"] == "hosp_a"

    # 4. Duplicate purchase attempt must be rejected
    dup_res = client.post(
        "/hospital/purchase",
        json={"batch_id": test_batch_id, "price": 160.0, "verification_code": hosp_code},
        headers={"Authorization": f"Bearer {hosp_token}"}
    )
    assert dup_res.status_code == 400


def test_query_endpoints():
    # Query batch provenance for any valid batch on chain
    chain_res = client.get("/query/chain")
    assert chain_res.status_code == 200
    chain_data = chain_res.json()
    assert chain_data["is_valid"] is True

    # Find a batch that has transactions
    batch_id = "B001"
    for b in chain_data["chain"]:
        if b.get("transactions"):
            batch_id = b["transactions"][0].get("batch_id")
            break

    batch_res = client.get(f"/query/batch/{batch_id}")
    assert batch_res.status_code == 200
    batch_data = batch_res.json()

    assert batch_data["batch_id"] == batch_id
    assert batch_data["blockchain"]["is_authentic"] is True
    assert batch_data["blockchain"]["chain_verified"] is True

    # Query block by height
    block_res = client.get("/query/block/1")
    assert block_res.status_code == 200
    block_data = block_res.json()
    assert block_data["index"] == 1
    assert "hash" in block_data
    assert "validator" in block_data

    # Query full chain
    chain_res = client.get("/query/chain")
    assert chain_res.status_code == 200
    chain_data = chain_res.json()
    assert chain_data["is_valid"] is True
    assert chain_data["length"] >= 4  # Genesis + Mint + Distribute + Purchase

    # Query all batches summary
    batches_res = client.get("/query/batches")
    assert batches_res.status_code == 200
    batches_data = batches_res.json()
    assert batches_data["total"] >= 1
    assert any(b["batch_id"] == "B001" and b["stage"] == "purchase" for b in batches_data["batches"])
