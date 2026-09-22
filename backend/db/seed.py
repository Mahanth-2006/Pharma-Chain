"""
seed.py

Seeds canonical demo participants with custom passwords and 20 realistic demo medicines.
"""

import os
import sys
from datetime import date
from pathlib import Path

# Add backend directory to sys.path when running as a standalone script
backend_dir = str(Path(__file__).resolve().parent.parent)
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from passlib.context import CryptContext

from blockchain.crypto_utils import (
    generate_key_pair,
    get_public_key_from_private,
    load_private_key,
)
from db.database import Base, SessionLocal, engine
from db.models import MedicineMetadata, Participant

pwd = CryptContext(schemes=["bcrypt"], deprecated="auto")

KEYS_DIR = os.path.join(
    os.path.dirname(os.path.dirname(__file__)),
    "keys"
)


def save_private_key(filename, private_key):
    os.makedirs(KEYS_DIR, exist_ok=True)
    with open(os.path.join(KEYS_DIR, filename), "w") as f:
        f.write(private_key)


def get_or_create_key_pair(filename):
    os.makedirs(KEYS_DIR, exist_ok=True)
    filepath = os.path.join(KEYS_DIR, filename)
    if os.path.exists(filepath):
        private_pem = load_private_key(filepath)
        public_pem = get_public_key_from_private(private_pem)
        return private_pem, public_pem

    private_pem, public_pem = generate_key_pair()
    save_private_key(filename, private_pem)
    return private_pem, public_pem


def seed():
    # Ensure tables exist without ever dropping existing data or blocks
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()

    # Canonical participants with required passwords
    participants = [
        ("Manufacturer A", "manufacturer", "manu_a", "mpass123", "manu_a_private.pem"),
        ("Distributor A", "distributor", "dist_a", "dpass123", "dist_a_private.pem"),
        ("Hospital A", "hospital", "hosp_a", "hpass123", "hosp_a_private.pem"),
    ]

    for name, role, username, password, key_file in participants:
        _, public = get_or_create_key_pair(key_file)

        existing = db.query(Participant).filter(Participant.username == username).first()
        if not existing:
            db.add(
                Participant(
                    name=name,
                    role=role,
                    username=username,
                    password_hash=pwd.hash(password),
                    public_key=public
                )
            )
        else:
            existing.name = name
            existing.role = role
            existing.password_hash = pwd.hash(password)
            existing.public_key = public

    # Remove all leftover fake/demo batches (B001-B020) so only user-created data exists
    db.query(MedicineMetadata).filter(MedicineMetadata.batch_id.like("B0%")).delete(synchronize_session=False)

    db.commit()
    db.close()

    print("Participants verified and updated. Cleaned demo data; only user batches will be stored.")
    print(f"RSA Keys directory: {KEYS_DIR}")


if __name__ == "__main__":
    seed()