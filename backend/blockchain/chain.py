"""
chain.py

Manages the Pharma-Chain blockchain.

Responsibilities:
- Create the Genesis Block.
- Add validated blocks under Proof of Authority.
- Verify blockchain integrity and detect tampering via SHA-256 re-hashing.
- Persist and restore blockchain state from PostgreSQL blockchain_snapshot.
"""

import json
from typing import List, Optional

from blockchain.block import Block
from blockchain.consensus import ProofOfAuthority


class Blockchain:
    """
    Represents the complete Pharma-Chain blockchain.
    """

    def __init__(self, validators: List[str]):
        self.consensus = ProofOfAuthority(validators)
        self.chain: List[Block] = [self.create_genesis_block()]

    def create_genesis_block(self) -> Block:
        """
        Creates the deterministic Genesis block.

        Returns:
            Genesis Block.
        """
        return Block(
            index=0,
            previous_hash="0",
            validator="GENESIS",
            transactions=[],
            timestamp=0.0
        )

    def get_latest_block(self) -> Block:
        """
        Returns the newest block in the chain.
        """
        return self.chain[-1]

    def get_batch_state(self, batch_id: str) -> dict:
        """
        Returns the current state and owner of a medicine batch by scanning the chain.
        """
        current_stage = None
        current_owner = None

        for block in self.chain:
            for tx in block.transactions:
                tx_batch = tx.batch_id if hasattr(tx, "batch_id") else tx.get("batch_id")

                if tx_batch != batch_id:
                    continue

                current_stage = tx.stage if hasattr(tx, "stage") else tx.get("stage")
                current_owner = tx.to_actor if hasattr(tx, "to_actor") else tx.get("to_actor")

        return {
            "batch_id": batch_id,
            "stage": current_stage,
            "owner": current_owner,
        }

    def get_batch_history(self, batch_id: str) -> List[dict]:
        """
        Retrieves full chronological history of all transactions for a specific batch.
        """
        history = []
        for block in self.chain:
            for tx in block.transactions:
                tx_batch = tx.batch_id if hasattr(tx, "batch_id") else tx.get("batch_id")
                if tx_batch == batch_id:
                    tx_dict = tx.to_dict() if hasattr(tx, "to_dict") else dict(tx)
                    tx_dict["block_index"] = block.index
                    tx_dict["block_hash"] = block.hash
                    tx_dict["previous_hash"] = block.previous_hash
                    tx_dict["validator"] = block.validator
                    tx_dict["block_timestamp"] = block.timestamp
                    history.append(tx_dict)
        return history

    def add_block(self, validator: str, transactions: list, db=None) -> Block:
        """
        Adds a new block after PoA and transaction signature verification.
        Optionally persists the block to PostgreSQL snapshot.
        """
        latest = self.get_latest_block()
        next_index = latest.index + 1

        # Validator must exist in authorized list
        if not self.consensus.is_authorized(validator):
            raise ValueError(f"Unauthorized validator: {validator}")

        # Validator must match expected round-robin turn
        if not self.consensus.validate_validator(next_index, validator):
            expected = self.consensus.get_expected_validator(next_index)
            raise ValueError(
                f"Validator turn mismatch for block {next_index}. Expected: {expected}, got: {validator}"
            )

        serialized_txs = []
        for tx in transactions:
            if hasattr(tx, "verify"):
                if not tx.verify():
                    raise ValueError("Invalid transaction signature.")
                serialized_txs.append(tx.to_dict())
            elif isinstance(tx, dict):
                serialized_txs.append(tx)
            else:
                raise ValueError("Unsupported transaction format.")

        block = Block(
            index=next_index,
            previous_hash=latest.hash,
            validator=validator,
            transactions=serialized_txs
        )

        self.chain.append(block)

        if db is not None:
            self.save_block_to_db(db, block)

        return block

    def is_chain_valid(self) -> bool:
        """
        Validates the entire blockchain:
        1. Recalculates SHA-256 hash for each block and compares against stored hash.
        2. Verifies previous_hash cryptographic linkage.
        """
        for i in range(1, len(self.chain)):
            current = self.chain[i]
            previous = self.chain[i - 1]

            # Recalculate block hash
            if current.hash != current.calculate_hash():
                print(f"Tampering detected in Block {current.index}: hash mismatch.")
                return False

            # Verify cryptographic link
            if current.previous_hash != previous.hash:
                print(
                    f"Broken chain between Block {previous.index} and Block {current.index}: "
                    f"previous_hash mismatch."
                )
                return False

            # Verify Proof of Authority consensus validator turn
            if not self.consensus.validate_validator(current.index, current.validator):
                print(
                    f"Consensus fault in Block {current.index}: invalid validator {current.validator}."
                )
                return False

        return True

    def save_block_to_db(self, db, block: Block):
        """
        Persists a block into PostgreSQL blockchain_snapshot.
        """
        from db.models import BlockchainSnapshot

        # Determine batch_id from transactions if present
        batch_id = None
        if block.transactions:
            batch_id = block.transactions[0].get("batch_id")

        existing = db.query(BlockchainSnapshot).filter(
            BlockchainSnapshot.block_index == block.index
        ).first()

        if existing:
            existing.block_hash = block.hash
            existing.previous_hash = block.previous_hash
            existing.validator = block.validator
            existing.timestamp = block.timestamp
            existing.transactions = json.dumps(block.transactions)
            existing.batch_id = batch_id
        else:
            snapshot = BlockchainSnapshot(
                block_index=block.index,
                block_hash=block.hash,
                previous_hash=block.previous_hash,
                validator=block.validator,
                timestamp=block.timestamp,
                transactions=json.dumps(block.transactions),
                batch_id=batch_id
            )
            db.add(snapshot)

        db.commit()

    def load_chain_from_db(self, db):
        """
        Restores blockchain from PostgreSQL blockchain_snapshot on startup.
        Preserves original timestamps, hashes, signatures, and verifies integrity.
        """
        from db.models import BlockchainSnapshot

        snapshots = db.query(BlockchainSnapshot).order_by(
            BlockchainSnapshot.block_index.asc()
        ).all()

        if not snapshots:
            # First run: persist Genesis block so DB has block 0
            genesis = self.chain[0]
            self.save_block_to_db(db, genesis)
            return

        restored_chain: List[Block] = []
        for row in snapshots:
            txs = json.loads(row.transactions)
            block = Block.from_dict({
                "index": row.block_index,
                "previous_hash": row.previous_hash,
                "validator": row.validator,
                "transactions": txs,
                "timestamp": row.timestamp
            })
            restored_chain.append(block)

        self.chain = restored_chain
        print(f"Restored {len(self.chain)} blocks from database. Chain valid: {self.is_chain_valid()}")

    def to_dict(self) -> List[dict]:
        """
        Returns blockchain as JSON-friendly list of blocks.
        """
        return [block.to_dict() for block in self.chain]


# Shared blockchain instance for the backend
blockchain = Blockchain(
    validators=[
        "manu_a",
        "dist_a",
        "hosp_a"
    ]
)