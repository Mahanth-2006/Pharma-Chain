from datetime import date
from pathlib import Path
import secrets
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.orm import Session

from api.auth import get_current_user
from blockchain.chain import blockchain
from blockchain.crypto_utils import load_private_key
from blockchain.transaction import Transaction, validate_stage_order
from db.database import get_db
from db.models import BatchVerification, MedicineMetadata

router = APIRouter(tags=["Frontend Compatibility"])


@router.post("/batches/mint")
async def compat_mint(
    request: Request,
    db: Session = Depends(get_db),
    user=Depends(get_current_user)
):
    body = await request.json()
    batch_id = str(body.get("batch_id") or body.get("batchId") or body.get("batchNumber") or "").strip()
    medicine_name = str(body.get("medicine_name") or body.get("medicineName") or body.get("product") or body.get("drug_name") or "").strip()
    dosage = str(body.get("dosage") or "").strip()
    manufacture_date_str = body.get("manufacture_date") or body.get("manufactureDate")
    expiry_date_str = body.get("expiry_date") or body.get("expiryDate")
    price = float(body.get("price", 100.0))

    if not batch_id:
        raise HTTPException(status_code=400, detail="Batch ID is required.")
    if not medicine_name:
        raise HTTPException(status_code=400, detail="Medicine Name is required.")
    if not dosage:
        raise HTTPException(status_code=400, detail="Dosage is required.")
    if not manufacture_date_str:
        raise HTTPException(status_code=400, detail="Manufacture Date is required.")
    if not expiry_date_str:
        raise HTTPException(status_code=400, detail="Expiry Date is required.")

    # Check for duplicate Batch ID
    existing_med = db.query(MedicineMetadata).filter(MedicineMetadata.batch_id == batch_id).first()
    state = blockchain.get_batch_state(batch_id)
    if existing_med or state.get("stage") is not None:
        raise HTTPException(
            status_code=400,
            detail=f"Batch ID '{batch_id}' already exists. Duplicate Batch IDs are not allowed."
        )

    try:
        mfg_date = date.fromisoformat(str(manufacture_date_str))
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid Manufacture Date (format must be YYYY-MM-DD).")

    try:
        exp_date = date.fromisoformat(str(expiry_date_str))
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid Expiry Date (format must be YYYY-MM-DD).")

    if exp_date <= mfg_date:
        raise HTTPException(status_code=400, detail="Expiry Date must be after Manufacture Date.")

    medicine = MedicineMetadata(
        batch_id=batch_id,
        drug_name=medicine_name,
        manufacturer="Manufacturer A",
        manufacturing_date=mfg_date,
        expiry_date=exp_date,
        composition=medicine_name,
        dosage=dosage,
        pack_size=dosage,
        therapeutic_class="Pharmaceutical"
    )
    db.add(medicine)
    db.commit()
    db.refresh(medicine)

    key_path = Path(__file__).resolve().parent.parent / "keys" / "manu_a_private.pem"
    private_key = load_private_key(key_path)

    tx = Transaction(
        batch_id=batch_id,
        drug_name=medicine_name,
        from_actor="manu_a",
        to_actor="manu_a",
        price=price,
        stage="mint",
        actor_public_key=user.public_key
    )
    tx.sign(private_key)

    if not tx.verify():
        raise HTTPException(status_code=400, detail="Signature verification failed.")

    validator = blockchain.consensus.get_expected_validator(len(blockchain.chain))
    block = blockchain.add_block(validator, [tx], db=db)

    # Generate a unique 10-digit numeric proof of transaction code for distributor handoff
    distributor_code = str(secrets.randbelow(9000000000) + 1000000000)
    db.add(
        BatchVerification(
            batch_id=batch_id,
            stage="distribute",
            code=distributor_code,
            is_used=False
        )
    )
    db.commit()

    return {
        "success": True,
        "message": "Medicine batch successfully minted to the blockchain.",
        "batchId": batch_id,
        "blockHeight": block.index,
        "blockHash": block.hash,
        "previousHash": block.previous_hash,
        "validator": block.validator,
        "timestamp": block.timestamp,
        "verification_code": distributor_code,
        "stage": "mint"
    }


@router.post("/batches/distribution")
async def compat_distribute(
    request: Request,
    db: Session = Depends(get_db),
    user=Depends(get_current_user)
):
    body = await request.json()
    batch_id = str(body.get("batchId") or body.get("batch_id") or "").strip()
    verification_code = str(body.get("verification_code") or body.get("verificationCode") or body.get("code") or "").strip()
    price = float(body.get("price", 125.0))

    if not batch_id:
        raise HTTPException(status_code=400, detail="Batch ID is required.")

    if not verification_code:
        raise HTTPException(
            status_code=400,
            detail="10-digit proof of transaction verification code from Manufacturer is required."
        )

    medicine = db.query(MedicineMetadata).filter(MedicineMetadata.batch_id == batch_id).first()
    if not medicine:
        raise HTTPException(status_code=404, detail=f"Batch '{batch_id}' not found in registry.")

    state = blockchain.get_batch_state(batch_id)
    current_stage = state.get("stage")

    if current_stage is None:
        raise HTTPException(status_code=400, detail=f"Batch '{batch_id}' has not been minted yet.")

    if current_stage != "mint":
        raise HTTPException(
            status_code=400,
            detail=f"Batch '{batch_id}' is at stage '{current_stage}' and cannot be distributed. Must be in 'mint' stage."
        )

    # Verify 10-digit code generated during minting
    v_record = db.query(BatchVerification).filter(
        BatchVerification.batch_id == batch_id,
        BatchVerification.stage == "distribute",
        BatchVerification.is_used == False
    ).order_by(BatchVerification.id.desc()).first()

    if not v_record or v_record.code != verification_code:
        raise HTTPException(
            status_code=400,
            detail="Invalid 10-digit verification code. Custody transfer rejected."
        )

    key_path = Path(__file__).resolve().parent.parent / "keys" / "dist_a_private.pem"
    if not key_path.exists():
        raise HTTPException(status_code=500, detail="Distributor private key not found on server.")
    private_key = load_private_key(key_path)

    tx = Transaction(
        batch_id=batch_id,
        drug_name=medicine.drug_name,
        from_actor=state.get("owner", "manu_a"),
        to_actor="dist_a",
        price=price,
        stage="distribute",
        actor_public_key=user.public_key
    )
    tx.sign(private_key)

    if not tx.verify():
        raise HTTPException(status_code=400, detail="Digital signature verification failed.")

    if not validate_stage_order(tx, blockchain):
        raise HTTPException(status_code=400, detail="Invalid stage progression for this batch.")

    validator = blockchain.consensus.get_expected_validator(len(blockchain.chain))
    block = blockchain.add_block(validator, [tx], db=db)

    # Mark distributor verification code as consumed
    v_record.is_used = True

    # Generate next 10-digit verification code for Hospital handoff
    hospital_code = str(secrets.randbelow(9000000000) + 1000000000)
    db.add(
        BatchVerification(
            batch_id=batch_id,
            stage="purchase",
            code=hospital_code,
            is_used=False
        )
    )
    db.commit()

    return {
        "success": True,
        "message": "Distribution sealed successfully with digital signature.",
        "batchId": batch_id,
        "blockHeight": block.index,
        "blockHash": block.hash,
        "previousHash": block.previous_hash,
        "validator": block.validator,
        "timestamp": block.timestamp,
        "stage": "distribute",
        "hospital_verification_code": hospital_code
    }


@router.post("/batches/purchase")
async def compat_purchase(
    request: Request,
    db: Session = Depends(get_db),
    user=Depends(get_current_user)
):
    body = await request.json()
    batch_id = str(body.get("batchId") or body.get("batch_id") or "").strip()
    verification_code = str(body.get("verification_code") or body.get("verificationCode") or body.get("code") or "").strip()
    price = float(body.get("price", 150.0))

    if not batch_id:
        raise HTTPException(status_code=400, detail="Batch ID is required.")

    if not verification_code:
        raise HTTPException(
            status_code=400,
            detail="10-digit proof of transaction verification code from Distributor is required."
        )

    medicine = db.query(MedicineMetadata).filter(MedicineMetadata.batch_id == batch_id).first()
    if not medicine:
        raise HTTPException(status_code=404, detail=f"Batch '{batch_id}' not found in registry.")

    state = blockchain.get_batch_state(batch_id)
    current_stage = state.get("stage")

    if current_stage != "distribute":
        raise HTTPException(
            status_code=400,
            detail=f"Batch '{batch_id}' is currently at stage '{current_stage}'. Only batches in 'distribute' stage can be purchased/dispensed."
        )

    # Verify 10-digit code generated during distribution
    v_record = db.query(BatchVerification).filter(
        BatchVerification.batch_id == batch_id,
        BatchVerification.stage == "purchase",
        BatchVerification.is_used == False
    ).order_by(BatchVerification.id.desc()).first()

    if not v_record or v_record.code != verification_code:
        raise HTTPException(
            status_code=400,
            detail="Invalid 10-digit verification code from Distributor. Purchase rejected."
        )

    key_path = Path(__file__).resolve().parent.parent / "keys" / "hosp_a_private.pem"
    if not key_path.exists():
        raise HTTPException(status_code=500, detail="Hospital private key not found on server.")
    private_key = load_private_key(key_path)

    tx = Transaction(
        batch_id=batch_id,
        drug_name=medicine.drug_name,
        from_actor=state.get("owner", "dist_a"),
        to_actor="hosp_a",
        price=price,
        stage="purchase",
        actor_public_key=user.public_key
    )
    tx.sign(private_key)

    if not tx.verify():
        raise HTTPException(status_code=400, detail="Digital signature verification failed.")

    if not validate_stage_order(tx, blockchain):
        raise HTTPException(status_code=400, detail="Invalid stage progression for this batch.")

    validator = blockchain.consensus.get_expected_validator(len(blockchain.chain))
    block = blockchain.add_block(validator, [tx], db=db)

    # Mark hospital verification code as consumed
    v_record.is_used = True
    db.commit()

    return {
        "success": True,
        "message": "Purchase verified and recorded on blockchain.",
        "batchId": batch_id,
        "blockHeight": block.index,
        "blockHash": block.hash,
        "previousHash": block.previous_hash,
        "validator": block.validator,
        "timestamp": block.timestamp,
        "stage": "purchase"
    }


@router.get("/batches/{batch_id}/verification-code")
def get_verification_code(
    batch_id: str,
    db: Session = Depends(get_db),
    user=Depends(get_current_user)
):
    state = blockchain.get_batch_state(batch_id)
    current_stage = state.get("stage")
    if not current_stage:
        raise HTTPException(status_code=404, detail=f"Batch '{batch_id}' not found on blockchain.")

    target_stage = "distribute" if current_stage == "mint" else "purchase" if current_stage == "distribute" else None
    if not target_stage:
        return {
            "batch_id": batch_id,
            "code": None,
            "stage": current_stage,
            "is_final": True,
            "message": "Batch has completed its full lifecycle (dispensed/purchased)."
        }

    v_record = db.query(BatchVerification).filter(
        BatchVerification.batch_id == batch_id,
        BatchVerification.stage == target_stage,
        BatchVerification.is_used == False
    ).order_by(BatchVerification.id.desc()).first()

    return {
        "batch_id": batch_id,
        "code": v_record.code if v_record else None,
        "target_stage": target_stage,
        "current_stage": current_stage,
        "is_final": False
    }


@router.get("/batches/{batch_id}/history")
def compat_history(batch_id: str, db: Session = Depends(get_db)):
    medicine = db.query(MedicineMetadata).filter(MedicineMetadata.batch_id == batch_id).first()
    history = blockchain.get_batch_history(batch_id)
    state = blockchain.get_batch_state(batch_id)

    return {
        "batchId": batch_id,
        "medicine": {
            "name": medicine.drug_name if medicine else "Unknown Product",
            "manufacturer": medicine.manufacturer if medicine else "Unknown",
            "dosage": medicine.dosage if medicine else "Standard",
            "composition": medicine.composition if medicine else "",
            "expiryDate": medicine.expiry_date.isoformat() if medicine and medicine.expiry_date else None,
            "manufacturingDate": medicine.manufacturing_date.isoformat() if medicine and medicine.manufacturing_date else None,
        },
        "currentStage": state.get("stage"),
        "currentOwner": state.get("owner"),
        "isAuthentic": len(history) > 0 and blockchain.is_chain_valid(),
        "chainVerified": blockchain.is_chain_valid(),
        "events": history
    }


@router.get("/medicines/search")
def compat_search(
    q: str = Query("", alias="q"),
    page: int = 1,
    limit: int = 8,
    db: Session = Depends(get_db)
):
    query_filter = f"%{q}%"
    medicines = db.query(MedicineMetadata).filter(
        MedicineMetadata.drug_name.ilike(query_filter)
        | MedicineMetadata.batch_id.ilike(query_filter)
        | MedicineMetadata.manufacturer.ilike(query_filter)
    ).offset((page - 1) * limit).limit(limit).all()

    total = db.query(MedicineMetadata).filter(
        MedicineMetadata.drug_name.ilike(query_filter)
        | MedicineMetadata.batch_id.ilike(query_filter)
    ).count()

    results = []
    for med in medicines:
        state = blockchain.get_batch_state(med.batch_id)
        results.append({
            "id": med.batch_id,
            "name": med.drug_name,
            "maker": med.manufacturer,
            "status": "verified" if state.get("stage") else "registered",
            "stage": state.get("stage")
        })

    return {
        "total": total,
        "page": page,
        "limit": limit,
        "data": results
    }
