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
    prefix="/hospital",
    tags=["Hospital"]
)


class PurchaseRequest(BaseModel):
    batch_id: str
    price: float


@router.post("/purchase")
def purchase_batch(
    request: PurchaseRequest,
    db: Session = Depends(get_db),
    user=Depends(require_role("hospital"))
):
    medicine = db.query(MedicineMetadata).filter(
        MedicineMetadata.batch_id == request.batch_id
    ).first()

    if medicine is None:
        raise HTTPException(
            status_code=404,
            detail=f"Batch {request.batch_id} not found in medicine registry."
        )

    # Validate current state on the blockchain
    state = blockchain.get_batch_state(request.batch_id)
    current_stage = state.get("stage")

    if current_stage is None:
        raise HTTPException(
            status_code=400,
            detail=f"Batch {request.batch_id} has not been minted yet."
        )

    if current_stage == "mint":
        raise HTTPException(
            status_code=400,
            detail=f"Batch {request.batch_id} must be received by a distributor before hospital purchase."
        )

    if current_stage == "purchase":
        raise HTTPException(
            status_code=400,
            detail=f"Duplicate purchase attempt rejected. Batch {request.batch_id} has already been purchased."
        )

    # Load hospital's private key for signing
    key_path = (
        Path(__file__).resolve().parent.parent
        / "keys"
        / f"{user.username}_private.pem"
    )

    if not key_path.exists():
        key_path = (
            Path(__file__).resolve().parent.parent
            / "keys"
            / "hosp_a_private.pem"
        )

    if not key_path.exists():
        raise HTTPException(
            status_code=500,
            detail="Hospital private key not found on server."
        )

    private_key = load_private_key(key_path)

    # Create and digitally sign transaction
    tx = Transaction(
        batch_id=request.batch_id,
        drug_name=medicine.drug_name,
        from_actor=state.get("owner", "dist_a"),
        to_actor=user.username,
        price=request.price,
        stage="purchase",
        actor_public_key=user.public_key
    )

    tx.sign(private_key)

    if not tx.verify():
        raise HTTPException(
            status_code=400,
            detail="Digital signature verification failed."
        )

    if not validate_stage_order(tx, blockchain):
        raise HTTPException(
            status_code=400,
            detail="Invalid stage progression for this batch."
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
        "message": "Batch purchased by hospital successfully.",
        "batch_id": request.batch_id,
        "block_height": new_block.index,
        "block_hash": new_block.hash,
        "validator": new_block.validator,
        "stage": "purchase",
        "owner": user.username,
        "price": request.price
    }
