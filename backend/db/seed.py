"""
seed.py

Seeds canonical demo participants with custom passwords and 20 realistic demo medicines.
"""

import os
from datetime import date
from pathlib import Path

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
    # Reset tables in development
    Base.metadata.drop_all(bind=engine)
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

        db.add(
            Participant(
                name=name,
                role=role,
                username=username,
                password_hash=pwd.hash(password),
                public_key=public
            )
        )

    # Exactly 20 realistic demo medicine batches (B001 to B020)
    demo_batches = [
        ("B001", "Paracetamol 500mg", "Manufacturer A", date(2026, 1, 10), date(2028, 1, 10), "Paracetamol 500mg", "500mg", "10x10 Tablets", "Analgesic / Antipyretic"),
        ("B002", "Amoxicillin 250mg", "Manufacturer A", date(2026, 1, 15), date(2028, 1, 15), "Amoxicillin Trihydrate 250mg", "250mg", "10 Capsules", "Antibiotic"),
        ("B003", "Ibuprofen 400mg", "Manufacturer A", date(2026, 2, 1), date(2028, 2, 1), "Ibuprofen 400mg", "400mg", "15 Tablets", "NSAID"),
        ("B004", "Metformin 500mg", "Manufacturer A", date(2026, 2, 5), date(2028, 2, 5), "Metformin Hydrochloride 500mg", "500mg", "20 Tablets", "Anti-diabetic"),
        ("B005", "Atorvastatin 10mg", "Manufacturer A", date(2026, 2, 10), date(2028, 2, 10), "Atorvastatin Calcium 10mg", "10mg", "10 Tablets", "Lipid-lowering"),
        ("B006", "Azithromycin 500mg", "Manufacturer A", date(2026, 2, 15), date(2028, 2, 15), "Azithromycin Dihydrate 500mg", "500mg", "3 Tablets", "Antibiotic / Macrolide"),
        ("B007", "Omeprazole 20mg", "Manufacturer A", date(2026, 2, 20), date(2028, 2, 20), "Omeprazole Magnesium 20mg", "20mg", "14 Capsules", "Proton Pump Inhibitor"),
        ("B008", "Ciprofloxacin 500mg", "Manufacturer A", date(2026, 2, 25), date(2028, 2, 25), "Ciprofloxacin Hydrochloride 500mg", "500mg", "10 Tablets", "Fluoroquinolone"),
        ("B009", "Cetirizine 10mg", "Manufacturer A", date(2026, 3, 1), date(2028, 3, 1), "Cetirizine Hydrochloride 10mg", "10mg", "10 Tablets", "Antihistamine"),
        ("B010", "Pantoprazole 40mg", "Manufacturer A", date(2026, 3, 5), date(2028, 3, 5), "Pantoprazole Sodium 40mg", "40mg", "10 Tablets", "Proton Pump Inhibitor"),
        ("B011", "Losartan 50mg", "Manufacturer A", date(2026, 3, 10), date(2028, 3, 10), "Losartan Potassium 50mg", "50mg", "15 Tablets", "Antihypertensive"),
        ("B012", "Amlodipine 5mg", "Manufacturer A", date(2026, 3, 15), date(2028, 3, 15), "Amlodipine Besylate 5mg", "5mg", "30 Tablets", "Calcium Channel Blocker"),
        ("B013", "Metoprolol 25mg", "Manufacturer A", date(2026, 3, 20), date(2028, 3, 20), "Metoprolol Tartrate 25mg", "25mg", "20 Tablets", "Beta Blocker"),
        ("B014", "Doxycycline 100mg", "Manufacturer A", date(2026, 3, 25), date(2028, 3, 25), "Doxycycline Hyclate 100mg", "100mg", "10 Capsules", "Tetracycline Antibiotic"),
        ("B015", "Clopidogrel 75mg", "Manufacturer A", date(2026, 4, 1), date(2028, 4, 1), "Clopidogrel Bisulfate 75mg", "75mg", "10 Tablets", "Antiplatelet"),
        ("B016", "Montelukast 10mg", "Manufacturer A", date(2026, 4, 5), date(2028, 4, 5), "Montelukast Sodium 10mg", "10mg", "15 Tablets", "Leukotriene Receptor Antagonist"),
        ("B017", "Gabapentin 300mg", "Manufacturer A", date(2026, 4, 10), date(2028, 4, 10), "Gabapentin 300mg", "300mg", "10 Capsules", "Anticonvulsant"),
        ("B018", "Levothyroxine 50mcg", "Manufacturer A", date(2026, 4, 15), date(2028, 4, 15), "Levothyroxine Sodium 50mcg", "50mcg", "30 Tablets", "Thyroid Hormone"),
        ("B019", "Diclofenac 50mg", "Manufacturer A", date(2026, 4, 20), date(2028, 4, 20), "Diclofenac Potassium 50mg", "50mg", "10 Tablets", "NSAID"),
        ("B020", "Amoxicillin + Clavulanate", "Manufacturer A", date(2026, 4, 25), date(2028, 4, 25), "Amoxicillin 500mg + Clavulanate 125mg", "625mg", "10 Tablets", "Antibiotic"),
    ]

    for batch_id, drug, mfg, mfg_date, exp_date, comp, dosage, pack, thermo in demo_batches:
        db.add(
            MedicineMetadata(
                batch_id=batch_id,
                drug_name=drug,
                manufacturer=mfg,
                manufacturing_date=mfg_date,
                expiry_date=exp_date,
                composition=comp,
                dosage=dosage,
                pack_size=pack,
                therapeutic_class=thermo,
            )
        )

    db.commit()
    db.close()

    print("Database seeded successfully with 3 participants and 20 medicine batches (B001 - B020).")
    print(f"RSA Keys directory: {KEYS_DIR}")


if __name__ == "__main__":
    seed()