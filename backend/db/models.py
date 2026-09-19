"""
models.py

Database models for Pharma-Chain.
"""

from sqlalchemy import Column, Date, Float, Integer, String, Text

from db.database import Base

class Participant(Base):
    __tablename__ = "participants"

    id = Column(Integer, primary_key=True)
    name = Column(String, nullable=False)
    role = Column(String, nullable=False)
    username = Column(String, unique=True, nullable=False)
    password_hash = Column(String, nullable=False)
    public_key = Column(Text, nullable=False)


class MedicineMetadata(Base):
    __tablename__ = "medicine_metadata"

    id = Column(Integer, primary_key=True)
    batch_id = Column(String, unique=True, nullable=False)
    drug_name = Column(String, nullable=False)
    manufacturer = Column(String, nullable=False)
    manufacturing_date = Column(Date)
    expiry_date = Column(Date)
    composition = Column(Text)
    dosage = Column(String)
    pack_size = Column(String)
    therapeutic_class = Column(String)


class BlockchainSnapshot(Base):
    """
    Persistence table for storing blockchain blocks.
    """
    __tablename__ = "blockchain_snapshot"

    id = Column(Integer, primary_key=True)
    block_index = Column(Integer, unique=True, nullable=False)
    block_hash = Column(String, unique=True, nullable=False)
    previous_hash = Column(String, nullable=False)
    validator = Column(String, nullable=False)
    timestamp = Column(Float, nullable=False)
    transactions = Column(Text, nullable=False)
    batch_id = Column(String, nullable=True)