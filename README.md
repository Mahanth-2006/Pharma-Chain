# Pharma-Chain: Blockchain-Based Pharmaceutical Supply Chain Tracking

Pharma-Chain is a custom, from-scratch blockchain platform designed to eliminate counterfeit drugs, prevent unauthorized price manipulation, and enforce strict custody progression across the pharmaceutical supply chain: **Manufacturer → Distributor → Hospital**.

---

## 1. System Architecture

Pharma-Chain implements a **hybrid on-chain/off-chain architecture** to optimize throughput and preserve privacy:
- **On-chain** (`Blockchain`): Immutable state transitions, digital signatures, prices, actor custody, timestamps, and cryptographic block hashes.
- **Off-chain** (`PostgreSQL`): Heavy pharmaceutical metadata, compositions, dosages, pack sizes, and therapeutic classifications.
- **The Bridge**: The immutable `batch_id` acts as the exclusive anchor linking PostgreSQL records to blockchain transactions.

### ASCII Architecture Diagram

```text
+-----------------------------------------------------------------------------------+
|                               PHARMA-CHAIN SYSTEM                                 |
+-----------------------------------------------------------------------------------+

     [ Manufacturer A ]               [ Distributor A ]               [ Hospital A ]
      (Role: manufacturer)             (Role: distributor)             (Role: hospital)
       User: manu_a                     User: dist_a                    User: hosp_a
       Pass: mpass123                   Pass: dpass123                  Pass: hpass123
              |                                |                               |
              | POST /manufacturer/mint        | POST /distributor/receive     | POST /hospital/purchase
              v                                v                               v
+-----------------------------------------------------------------------------------+
|                                FASTAPI BACKEND                                    |
|                                                                                   |
|  [ OAuth2 / JWT Auth ] ---> [ Role Guard Middleware ] ---> [ Stage Validator ]   |
|         |                                                           |             |
|         v                                                           v             |
|  [ RSA Signatures ]                                       [ Proof of Authority ]  |
|   - 2048-bit PSS/SHA-256                                   - Round-Robin Rotation |
|   - Private Key Signing                                    - Authorized Validator |
|   - Public Key Verification                                                       |
+-----------------------------------------------------------------------------------+
       |                                                               |
       | Store Off-Chain Metadata                                      | Append Block
       v                                                               v
+-------------------------------+              +------------------------------------+
|     POSTGRESQL DATABASE       |              |          CUSTOM BLOCKCHAIN         |
|                               |              |                                    |
| [participants]                |              |  +------------------------------+  |
|  - id, username, role,        |              |  | Block 0: GENESIS             |  |
|    password_hash, public_key  |              |  | Hash: 000... Prev: 0         |  |
|                               |  batch_id    |  +------------------------------+  |
| [medicine_metadata]           |<------------>|                |                   |
|  - batch_id, drug_name,       |   (Bridge)   |                v                   |
|    mfg_date, exp_date,        |              |  +------------------------------+  |
|    composition, dosage,       |              |  | Block 1: MINT (manu_a)       |  |
|    pack_size, thermo_class    |              |  | Tx: manu_a -> manu_a         |  |
|                               |              |  +------------------------------+  |
| [blockchain_snapshot]         |              |                |                   |
|  - block_index, block_hash,   |<=============|                v                   |
|    prev_hash, validator,      | Persistence  |  +------------------------------+  |
|    timestamp, transactions    |              |  | Block 2: DISTRIBUTE (dist_a) |  |
|                               |              |  | Tx: manu_a -> dist_a         |  |
+-------------------------------+              |  +------------------------------+  |
                                               |                |                   |
                                               |                v                   |
                                               |  +------------------------------+  |
                                               |  | Block 3: PURCHASE (hosp_a)   |  |
                                               |  | Tx: dist_a -> hosp_a         |  |
                                               |  +------------------------------+  |
                                               +------------------------------------+
```

---

## 2. Existing Folder Structure

```text
Pharma-Chain/
├── README.md
├── backend/
│   ├── .env
│   ├── requirements.txt
│   ├── main.py
│   ├── blockchain/
│   │   ├── __init__.py
│   │   ├── block.py              # SHA-256 block structure & hashing
│   │   ├── chain.py              # Blockchain manager & DB persistence
│   │   ├── consensus.py          # Proof of Authority round-robin engine
│   │   ├── crypto_utils.py       # RSA 2048-bit key generation & verification
│   │   └── transaction.py        # Signed transactions & stage validation
│   ├── api/
│   │   ├── __init__.py
│   │   ├── auth.py               # JWT login & OAuth2 authentication
│   │   ├── manufacturer_routes.py# POST /manufacturer/mint
│   │   ├── distributor_routes.py # POST /distributor/receive
│   │   ├── hospital_routes.py    # POST /hospital/purchase
│   │   └── query_routes.py       # Batch provenance, block & chain inspection
│   ├── db/
│   │   ├── __init__.py
│   │   ├── database.py           # SQLAlchemy engine & SessionLocal
│   │   ├── models.py             # Participant, MedicineMetadata, BlockchainSnapshot
│   │   └── seed.py               # Seeds 3 participants & 20 batches (B001 - B020)
│   ├── middleware/
│   │   ├── __init__.py
│   │   └── role_guard.py         # Role-based endpoint authorization
│   ├── keys/                     # RSA private keys (manu_a, dist_a, hosp_a)
│   ├── dataset/
│   │   └── raw/
│   └── tests/
│       ├── conftest.py
│       ├── test_blockchain.py    # Hashing, Genesis, & Tamper detection
│       ├── test_consensus.py     # PoA rotation & turn enforcement
│       ├── test_crypto.py        # RSA signatures & validation
│       ├── test_stage_validation.py # Supply chain stage progression
│       └── test_api.py           # End-to-end integration tests
└── frontend/                     # React application directory
```

---

## 3. Canonical Actors & Credentials

| Participant | Username | Password | Role | RSA Key File |
| :--- | :--- | :--- | :--- | :--- |
| **Manufacturer A** | `manu_a` | `mpass123` | `manufacturer` | `backend/keys/manu_a_private.pem` |
| **Distributor A** | `dist_a` | `dpass123` | `distributor` | `backend/keys/dist_a_private.pem` |
| **Hospital A** | `hosp_a` | `hpass123` | `hospital` | `backend/keys/hosp_a_private.pem` |

---

## 4. API Documentation

### Authentication
- `POST /auth/login`
  - **Body (form-data)**: `username`, `password`
  - **Returns**: `{ "access_token": "<jwt>", "token_type": "bearer" }`

### Manufacturer Routes
- `POST /manufacturer/mint`
  - **Headers**: `Authorization: Bearer <manu_jwt>`
  - **Body**: `{ "batch_id": "B001", "price": 100.0 }`
  - **Action**: Verifies batch exists in PostgreSQL, validates stage order, signs transaction with `manu_a_private.pem`, adds PoA block, and persists snapshot.

### Distributor Routes
- `POST /distributor/receive`
  - **Headers**: `Authorization: Bearer <dist_jwt>`
  - **Body**: `{ "batch_id": "B001", "price": 125.0 }`
  - **Action**: Verifies batch is currently in `mint` stage, rejects already distributed or purchased batches, signs transaction with `dist_a_private.pem`, adds PoA block, and persists snapshot.

### Hospital Routes
- `POST /hospital/purchase`
  - **Headers**: `Authorization: Bearer <hosp_jwt>`
  - **Body**: `{ "batch_id": "B001", "price": 150.0 }`
  - **Action**: Verifies batch is currently in `distribute` stage, rejects duplicate purchases, signs transaction with `hosp_a_private.pem`, adds PoA block, and persists snapshot.

### Query Routes (Public / Authenticated)
- `GET /query/batch/{batch_id}`: Merges off-chain PostgreSQL metadata with full on-chain transaction provenance history.
- `GET /query/block/{height}`: Fetches specific block by index height.
- `GET /query/chain`: Returns entire blockchain and cryptographic validity status (`is_chain_valid`).
- `GET /query/batches`: Returns all 20 registered medicine batches with live supply-chain stages.

---

## 5. Startup Guide

### Prerequisites
- Python 3.11+
- PostgreSQL server running locally

### Step 1: Install Dependencies
Activate your virtual environment and install dependencies:
```powershell
cd backend
.\venv\Scripts\activate
pip install -r requirements.txt
```

### Step 2: Configure Environment Variables
Ensure `backend/.env` contains your PostgreSQL database credentials:
```ini
DATABASE_URL=postgresql://postgres:nani@localhost:5432/pharmachain
SECRET_KEY=pharmachain-super-secret-key
ACCESS_TOKEN_EXPIRE_MINUTES=60
```

### Step 3: Seed Database
Seed the 3 canonical participants with their custom passwords and the 20 demo batches (`B001` - `B020`):
```powershell
python -m db.seed
```

### Step 4: Run the Backend Server
Start FastAPI with automatic reload:
```powershell
uvicorn main:app --reload
```
API Documentation will be accessible at: `http://127.0.0.1:8000/docs`.

### Step 5: Frontend (When Ready)
Once frontend files are placed in `frontend/`:
```bash
cd frontend
npm install
npm run dev
```

---

## 6. Testing Guide

Run the automated test suite with pytest:
```powershell
cd backend
.\venv\Scripts\pytest -v
```
The test suite validates:
1. `test_blockchain.py`: SHA-256 block hashing, Genesis block, chain linkage, and tamper detection.
2. `test_consensus.py`: Round-robin Proof of Authority validator rotation and turn enforcement.
3. `test_crypto.py`: RSA 2048-bit key pair generation, digital signing, and signature verification.
4. `test_stage_validation.py`: Sequential progression (`mint` -> `distribute` -> `purchase`) and duplicate purchase rejection.
5. `test_api.py`: JWT login with custom passwords, role guards (403), full end-to-end supply chain API flow, and query endpoints.

---

## 7. Viva & Technical Defense Notes

### 1. Why Proof of Authority (PoA) instead of Proof of Work (PoW)?
- **Energy Efficiency & Zero Waste**: PoW consumes massive computational power solving arbitrary puzzles. In a consortium enterprise supply chain where participants are known entities (licensed manufacturers, distributors, hospitals), trust is identity-based.
- **Predictable Latency & High Throughput**: PoA block creation happens deterministically without mining latency.
- **Regulatory Alignment**: Pharmaceutical supply chains require identifiable accountability. Anonymous mining nodes (PoW) violate regulatory standards like DSCSA and EU FMD.

### 2. How do RSA Digital Signatures prevent fraud?
- Every transaction is signed using the actor's private key (`RSASSA-PSS` with `SHA-256`).
- The message includes deterministic JSON payload (`batch_id`, `from_actor`, `to_actor`, `price`, `stage`, `timestamp`).
- If an attacker intercepts the request and alters the `price` or `batch_id`, the signature verification fails because the recalculated hash will not decrypt to the original hash with the actor's public key.
- Non-repudiation: A manufacturer or distributor cannot claim they did not dispatch or receive a batch.

### 3. Why does `batch_id` link Blockchain and PostgreSQL?
- Storing high-volume metadata (chemical formulae, excipients, dosage forms, clinical guidelines) directly on-chain leads to blockchain bloat and slow state synchronization.
- `batch_id` acts as the foreign key bridging the immutable on-chain ledger with the off-chain relational database, giving the performance of PostgreSQL and the tamper resistance of blockchain.

### 4. How is tampering detected?
- **Block Content Tampering**: If any field in a block's transaction payload is modified, `block.calculate_hash()` recalculates a different SHA-256 hash. The check `block.hash == block.calculate_hash()` detects the discrepancy immediately.
- **Block Linkage Tampering**: If an attacker attempts to replace a block and recalculate its hash, the subsequent block's `previous_hash` will no longer match the altered block's hash, breaking the chain.

### 5. Complete B001 Journey Walkthrough
1. **Manufacturer Mint**:
   - `manu_a` calls `POST /manufacturer/mint` with `batch_id: B001, price: 100.0`.
   - Transaction: `from_actor="manu_a"`, `to_actor="manu_a"`, `stage="mint"`.
   - Signed with `manu_a_private.pem`. Sealed in Block 1 by expected validator `manu_a`.
2. **Distributor Receive**:
   - `dist_a` calls `POST /distributor/receive` with `batch_id: B001, price: 125.0`.
   - Stage order validated (`mint` -> `distribute`).
   - Transaction: `from_actor="manu_a"`, `to_actor="dist_a"`, `stage="distribute"`.
   - Signed with `dist_a_private.pem`. Sealed in Block 2 by expected validator `dist_a`.
3. **Hospital Purchase**:
   - `hosp_a` calls `POST /hospital/purchase` with `batch_id: B001, price: 150.0`.
   - Stage order validated (`distribute` -> `purchase`).
   - Transaction: `from_actor="dist_a"`, `to_actor="hosp_a"`, `stage="purchase"`.
   - Signed with `hosp_a_private.pem`. Sealed in Block 3 by expected validator `hosp_a`.
   - Duplicate purchase attempts are rejected permanently.

### 6. Validator Rotation Mechanics
- PoA maintains a circular round-robin schedule across authorized nodes: `["manu_a", "dist_a", "hosp_a"]`.
- The expected validator for block `N` is calculated deterministically as:
  $$\text{Expected Validator} = \text{Validators}[(N - 1) \pmod{|\text{Validators}|}]$$
- If any node attempts to validate out-of-turn, `validate_validator` rejects the block with a 400 turn mismatch.

### 7. Limitations & Future Improvements
- **Single Process Architecture**: Designed as a centralized educational node simulation. Production deployments would distribute nodes across separate physical servers communicating over P2P gossip protocols (libp2p).
- **Batch Splitting**: In real-world logistics, large batches are broken down into cartons and blister packs. Future versions can support hierarchical sub-batch IDs (e.g., `B001-C1-P1`).
- **Cold-Chain IoT Telemetry**: Integrating IoT sensors into the on-chain transactions to track temperature, humidity, and location in real time.
