"""
test_stage_validation.py

Tests supply chain stage progression:
- Allowed: None -> mint -> distribute -> purchase
- Rejection of out-of-order stage transitions
- Rejection of duplicate purchases
"""

import pytest
from blockchain.chain import Blockchain
from blockchain.crypto_utils import generate_key_pair
from blockchain.transaction import Transaction, validate_stage_order


@pytest.fixture
def keys():
    priv_m, pub_m = generate_key_pair()
    priv_d, pub_d = generate_key_pair()
    priv_h, pub_h = generate_key_pair()
    return {
        "manu": (priv_m, pub_m),
        "dist": (priv_d, pub_d),
        "hosp": (priv_h, pub_h),
    }


def test_valid_supply_chain_flow(keys):
    chain = Blockchain(validators=["manu_a", "dist_a", "hosp_a"])

    # 1. Mint stage
    tx_mint = Transaction(
        batch_id="B001",
        drug_name="Paracetamol 500mg",
        from_actor="manu_a",
        to_actor="manu_a",
        price=50.0,
        stage="mint",
        actor_public_key=keys["manu"][1]
    )
    tx_mint.sign(keys["manu"][0])
    assert validate_stage_order(tx_mint, chain) is True
    chain.add_block("manu_a", [tx_mint])

    # 2. Distribute stage
    tx_dist = Transaction(
        batch_id="B001",
        drug_name="Paracetamol 500mg",
        from_actor="manu_a",
        to_actor="dist_a",
        price=65.0,
        stage="distribute",
        actor_public_key=keys["dist"][1]
    )
    tx_dist.sign(keys["dist"][0])
    assert validate_stage_order(tx_dist, chain) is True
    chain.add_block("dist_a", [tx_dist])

    # 3. Purchase stage
    tx_purch = Transaction(
        batch_id="B001",
        drug_name="Paracetamol 500mg",
        from_actor="dist_a",
        to_actor="hosp_a",
        price=80.0,
        stage="purchase",
        actor_public_key=keys["hosp"][1]
    )
    tx_purch.sign(keys["hosp"][0])
    assert validate_stage_order(tx_purch, chain) is True
    chain.add_block("hosp_a", [tx_purch])

    # Chain should be valid
    assert chain.is_chain_valid() is True

    # State of B001 should be purchase
    state = chain.get_batch_state("B001")
    assert state["stage"] == "purchase"
    assert state["owner"] == "hosp_a"


def test_reject_skipping_stages(keys):
    chain = Blockchain(validators=["manu_a", "dist_a", "hosp_a"])

    # Attempt to distribute before minting
    tx_dist = Transaction(
        batch_id="B002",
        drug_name="Amoxicillin 250mg",
        from_actor="manu_a",
        to_actor="dist_a",
        price=65.0,
        stage="distribute",
        actor_public_key=keys["dist"][1]
    )
    tx_dist.sign(keys["dist"][0])
    assert validate_stage_order(tx_dist, chain) is False

    # Mint B002
    tx_mint = Transaction(
        batch_id="B002",
        drug_name="Amoxicillin 250mg",
        from_actor="manu_a",
        to_actor="manu_a",
        price=50.0,
        stage="mint",
        actor_public_key=keys["manu"][1]
    )
    tx_mint.sign(keys["manu"][0])
    chain.add_block("manu_a", [tx_mint])

    # Attempt to jump straight to purchase without distribute
    tx_purch = Transaction(
        batch_id="B002",
        drug_name="Amoxicillin 250mg",
        from_actor="dist_a",
        to_actor="hosp_a",
        price=80.0,
        stage="purchase",
        actor_public_key=keys["hosp"][1]
    )
    tx_purch.sign(keys["hosp"][0])
    assert validate_stage_order(tx_purch, chain) is False


def test_reject_duplicate_purchase(keys):
    chain = Blockchain(validators=["manu_a", "dist_a", "hosp_a"])

    # Setup B003 through mint -> distribute -> purchase
    tx_mint = Transaction("B003", "Ibuprofen 400mg", "manu_a", "manu_a", 40.0, "mint", keys["manu"][1])
    tx_mint.sign(keys["manu"][0])
    chain.add_block("manu_a", [tx_mint])

    tx_dist = Transaction("B003", "Ibuprofen 400mg", "manu_a", "dist_a", 55.0, "distribute", keys["dist"][1])
    tx_dist.sign(keys["dist"][0])
    chain.add_block("dist_a", [tx_dist])

    tx_purch = Transaction("B003", "Ibuprofen 400mg", "dist_a", "hosp_a", 70.0, "purchase", keys["hosp"][1])
    tx_purch.sign(keys["hosp"][0])
    chain.add_block("hosp_a", [tx_purch])

    # Attempt duplicate purchase
    duplicate_purch = Transaction("B003", "Ibuprofen 400mg", "dist_a", "hosp_a", 70.0, "purchase", keys["hosp"][1])
    duplicate_purch.sign(keys["hosp"][0])
    assert validate_stage_order(duplicate_purch, chain) is False
