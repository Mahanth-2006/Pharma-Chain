"""
consensus.py

Proof of Authority (PoA) implementation for Pharma-Chain.

Responsibilities:
- Maintain authorized validators.
- Rotate validator turns in round-robin order.
- Verify whose turn it is to create the next block.
"""

from typing import List


class ProofOfAuthority:
    """
    Round-robin Proof of Authority consensus mechanism.
    """

    def __init__(self, validators: List[str]):
        if not validators:
            raise ValueError("At least one validator is required.")

        self.validators = validators

    def get_expected_validator(self, block_index: int) -> str:
        """
        Returns the validator whose turn it is for the given block index.

        """
        if block_index <= 0:
            return "GENESIS"

        return self.validators[(block_index - 1) % len(self.validators)]

    def validate_validator(self, block_index: int, validator: str) -> bool:
        """
        Checks whether the supplied validator is allowed to seal this block.

        """
        if block_index == 0:
            return validator == "GENESIS"

        return validator == self.get_expected_validator(block_index)

    def is_authorized(self, validator: str) -> bool:
        """
        Checks whether a validator exists in the authority list.
        """
        return validator in self.validators or validator == "GENESIS"