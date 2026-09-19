"""
crypto_utils.py

Utility functions for RSA key generation, transaction signing,
and signature verification.
"""

import base64

from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding, rsa
from cryptography.exceptions import InvalidSignature
from pathlib import Path

def generate_key_pair():
    """
    Generates a 2048-bit RSA key pair.

    Returns:
        (private_key_pem, public_key_pem)
    """

    private_key = rsa.generate_private_key(
        public_exponent=65537,
        key_size=2048
    )

    public_key = private_key.public_key()

    private_pem = private_key.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.PKCS8,
        encryption_algorithm=serialization.NoEncryption()
    ).decode()

    public_pem = public_key.public_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PublicFormat.SubjectPublicKeyInfo
    ).decode()

    return private_pem, public_pem


def sign_data(private_key_pem: str, message: str) -> str:
    """
    Signs a message using the private key.

    Args:
        private_key_pem: PEM-formatted private key.
        message: String to sign.

    Returns:
        Base64-encoded signature.
    """

    private_key = serialization.load_pem_private_key(
        private_key_pem.encode(),
        password=None
    )

    signature = private_key.sign(
        message.encode(),
        padding.PSS(
            mgf=padding.MGF1(hashes.SHA256()),
            salt_length=padding.PSS.MAX_LENGTH
        ),
        hashes.SHA256()
    )

    return base64.b64encode(signature).decode()


def verify_signature(public_key_pem: str, message: str, signature: str) -> bool:
    """
    Verifies a digital signature.

    Args:
        public_key_pem: PEM-formatted public key.
        message: Original message.
        signature: Base64-encoded signature.

    Returns:
        True if valid, False otherwise.
    """

    public_key = serialization.load_pem_public_key(
        public_key_pem.encode()
    )

    try:
        public_key.verify(
            base64.b64decode(signature),
            message.encode(),
            padding.PSS(
                mgf=padding.MGF1(hashes.SHA256()),
                salt_length=padding.PSS.MAX_LENGTH
            ),
            hashes.SHA256()
        )
        return True

    except InvalidSignature:
        return False
def load_private_key(path):

    with open(Path(path), "r") as f:
        return f.read()


def get_public_key_from_private(private_key_pem: str) -> str:
    """
    Derives public key PEM from private key PEM.
    """
    private_key = serialization.load_pem_private_key(
        private_key_pem.encode(),
        password=None
    )
    public_key = private_key.public_key()
    return public_key.public_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PublicFormat.SubjectPublicKeyInfo
    ).decode()