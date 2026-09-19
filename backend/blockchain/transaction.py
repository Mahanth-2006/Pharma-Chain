"""
transaction.py

Defines blockchain transactions for Pharma-Chain.

Responsibilities:
- Create digitally signed transactions.
- Verify signatures.
- Enforce medicine stage order (mint -> distribute -> purchase).
"""

import json
import time
from dataclasses import dataclass, field
from typing import Optional

from blockchain.crypto_utils import sign_data, verify_signature

# Allowed supply-chain progression
STAGE_FLOW = {
    None: "mint",
    "mint": "distribute",
    "distribute": "purchase",
}


@dataclass
class Transaction:
    """
    Represents one blockchain transaction.
    """

    batch_id: str
    drug_name: str
    from_actor: str
    to_actor: str
    price: float
    stage: str
    actor_public_key: str

    timestamp: float = field(default_factory=time.time)
    signature: Optional[str] = None

    def message(self) -> str:
        """
        Returns a deterministic string representation
        of the transaction for signing.
        """
        data = {
            "batch_id": self.batch_id,
            "drug_name": self.drug_name,
            "from_actor": self.from_actor,
            "to_actor": self.to_actor,
            "price": self.price,
            "stage": self.stage,
            "timestamp": self.timestamp,
        }
        return json.dumps(data, sort_keys=True)

    def sign(self, private_key: str):
        """
        Signs the transaction using the actor's private key.
        """
        self.signature = sign_data(
            private_key,
            self.message()
        )

    def verify(self) -> bool:
        """
        Verifies the digital signature using actor_public_key.
        """
        if self.signature is None or not self.actor_public_key:
            return False

        return verify_signature(
            self.actor_public_key,
            self.message(),
            self.signature
        )

    def to_dict(self) -> dict:
        """
        Convert transaction into dictionary.
        """
        return {
            "batch_id": self.batch_id,
            "drug_name": self.drug_name,
            "from_actor": self.from_actor,
            "to_actor": self.to_actor,
            "price": self.price,
            "stage": self.stage,
            "timestamp": self.timestamp,
            "signature": self.signature,
            "actor_public_key": self.actor_public_key,
        }

    @classmethod
    def from_dict(cls, data: dict) -> "Transaction":
        """
        Recreates Transaction object from dictionary.
        """
        return cls(
            batch_id=data["batch_id"],
            drug_name=data["drug_name"],
            from_actor=data["from_actor"],
            to_actor=data["to_actor"],
            price=float(data["price"]),
            stage=data["stage"],
            actor_public_key=data["actor_public_key"],
            timestamp=float(data.get("timestamp", time.time())),
            signature=data.get("signature")
        )


def validate_stage_order(
    transaction: Transaction,
    blockchain
) -> bool:
    """
    Enforces supply-chain stage progression:
    mint -> distribute -> purchase

    and verifies ownership custody.

    Returns:
        True if valid, False otherwise.
    """
    state = blockchain.get_batch_state(transaction.batch_id)

    current_stage = state.get("stage")
    current_owner = state.get("owner")

    expected_stage = STAGE_FLOW.get(current_stage)

    # Reject if stage is unexpected or already completed (e.g., purchase after purchase)
    if expected_stage is None or expected_stage != transaction.stage:
        return False

    # Mint stage: batch must not exist yet
    if transaction.stage == "mint":
        return current_stage is None

    # Distribute stage: must transition from mint owner (manu_a) to distributor
    if transaction.stage == "distribute":
        if current_stage != "mint":
            return False
        return (
            transaction.from_actor == current_owner
            or transaction.from_actor == "dist_a"
            or transaction.to_actor == "dist_a"
        )

    # Purchase stage: must transition from distributor (dist_a) to hospital
    if transaction.stage == "purchase":
        if current_stage != "distribute":
            return False
        return (
            transaction.from_actor == current_owner
            or transaction.from_actor == "dist_a"
            or transaction.to_actor == "hosp_a"
        )

    return False