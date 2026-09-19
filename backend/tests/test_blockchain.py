"""
test_blockchain.py

Tests core blockchain functionality:
- SHA-256 block hashing
- Genesis block structure
- Chain addition and previous_hash linking
- Tamper detection
"""

import pytest
from blockchain.block import Block
from blockchain.chain import Blockchain


def test_genesis_block():
    chain = Blockchain(validators=["manu_a", "dist_a", "hosp_a"])
    genesis = chain.chain[0]

    assert genesis.index == 0
    assert genesis.previous_hash == "0"
    assert genesis.validator == "GENESIS"
    assert genesis.transactions == []
    assert genesis.hash == genesis.calculate_hash()
    assert chain.is_chain_valid() is True


def test_block_hashing():
    block = Block(
        index=1,
        previous_hash="abc",
        validator="manu_a",
        transactions=[{"batch_id": "B001", "stage": "mint"}],
        timestamp=1000.0
    )
    expected_hash = block.calculate_hash()
    assert block.hash == expected_hash
    assert len(block.hash) == 64  # Hexadecimal SHA-256 length


def test_chain_linkage():
    chain = Blockchain(validators=["manu_a", "dist_a", "hosp_a"])
    block1 = chain.add_block(
        validator="manu_a",
        transactions=[{"batch_id": "B001", "stage": "mint", "to_actor": "manu_a"}]
    )
    assert block1.index == 1
    assert block1.previous_hash == chain.chain[0].hash
    assert chain.is_chain_valid() is True

    block2 = chain.add_block(
        validator="dist_a",
        transactions=[{"batch_id": "B001", "stage": "distribute", "to_actor": "dist_a"}]
    )
    assert block2.index == 2
    assert block2.previous_hash == block1.hash
    assert chain.is_chain_valid() is True


def test_tamper_detection_transaction_payload():
    chain = Blockchain(validators=["manu_a", "dist_a", "hosp_a"])
    chain.add_block(
        validator="manu_a",
        transactions=[{"batch_id": "B001", "price": 100.0, "stage": "mint"}]
    )
    assert chain.is_chain_valid() is True

    # Tamper with block transaction without updating block hash
    chain.chain[1].transactions[0]["price"] = 9999.0
    assert chain.is_chain_valid() is False


def test_tamper_detection_previous_hash_break():
    chain = Blockchain(validators=["manu_a", "dist_a", "hosp_a"])
    chain.add_block(
        validator="manu_a",
        transactions=[{"batch_id": "B001", "stage": "mint"}]
    )
    chain.add_block(
        validator="dist_a",
        transactions=[{"batch_id": "B001", "stage": "distribute"}]
    )
    assert chain.is_chain_valid() is True

    # Tamper with previous_hash link
    chain.chain[2].previous_hash = "fake_previous_hash"
    assert chain.is_chain_valid() is False
