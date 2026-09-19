"""
test_crypto.py

Tests cryptographic utilities:
- 2048-bit RSA key pair generation
- Digital signing
- Signature verification
- Tamper and wrong-key rejection
"""

import pytest
from blockchain.crypto_utils import (
    generate_key_pair,
    get_public_key_from_private,
    sign_data,
    verify_signature,
)
from blockchain.transaction import Transaction


def test_rsa_key_generation():
    private_pem, public_pem = generate_key_pair()

    assert "BEGIN PRIVATE KEY" in private_pem
    assert "BEGIN PUBLIC KEY" in public_pem

    # Deriving public key from private key should match
    derived_public = get_public_key_from_private(private_pem)
    assert derived_public == public_pem


def test_signing_and_verification():
    private_pem, public_pem = generate_key_pair()
    message = "Batch B001 - Paracetamol 500mg - Minted by manu_a"

    signature = sign_data(private_pem, message)
    assert signature is not None
    assert len(signature) > 0

    # Verification with correct public key and message
    assert verify_signature(public_pem, message, signature) is True


def test_tampered_message_rejected():
    private_pem, public_pem = generate_key_pair()
    message = "Price: 100.0"
    signature = sign_data(private_pem, message)

    # Tampered message must fail verification
    tampered_message = "Price: 1000.0"
    assert verify_signature(public_pem, tampered_message, signature) is False


def test_wrong_public_key_rejected():
    private_pem_a, _ = generate_key_pair()
    _, public_pem_b = generate_key_pair()

    message = "Authentic Transfer"
    signature = sign_data(private_pem_a, message)

    # Verifying with actor B's public key must fail
    assert verify_signature(public_pem_b, message, signature) is False


def test_transaction_sign_and_verify():
    private_pem, public_pem = generate_key_pair()

    tx = Transaction(
        batch_id="B001",
        drug_name="Paracetamol 500mg",
        from_actor="manu_a",
        to_actor="manu_a",
        price=50.0,
        stage="mint",
        actor_public_key=public_pem
    )

    assert tx.verify() is False  # Not signed yet

    tx.sign(private_pem)
    assert tx.verify() is True   # Signed and verified

    # Tampering with transaction data invalidates verification
    tx.price = 999.0
    assert tx.verify() is False
