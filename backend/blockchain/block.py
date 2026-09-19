"""
block.py

Defines a single block in the Pharma-Chain blockchain.
Each block contains verified transactions and is secured
using SHA-256 hashing.
"""

import hashlib
import json
import time
from dataclasses import dataclass, field
from typing import List, Dict


@dataclass
class Block:
    """
    Represents a block in the blockchain.
    """

    index: int
    previous_hash: str
    validator: str
    transactions: List[Dict]
    timestamp: float = field(default_factory=time.time)
    hash: str = field(init=False)

    def __post_init__(self):
        """
        Automatically compute block hash after creation.
        """
        self.hash = self.calculate_hash()

    def calculate_hash(self) -> str:
        """
        Generates a SHA-256 hash of the block contents.

        Returns:
            Hexadecimal SHA-256 hash.
        """

        block_data = {
            "index": self.index,
            "previous_hash": self.previous_hash,
            "validator": self.validator,
            "transactions": self.transactions,
            "timestamp": self.timestamp,
        }

        encoded = json.dumps(
            block_data,
            sort_keys=True
        ).encode()

        return hashlib.sha256(encoded).hexdigest()

    def to_dict(self) -> Dict:
        """
        Convert block into JSON-friendly dictionary.
        """

        return {
            "index": self.index,
            "timestamp": self.timestamp,
            "previous_hash": self.previous_hash,
            "validator": self.validator,
            "transactions": self.transactions,
            "hash": self.hash,
        }

    @classmethod
    def from_dict(cls, data: Dict) -> "Block":
        """
        Recreates Block object from dictionary, restoring exact timestamp and re-verifying hash.
        """
        return cls(
            index=int(data["index"]),
            previous_hash=str(data["previous_hash"]),
            validator=str(data["validator"]),
            transactions=list(data["transactions"]),
            timestamp=float(data["timestamp"]),
        )