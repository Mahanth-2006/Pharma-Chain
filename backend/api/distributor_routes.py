from pathlib import Path
import secrets
from typing import Optional

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
from db.models import BatchVerification, MedicineMetadata
from middleware.role_guard import require_role

router = APIRouter(
    prefix="/distributor",
    tags=["Distributor"]
)


class ReceiveRequest(BaseModel):
    batch_id: str
    price: Optional[float] = None
    verification_code: Optional[str] = None


@router.post("/receive")
def receive_batch(
    request: ReceiveRequest,
    db: Session = Depends(get_db),
    user=Depends(require_role("distributor"))
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
            detail=f"Batch {request.batch_id} must be minted before it can be distributed."
        )

    if current_stage == "purchase":
        raise HTTPException(
            status_code=400,
            detail=f"Batch {request.batch_id} has already been purchased by a hospital."
        )

    if current_stage == "distribute":
        raise HTTPException(
            status_code=400,
            detail=f"Batch {request.batch_id} has already been received and distributed."
        )

    # Validate 10-digit proof of transaction verification code
    if not request.verification_code:
        raise HTTPException(
            status_code=400,
            detail="10-digit proof-of-transaction verification code is required."
        )

    v_record = db.query(BatchVerification).filter(
        BatchVerification.batch_id == request.batch_id,
        BatchVerification.stage == "distribute",
        BatchVerification.is_used == False
    ).order_by(BatchVerification.id.desc()).first()

    if not v_record or v_record.code != request.verification_code.strip():
        raise HTTPException(
            status_code=400,
            detail="Invalid 10-digit verification code. Custody transfer rejected."
        )

    # Determine transfer price
    history = blockchain.get_batch_history(request.batch_id)
    previous_price = history[-1].get("price", 0.0) if history else 0.0
    transfer_price = request.price if request.price is not None else previous_price

    # Load distributor's private key for signing
    key_path = (
        Path(__file__).resolve().parent.parent
        / "keys"
        / f"{user.username}_private.pem"
    )

    if not key_path.exists():
        key_path = (
            Path(__file__).resolve().parent.parent
            / "keys"
            / "dist_a_private.pem"
        )

    if not key_path.exists():
        raise HTTPException(
            status_code=500,
            detail="Distributor private key not found on server."
        )

    private_key = load_private_key(key_path)

    # Create and digitally sign the transaction
    tx = Transaction(
        batch_id=request.batch_id,
        drug_name=medicine.drug_name,
        from_actor=state.get("owner", "manu_a"),
        to_actor=user.username,
        price=transfer_price,
        stage="distribute",
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

    # Mark distributor verification code as consumed
    v_record.is_used = True

    # Generate next 10-digit code for hospital
    hospital_code = str(secrets.randbelow(9000000000) + 1000000000)
    db.add(
        BatchVerification(
            batch_id=request.batch_id,
            stage="purchase",
            code=hospital_code,
            is_used=False
        )
    )
    db.commit()

    return {
        "message": "Batch received and distributed successfully.",
        "batch_id": request.batch_id,
        "block_height": new_block.index,
        "block_hash": new_block.hash,
        "validator": new_block.validator,
        "stage": "distribute",
        "owner": user.username,
        "price": transfer_price,
        "hospital_verification_code": hospital_code
    }
