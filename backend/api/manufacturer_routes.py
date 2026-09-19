from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from api.auth import get_current_user
from blockchain.chain import blockchain
from blockchain.crypto_utils import load_private_key
from blockchain.transaction import (
    Transaction,
    validate_stage_order,
)
from db.database import get_db
from db.models import MedicineMetadata
from middleware.role_guard import require_role

router = APIRouter(
    prefix="/manufacturer",
    tags=["Manufacturer"]
)


class MintRequest(BaseModel):
    batch_id: str
    price: float


@router.post("/mint")
def mint_batch(
    request: MintRequest,
    db: Session = Depends(get_db),
    user=Depends(require_role("manufacturer"))
):
    medicine = db.query(MedicineMetadata).filter(
        MedicineMetadata.batch_id == request.batch_id
    ).first()

    if medicine is None:
        raise HTTPException(
            status_code=404,
            detail=f"Batch {request.batch_id} not found in medicine registry."
        )

    # Check if batch has already been minted
    current_state = blockchain.get_batch_state(request.batch_id)
    if current_state.get("stage") is not None:
        raise HTTPException(
            status_code=400,
            detail=f"Batch {request.batch_id} has already been minted (current stage: {current_state.get('stage')})."
        )

    key_path = (
        Path(__file__).resolve().parent.parent
        / "keys"
        / f"{user.username}_private.pem"
    )

    if not key_path.exists():
        key_path = (
            Path(__file__).resolve().parent.parent
            / "keys"
            / "manu_a_private.pem"
        )

    if not key_path.exists():
        raise HTTPException(
            status_code=500,
            detail="Manufacturer private key not found on server."
        )

    private_key = load_private_key(key_path)

    tx = Transaction(
        batch_id=request.batch_id,
        drug_name=medicine.drug_name,
        from_actor=user.username,
        to_actor=user.username,
        price=request.price,
        stage="mint",
        actor_public_key=user.public_key
    )

    tx.sign(private_key)

    if not tx.verify():
        raise HTTPException(
            status_code=400,
            detail="Signature verification failed."
        )

    if not validate_stage_order(tx, blockchain):
        raise HTTPException(
            status_code=400,
            detail="Invalid stage transition for this batch."
        )

    validator = blockchain.consensus.get_expected_validator(
        len(blockchain.chain)
    )

    new_block = blockchain.add_block(
        validator,
        [tx],
        db=db
    )

    return {
        "message": "Batch minted successfully.",
        "batch_id": request.batch_id,
        "block_height": new_block.index,
        "block_hash": new_block.hash,
        "validator": new_block.validator,
        "stage": "mint",
        "price": request.price,
    }