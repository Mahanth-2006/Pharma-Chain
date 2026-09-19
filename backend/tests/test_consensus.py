"""
test_consensus.py

Tests Proof of Authority (PoA) consensus mechanism:
- Round-robin validator rotation
- Authorized validator validation
- Out-of-turn rejection
"""

import pytest
from blockchain.consensus import ProofOfAuthority
from blockchain.chain import Blockchain


def test_validator_rotation():
    validators = ["manu_a", "dist_a", "hosp_a"]
    poa = ProofOfAuthority(validators)

    # Genesis block is index 0
    assert poa.get_expected_validator(0) == "GENESIS"

    # Block 1, 2, 3 should rotate round-robin
    assert poa.get_expected_validator(1) == "manu_a"
    assert poa.get_expected_validator(2) == "dist_a"
    assert poa.get_expected_validator(3) == "hosp_a"
    assert poa.get_expected_validator(4) == "manu_a"
    assert poa.get_expected_validator(5) == "dist_a"


def test_is_authorized():
    poa = ProofOfAuthority(["manu_a", "dist_a", "hosp_a"])
    assert poa.is_authorized("manu_a") is True
    assert poa.is_authorized("dist_a") is True
    assert poa.is_authorized("hosp_a") is True
    assert poa.is_authorized("attacker_x") is False


def test_out_of_turn_rejection():
    chain = Blockchain(validators=["manu_a", "dist_a", "hosp_a"])

    # Block 1 expected validator is manu_a
    with pytest.raises(ValueError, match="Validator turn mismatch"):
        chain.add_block(
            validator="hosp_a",
            transactions=[{"batch_id": "B001", "stage": "mint"}]
        )

    # Unauthorized validator
    with pytest.raises(ValueError, match="Unauthorized validator"):
        chain.add_block(
            validator="rogue_node",
            transactions=[{"batch_id": "B001", "stage": "mint"}]
        )
