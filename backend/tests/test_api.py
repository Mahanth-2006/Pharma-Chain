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
    from db.database import SessionLocal
    from db.models import MedicineMetadata
    from datetime import date

    # Ensure test medicine metadata exists for B001
    db = SessionLocal()
    if not db.query(MedicineMetadata).filter(MedicineMetadata.batch_id == "B001").first():
        db.add(MedicineMetadata(
            batch_id="B001",
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

    # 1. Manufacturer mints batch B001
    mint_res = client.post(
        "/manufacturer/mint",
        json={"batch_id": "B001", "price": 100.0},
        headers={"Authorization": f"Bearer {manu_token}"}
    )
    assert mint_res.status_code == 200, mint_res.text
    mint_data = mint_res.json()
    assert mint_data["stage"] == "mint"
    assert mint_data["batch_id"] == "B001"
    assert "verification_code" in mint_data
    dist_code = mint_data["verification_code"]
    assert len(dist_code) == 10

    # 1b. Attempt distribution with wrong verification code must fail
    wrong_dist_res = client.post(
        "/distributor/receive",
        json={"batch_id": "B001", "price": 130.0, "verification_code": "0000000000"},
        headers={"Authorization": f"Bearer {dist_token}"}
    )
    assert wrong_dist_res.status_code == 400

    # 2. Distributor receives batch B001 with valid 10-digit code
    dist_res = client.post(
        "/distributor/receive",
        json={"batch_id": "B001", "price": 130.0, "verification_code": dist_code},
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
        json={"batch_id": "B001", "price": 160.0, "verification_code": "9999999999"},
        headers={"Authorization": f"Bearer {hosp_token}"}
    )
    assert wrong_hosp_res.status_code == 400

    # 3. Hospital purchases batch B001 with valid code
    hosp_res = client.post(
        "/hospital/purchase",
        json={"batch_id": "B001", "price": 160.0, "verification_code": hosp_code},
        headers={"Authorization": f"Bearer {hosp_token}"}
    )
    assert hosp_res.status_code == 200, hosp_res.text
    hosp_data = hosp_res.json()
    assert hosp_data["stage"] == "purchase"
    assert hosp_data["owner"] == "hosp_a"

    # 4. Duplicate purchase attempt must be rejected
    dup_res = client.post(
        "/hospital/purchase",
        json={"batch_id": "B001", "price": 160.0, "verification_code": hosp_code},
        headers={"Authorization": f"Bearer {hosp_token}"}
    )
    assert dup_res.status_code == 400


def test_query_endpoints():
    # Query batch provenance
    batch_res = client.get("/query/batch/B001")
    assert batch_res.status_code == 200
    batch_data = batch_res.json()

    assert batch_data["batch_id"] == "B001"
    assert batch_data["metadata"]["drug_name"] == "Paracetamol 500mg"
    assert batch_data["metadata"]["dosage"] == "500mg"
    assert batch_data["blockchain"]["current_stage"] == "purchase"
    assert batch_data["blockchain"]["current_owner"] == "hosp_a"
    assert batch_data["blockchain"]["is_authentic"] is True
    assert batch_data["blockchain"]["chain_verified"] is True
    assert len(batch_data["blockchain"]["history"]) == 3

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
