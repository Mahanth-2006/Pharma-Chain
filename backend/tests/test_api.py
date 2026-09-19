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

    # 2. Distributor receives batch B001
    dist_res = client.post(
        "/distributor/receive",
        json={"batch_id": "B001", "price": 130.0},
        headers={"Authorization": f"Bearer {dist_token}"}
    )
    assert dist_res.status_code == 200, dist_res.text
    dist_data = dist_res.json()
    assert dist_data["stage"] == "distribute"
    assert dist_data["owner"] == "dist_a"

    # 3. Hospital purchases batch B001
    hosp_res = client.post(
        "/hospital/purchase",
        json={"batch_id": "B001", "price": 160.0},
        headers={"Authorization": f"Bearer {hosp_token}"}
    )
    assert hosp_res.status_code == 200, hosp_res.text
    hosp_data = hosp_res.json()
    assert hosp_data["stage"] == "purchase"
    assert hosp_data["owner"] == "hosp_a"

    # 4. Duplicate purchase attempt must be rejected
    dup_res = client.post(
        "/hospital/purchase",
        json={"batch_id": "B001", "price": 160.0},
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
    assert batches_data["total"] == 20
    assert any(b["batch_id"] == "B001" and b["stage"] == "purchase" for b in batches_data["batches"])
