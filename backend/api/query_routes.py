from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from blockchain.chain import blockchain
from db.database import get_db
from db.models import MedicineMetadata

router = APIRouter(
    prefix="/query",
    tags=["Query"]
)


@router.get("/batch/{batch_id}")
def query_batch(
    batch_id: str,
    db: Session = Depends(get_db)
):
    """
    Merges off-chain PostgreSQL metadata with on-chain blockchain history.
    """
    medicine = db.query(MedicineMetadata).filter(
        MedicineMetadata.batch_id == batch_id
    ).first()

    if medicine is None:
        raise HTTPException(
            status_code=404,
            detail=f"Batch {batch_id} not found in medicine registry."
        )

    current_state = blockchain.get_batch_state(batch_id)
    history = blockchain.get_batch_history(batch_id)
    chain_valid = blockchain.is_chain_valid()

    # Determine authenticity status
    is_authentic = len(history) > 0 and chain_valid

    return {
        "batch_id": batch_id,
        "metadata": {
            "drug_name": medicine.drug_name,
            "manufacturer": medicine.manufacturer,
            "manufacturing_date": medicine.manufacturing_date.isoformat() if medicine.manufacturing_date else None,
            "expiry_date": medicine.expiry_date.isoformat() if medicine.expiry_date else None,
            "composition": medicine.composition,
            "dosage": medicine.dosage,
            "pack_size": medicine.pack_size,
            "therapeutic_class": medicine.therapeutic_class,
        },
        "blockchain": {
            "current_stage": current_state.get("stage"),
            "current_owner": current_state.get("owner"),
            "is_authentic": is_authentic,
            "chain_verified": chain_valid,
            "total_transactions": len(history),
            "history": history
        }
    }


@router.get("/block/{height}")
def query_block(height: int):
    """
    Returns a specific block from the blockchain by height / index.
    """
    if height < 0 or height >= len(blockchain.chain):
        raise HTTPException(
            status_code=404,
            detail=f"Block height {height} not found. Current chain height is {len(blockchain.chain) - 1}."
        )

    return blockchain.chain[height].to_dict()


@router.get("/chain")
def query_chain():
    """
    Returns the complete blockchain and validates tamper resistance.
    """
    is_valid = blockchain.is_chain_valid()
    return {
        "length": len(blockchain.chain),
        "is_valid": is_valid,
        "chain": blockchain.to_dict()
    }


@router.get("/batches")
def query_all_batches(db: Session = Depends(get_db)):
    """
    Returns all registered medicine batches combined with their live blockchain status.
    """
    medicines = db.query(MedicineMetadata).order_by(MedicineMetadata.batch_id.asc()).all()
    results = []

    for med in medicines:
        state = blockchain.get_batch_state(med.batch_id)
        results.append({
            "batch_id": med.batch_id,
            "drug_name": med.drug_name,
            "manufacturer": med.manufacturer,
            "manufacturing_date": med.manufacturing_date.isoformat() if med.manufacturing_date else None,
            "expiry_date": med.expiry_date.isoformat() if med.expiry_date else None,
            "composition": med.composition,
            "dosage": med.dosage,
            "pack_size": med.pack_size,
            "therapeutic_class": med.therapeutic_class,
            "stage": state.get("stage"),
            "owner": state.get("owner")
        })

    return {
        "total": len(results),
        "batches": results
    }
