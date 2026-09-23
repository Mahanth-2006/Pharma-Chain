# Pharma-Chain: Blockchain-Based Pharmaceutical Supply Chain Tracking

Pharma-Chain is a custom, from-scratch blockchain platform engineered to eliminate counterfeit drugs, prevent illicit custody diversion, ensure regulatory compliance, and enforce strict, verifiable custody progression across the pharmaceutical supply chain: **Manufacturer → Distributor → Hospital / Pharmacy**.

Built with a high-performance **hybrid on-chain/off-chain architecture**, Pharma-Chain pairs an immutable custom Python blockchain with a PostgreSQL relational store and a modern React 18 TypeScript dashboard. It introduces a **10-Digit Proof-of-Transaction Protocol** requiring cryptographically authenticated, out-of-band verification codes to seal custody handoffs between actors.

---

## 1. System Architecture

Pharma-Chain implements a **hybrid on-chain/off-chain architecture** to optimize throughput and preserve privacy:
- **On-Chain (`Blockchain`)**: Stores immutable state transitions, 2048-bit RSA digital signatures, batch pricing, actor custody, timestamps, previous block hashes, and SHA-256 Merkle-like block seals.
- **Off-Chain (`PostgreSQL`)**: Stores heavy pharmaceutical metadata (composition, dosage, pack size, manufacturing & expiration dates, therapeutic class) and participant credentials.
- **The Bridge (`batch_id`)**: The immutable `batch_id` acts as the exclusive anchor linking relational database records to blockchain transaction blocks.
- **Dual Routing Backend**: All endpoints are mounted both at root (`/auth`, `/query`, etc.) and under `/api` (`/api/auth`, `/api/batches`, etc.) to support both direct API access and seamless frontend client integration.

### High-Level Architecture & 10-Digit Handoff Flow

```text
+---------------------------------------------------------------------------------------------------+
|                                        PHARMA-CHAIN SYSTEM                                        |
+---------------------------------------------------------------------------------------------------+

     [ Manufacturer A ]                  [ Distributor A ]                 [ Hospital / Pharmacy A ]
      Role: manufacturer                  Role: distributor                 Role: hospital / pharmacy
      User: manu_a                        User: dist_a                      User: hosp_a
      Pass: mpass123                      Pass: dpass123                    Pass: hpass123
             |                                   |                                    |
             | 1. Mint Batch                     | 2. Verify & Receive                | 3. Verify & Purchase
             |    POST /batches/mint             |    POST /batches/distribution      |    POST /batches/purchase
             |    Generates 10-digit Code A      |    Requires Code A                 |    Requires Code B
             |                                   |    Generates 10-digit Code B       |    Finalizes Lifecycle
             v                                   v                                    v
+---------------------------------------------------------------------------------------------------+
|                                          FASTAPI BACKEND                                          |
|                                                                                                   |
|  [ OAuth2 / JWT Auth ] ---------> [ Role Guard Middleware ] ---------> [ Stage Order Validator ]  |
|         |                                                                           |             |
|         v                                                                           v             |
|  [ RSA Signatures ]                                                      [ Proof of Authority ]   |
|   - 2048-bit PSS / SHA-256                                                - Round-Robin Rotation  |
|   - Private Key Transaction Signing                                       - Turn Enforcement      |
|   - Public Key Signature Verification                                     - [manu_a,dist_a,hosp_a]|
+---------------------------------------------------------------------------------------------------+
       |                                                                              |
       | Off-Chain Storage & Code Management                                          | Seal & Append Block
       v                                                                              v
+------------------------------------+                         +------------------------------------+
|        POSTGRESQL DATABASE         |                         |          CUSTOM BLOCKCHAIN         |
|                                    |                         |                                    |
| [participants]                     |                         |  +------------------------------+  |
|  - id, username, role,             |                         |  | Block 0: GENESIS             |  |
|    password_hash, public_key       |                         |  | Hash: 000... Prev: 0         |  |
|                                    |                         |  +------------------------------+  |
| [medicine_metadata]                |        batch_id         |                |                   |
|  - batch_id, drug_name,            |<----------------------->|                v                   |
|    mfg_date, exp_date,             |        (Bridge)         |  +------------------------------+  |
|    composition, dosage, pack_size  |                         |  | Block 1: MINT (manu_a)       |  |
|                                    |                         |  | Validator: manu_a            |  |
| [batch_verifications]              |                         |  | Tx: manu_a -> manu_a         |  |
|  - batch_id, stage, code (10-digit)|                         |  +------------------------------+  |
|    is_used, created_at             |                         |                |                   |
|                                    |                         |                v                   |
| [blockchain_snapshot]              |       Persistence       |  +------------------------------+  |
|  - block_index, block_hash,        |<========================|  | Block 2: DISTRIBUTE (dist_a) |  |
|    prev_hash, validator,           |       (Auto-Restore)    |  | Validator: dist_a            |  |
|    timestamp, transactions,        |                         |  | Tx: manu_a -> dist_a         |  |
|    batch_id                        |                         |  +------------------------------+  |
+------------------------------------+                         |                |                   |
                                                               |                v                   |
                                                               |  +------------------------------+  |
                                                               |  | Block 3: PURCHASE (hosp_a)   |  |
                                                               |  | Validator: hosp_a            |  |
                                                               |  | Tx: dist_a -> hosp_a         |  |
                                                               |  +------------------------------+  |
                                                               +------------------------------------+
```

---

## 2. The 10-Digit Proof-of-Transaction Protocol

In physical pharmaceutical logistics, physical custody transfer requires an out-of-band verification signal to prove that physical goods have actually changed hands before a node signs the next block on the distributed ledger.

Pharma-Chain implements a **cryptographic, single-use 10-digit verification code mechanism**:

```text
  [ Manufacturer ]                                 [ Distributor ]                               [ Hospital / Pharmacy ]
         │                                                │                                                 │
         │─── Mints Batch (Block N) ─────────────────────>│                                                 │
         │    Generates 10-Digit Code A                   │                                                 │
         │    (Stored in DB as unused)                    │                                                 │
         │                                                │                                                 │
         │─── Transmits Code A (Physical/Secure) ────────>│                                                 │
         │                                                │─── Inspects Batch & Submits Code A ────────────>│
         │                                                │    Validates Code A (Marked used)               │
         │                                                │    Signs & Mints Block N+1                      │
         │                                                │    Generates 10-Digit Code B                    │
         │                                                │                                                 │
         │                                                │─── Transmits Code B (Physical/Secure) ─────────>│
         │                                                │                                                 │─── Submits Code B
         │                                                │                                                 │    Validates Code B (Marked used)
         │                                                │                                                 │    Signs & Mints Block N+2
         │                                                │                                                 │    Lifecycle: COMPLETED
```

### Protocol Steps:
1. **Minting Stage (`mint`)**:
   - The Manufacturer inputs batch information (drug name, dosage, manufacturing date, expiry date, price) and mints Block $N$.
   - The backend signs the transaction with `manu_a_private.pem` and appends the block under validator `manu_a`.
   - The system automatically generates a cryptographically secure 10-digit numeric code (`secrets.randbelow(9000000000) + 1000000000`) assigned to `stage="distribute"`.
   - The Manufacturer displays this code on their dashboard and can retrieve it at any time via `GET /api/batches/{batch_id}/verification-code`.
2. **Distribution Stage (`distribute`)**:
   - The Distributor clicks **Verify & Accept Batch**, inspects the manufacturer's block details, and enters the 10-digit verification code.
   - The backend validates that the code matches the unused code for that batch, marks it as `is_used=True`, verifies stage progression (`mint` $\rightarrow$ `distribute`), signs the transaction with `dist_a_private.pem`, and seals Block $N+1$ under validator `dist_a`.
   - The backend simultaneously generates a new 10-digit code assigned to `stage="purchase"` for the next handoff.
3. **Purchase / Dispensing Stage (`purchase`)**:
   - The Hospital or Pharmacy node clicks **Verify & Dispense**, enters the batch ID and the Distributor's 10-digit code.
   - The backend validates the code, marks it as consumed, signs the transaction with `hosp_a_private.pem`, and seals Block $N+2$ under validator `hosp_a`.
   - The batch is now permanently marked as purchased/dispensed. Any subsequent purchase attempts are rejected.

---

## 3. Clean Data & Persistence Policy (Zero Mock Data)

Pharma-Chain is configured with a **strict real-data persistence policy**:
- **Zero Mock Batches**: All hardcoded fake batches (`B001` through `B020`) and auto-minting fallbacks have been completely purged from the codebase.
- **100% User-Driven Ledger**: The blockchain starts cleanly with only the Genesis block (Block #0). Every subsequent block represents an authentic batch created and signed by an authenticated user.
- **Non-Destructive Database Management**: Tables are created using `Base.metadata.create_all()` and are **never** dropped or reset on server startup.
- **Automatic Blockchain Restoration**: On backend boot, `blockchain.load_chain_from_db(db)` queries the `blockchain_snapshot` table and reconstructs the in-memory blockchain, block hashes, transactions, and validator turns identically.
- **Idempotent Seeder**: Running `python -m db.seed` creates or updates only the 3 canonical system participants and their RSA public keys without touching any created batches or snapshot blocks.

---

## 4. Cryptography & Consensus Engine

### 1. RSA-2048 Digital Signatures (RSASSA-PSS + SHA-256)
- Every transaction is signed using the actor's private key (`backend/keys/{username}_private.pem`) using the `RSASSA-PSS` signature scheme with `MGF1` and `SHA-256`.
- The signed payload is a canonical JSON serialization of:
  `{"batch_id": ..., "drug_name": ..., "from_actor": ..., "to_actor": ..., "price": ..., "stage": ..., "timestamp": ...}`
- If any field (such as price or stage) is tampered with in transit or in storage, public key signature verification fails immediately.

### 2. Proof of Authority (PoA) Round-Robin Consensus
- Consensus is managed by an authorized validator set: `["manu_a", "dist_a", "hosp_a"]`.
- The required validator for any block index $N$ is deterministically calculated as:
  $$\text{Expected Validator} = \text{Validators}[(N - 1) \pmod{|\text{Validators}|}]$$
- **Turn Enforcement**: If an unauthorized node attempts to seal a block or if a validator attempts to seal out-of-turn, `validate_validator()` rejects the block.
- **Tamper Detection**: `blockchain.is_chain_valid()` verifies:
  1. Recalculated SHA-256 hash against stored `block.hash`.
  2. Cryptographic linkage against `previous_hash`.
  3. Turn compliance for every validator across the entire chain history.

---

## 5. Database Schema

```sql
-- Participants table
CREATE TABLE participants (
    id SERIAL PRIMARY KEY,
    name VARCHAR NOT NULL,
    role VARCHAR NOT NULL,               -- 'manufacturer' | 'distributor' | 'hospital'
    username VARCHAR UNIQUE NOT NULL,
    password_hash VARCHAR NOT NULL,
    public_key TEXT NOT NULL             -- RSA 2048-bit Public Key in PEM format
);

-- Medicine off-chain metadata
CREATE TABLE medicine_metadata (
    id SERIAL PRIMARY KEY,
    batch_id VARCHAR UNIQUE NOT NULL,    -- Bridge key to blockchain
    drug_name VARCHAR NOT NULL,
    manufacturer VARCHAR NOT NULL,
    manufacturing_date DATE,
    expiry_date DATE,
    composition TEXT,
    dosage VARCHAR,
    pack_size VARCHAR,
    therapeutic_class VARCHAR
);

-- Blockchain persistent snapshot
CREATE TABLE blockchain_snapshot (
    id SERIAL PRIMARY KEY,
    block_index INTEGER UNIQUE NOT NULL,
    block_hash VARCHAR UNIQUE NOT NULL,
    previous_hash VARCHAR NOT NULL,
    validator VARCHAR NOT NULL,
    timestamp DOUBLE PRECISION NOT NULL,
    transactions TEXT NOT NULL,          -- Serialized JSON array of transactions
    batch_id VARCHAR                     -- Associated batch identifier
);

-- Single-use 10-digit proof-of-transaction codes
CREATE TABLE batch_verifications (
    id SERIAL PRIMARY KEY,
    batch_id VARCHAR NOT NULL,
    stage VARCHAR NOT NULL,              -- 'distribute' | 'purchase'
    code VARCHAR(10) NOT NULL,           -- Cryptographically generated 10-digit string
    is_used BOOLEAN DEFAULT FALSE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE INDEX ix_batch_verifications_batch_id ON batch_verifications(batch_id);
```

---

## 6. Directory Structure

```text
Pharma-Chain/
├── README.md                           # Comprehensive documentation & architectural defense
├── backend/
│   ├── .env                            # Environment variables (Database URL, JWT Secret)
│   ├── requirements.txt                # Python dependencies
│   ├── main.py                         # FastAPI app, lifespan DB restoration, CORS & routing
│   ├── blockchain/
│   │   ├── __init__.py
│   │   ├── block.py                    # Block data structure, timestamping & SHA-256 hashing
│   │   ├── chain.py                    # Blockchain ledger, DB save/restore & audit validator
│   │   ├── consensus.py                # Proof of Authority round-robin engine
│   │   ├── crypto_utils.py             # RSA-2048 key generation, PSS signing & verification
│   │   └── transaction.py              # Signed transaction model & stage progression validator
│   ├── api/
│   │   ├── __init__.py
│   │   ├── auth.py                     # JWT token issuance, password hashing & login routing
│   │   ├── manufacturer_routes.py      # POST /manufacturer/mint
│   │   ├── distributor_routes.py       # POST /distributor/receive
│   │   ├── hospital_routes.py          # POST /hospital/purchase
│   │   ├── query_routes.py             # Blockchain inspection, batch history & provenance
│   │   └── frontend_compat_routes.py   # Full frontend compatibility & 10-digit verification APIs
│   ├── db/
│   │   ├── __init__.py
│   │   ├── database.py                 # SQLAlchemy engine, declarative base & session generator
│   │   ├── models.py                   # Participant, MedicineMetadata, Snapshot, Verification models
│   │   └── seed.py                     # Non-destructive seeder for canonical users & RSA keys
│   ├── middleware/
│   │   ├── __init__.py
│   │   └── role_guard.py               # Role-based access control (RBAC) dependency
│   ├── keys/                           # Generated RSA 2048-bit PEM private keys
│   │   ├── manu_a_private.pem
│   │   ├── dist_a_private.pem
│   │   └── hosp_a_private.pem
│   └── tests/                          # Automated pytest suite (21 passing tests)
│       ├── conftest.py                 # Test fixtures & test DB setup
│       ├── test_blockchain.py          # Hashing, Genesis block & tamper detection tests
│       ├── test_consensus.py           # PoA turn enforcement & validator rotation tests
│       ├── test_crypto.py              # RSA signature generation & verification tests
│       ├── test_stage_validation.py    # Strict custody stage progression tests
│       └── test_api.py                 # End-to-end integration API tests
└── frontend/
    ├── package.json                    # Node dependencies & build scripts
    ├── vite.config.ts                  # Vite build & local dev server configuration
    ├── tsconfig.json                   # TypeScript configuration
    └── client/
        └── src/
            ├── App.tsx                 # Wouter routing & role-protected route tree
            ├── api/
            │   └── client.ts           # Unified API client configured for port 8000
            ├── auth/
            │   ├── AuthContext.tsx     # Authentication context & local token persistence
            │   └── ProtectedRoute.tsx  # Role-guard route wrapper
            ├── components/
            │   ├── Navbar.tsx          # Role-aware navigation & session indicator
            │   ├── ProvenanceTimeline.tsx # Visual block-by-block custody timeline
            │   └── ui/                 # Reusable glassmorphic UI components
            └── pages/
                ├── Login.tsx           # Multi-role authentication portal
                ├── ManufacturerDashboard.tsx # Minting console, 10-digit code modal & stack ledger
                ├── DistributorDashboard.tsx  # Batch verification modal & stack ledger
                ├── PharmacyDashboard.tsx     # Final purchase modal, provenance & stack ledger
                └── BatchHistory.tsx    # Live query & batch history inspector
```

---

## 7. Canonical System Credentials

| Role | Username / Login Identifier | Password | Role Key | Private Key Location |
| :--- | :--- | :--- | :--- | :--- |
| **Manufacturer** | `manu_a` or `manufacturer@pharmachain.test` | `mpass123` | `manufacturer` | `backend/keys/manu_a_private.pem` |
| **Distributor** | `dist_a` or `distributor@pharmachain.test` | `dpass123` | `distributor` | `backend/keys/dist_a_private.pem` |
| **Hospital / Pharmacy** | `hosp_a` or `pharmacy@pharmachain.test` | `hpass123` | `hospital` | `backend/keys/hosp_a_private.pem` |

---

## 8. Multi-Node Frontend Dashboards

The frontend is built using **React 18**, **TypeScript**, **TailwindCSS**, and **Wouter**:
1. **Manufacturer Dashboard (`/manufacturer`)**:
   - Mint new medicine batches with strict input validation (dates, dosage, price).
   - Generates and displays the single-use **10-Digit Distributor Verification Code** upon block creation.
   - Built-in "Get Verification Code" modal to retrieve codes for previously minted batches.
   - **Reverse-Chronological (Stack Format) Blockchain Ledger**: Newest blocks appear at the top, displaying block index, SHA-256 hash, validator, and digital signature.
2. **Distributor Dashboard (`/distributor`)**:
   - Interactive **Verify & Accept Batch** modal: entering a Batch ID fetches current on-chain state; entering the 10-digit code seals Block $N+1$.
   - Automatically issues the subsequent 10-digit code required by the Hospital/Pharmacy node.
   - Full stack-format live blockchain ledger with real-time PoA validator tracking.
3. **Pharmacy / Hospital Dashboard (`/pharmacy`)**:
   - Interactive **Verify & Dispense** modal: accepts the Distributor's 10-digit code to seal Block $N+2$.
   - Live provenance and custody tracking (`/batches/{batch_id}/history`).
   - Full stack-format live blockchain ledger.
   - Immediate visual tamper alerts if any block in the chain is modified.

---

## 9. Complete API Reference

All routes are available both directly and under the `/api` prefix (e.g. `/batches/mint` and `/api/batches/mint`).

### 1. Authentication
- `POST /auth/login` (or `/api/auth/login`)
  - **Body (JSON or Form)**: `{"username": "manu_a", "password": "mpass123"}`
  - **Response**:
    ```json
    {
      "access_token": "<JWT_STRING>",
      "token": "<JWT_STRING>",
      "token_type": "bearer",
      "user": {
        "name": "Manufacturer Node Alpha",
        "username": "manu_a",
        "email": "manu_a@pharmachain.test",
        "role": "manufacturer"
      }
    }
    ```

### 2. Batch Creation & Minting (Manufacturer)
- `POST /batches/mint` (or `/api/batches/mint` or `/manufacturer/mint`)
  - **Headers**: `Authorization: Bearer <manu_token>`
  - **Body**:
    ```json
    {
      "batch_id": "BATCH-2026-001",
      "medicine_name": "Paracetamol 500mg",
      "dosage": "500mg",
      "manufacture_date": "2026-03-01",
      "expiry_date": "2028-03-01",
      "price": 100.0
    }
    ```
  - **Response**:
    ```json
    {
      "success": true,
      "message": "Medicine batch successfully minted to the blockchain.",
      "batchId": "BATCH-2026-001",
      "blockHeight": 1,
      "blockHash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      "validator": "manu_a",
      "verification_code": "5829104721",
      "stage": "mint"
    }
    ```

### 3. Custody Transfer (Distributor)
- `POST /batches/distribution` (or `/api/batches/distribution` or `/distributor/receive`)
  - **Headers**: `Authorization: Bearer <dist_token>`
  - **Body**:
    ```json
    {
      "batch_id": "BATCH-2026-001",
      "verification_code": "5829104721",
      "price": 125.0
    }
    ```
  - **Response**:
    ```json
    {
      "success": true,
      "message": "Distribution sealed successfully with digital signature.",
      "batchId": "BATCH-2026-001",
      "blockHeight": 2,
      "blockHash": "7f83b1657ff1fc53b92dc18148a1d65dfc2d4b1fa3d677284addd200126d9069",
      "validator": "dist_a",
      "hospital_verification_code": "8472910385",
      "stage": "distribute"
    }
    ```

### 4. Final Receipt & Dispensing (Hospital / Pharmacy)
- `POST /batches/purchase` (or `/api/batches/purchase` or `/hospital/purchase`)
  - **Headers**: `Authorization: Bearer <hosp_token>`
  - **Body**:
    ```json
    {
      "batch_id": "BATCH-2026-001",
      "verification_code": "8472910385",
      "price": 150.0
    }
    ```
  - **Response**:
    ```json
    {
      "success": true,
      "message": "Purchase verified and recorded on blockchain.",
      "batchId": "BATCH-2026-001",
      "blockHeight": 3,
      "blockHash": "1a2b3c4d5e6f...",
      "validator": "hosp_a",
      "stage": "purchase"
    }
    ```

### 5. Verification Code Lookup
- `GET /batches/{batch_id}/verification-code` (or `/api/batches/{batch_id}/verification-code`)
  - **Headers**: `Authorization: Bearer <token>`
  - **Response**:
    ```json
    {
      "batch_id": "BATCH-2026-001",
      "code": "5829104721",
      "target_stage": "distribute",
      "current_stage": "mint",
      "is_final": false
    }
    ```

### 6. Blockchain Query & Provenance
- `GET /query/chain` (or `/api/query/chain`): Returns full block list, height, and overall validity (`is_chain_valid`).
- `GET /query/batch/{batch_id}`: Merges off-chain PostgreSQL metadata with complete on-chain provenance history.
- `GET /query/block/{height}`: Fetches a single block by its height index.
- `GET /batches/{batch_id}/history`: Returns chronological custody events, timestamps, validator seals, and authenticity flag.
- `GET /medicines/search?q={query}`: Searches registered medicines by name, batch ID, or manufacturer.
- `GET /`: Healthcheck endpoint displaying chain length and cryptographic status.

---

## 10. Startup & Execution Guide

### Prerequisites
- **Python 3.11+** installed
- **Node.js 18+** and **npm** installed
- **PostgreSQL Server** installed and running on `localhost:5432`

---

### Step 1: Database Setup
Create a PostgreSQL database named `pharmachain` using `psql` or pgAdmin:
```sql
CREATE DATABASE pharmachain;
```

---

### Step 2: Backend Configuration & Startup

Open a Command Prompt (`cmd.exe`) or PowerShell window:

```cmd
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
```

Verify or configure your `backend/.env` file:
```ini
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/pharmachain
SECRET_KEY=pharmachain-super-secret-key-32-chars-minimum
ACCESS_TOKEN_EXPIRE_MINUTES=120
```

Seed the canonical participants and RSA key registry:
```cmd
python -m db.seed
```

Start the FastAPI application with auto-reload:
```cmd
uvicorn main:app --reload --port 8000
```
- API is running at: `http://localhost:8000`
- Interactive OpenAPI Docs: `http://localhost:8000/docs`

---

### Step 3: Frontend Startup

Open a second terminal window:

```cmd
cd frontend
npm install
npm run dev
```
- Frontend application will launch at: `http://localhost:5173` (or `http://localhost:3000`)
- Login with any canonical credentials from Section 7.

---

## 11. Automated Testing Suite

The backend includes a comprehensive, automated test suite covering cryptographic signatures, block hashing, PoA turn enforcement, stage progression, and complete API flows:

```cmd
cd backend
venv\Scripts\pytest -v
```

### Test Coverage Summary (21 Passed Tests):
1. **`test_blockchain.py`**:
   - `test_genesis_block`: Verifies Block #0 properties (`index=0`, `previous_hash="0"`, `validator="GENESIS"`).
   - `test_block_hashing`: Validates deterministic SHA-256 block hash recalculation.
   - `test_chain_linkage`: Asserts that `block[N].previous_hash == block[N-1].hash`.
   - `test_tamper_detection_transaction_payload`: Modifying a price or name causes hash mismatch and fails validation.
   - `test_tamper_detection_previous_hash_break`: Altering a link breaks chain validation immediately.
2. **`test_consensus.py`**:
   - `test_validator_rotation`: Verifies round-robin formula $(N - 1) \pmod 3$.
   - `test_is_authorized`: Checks whitelist validation.
   - `test_out_of_turn_rejection`: Rejects out-of-order block generation.
3. **`test_crypto.py`**:
   - `test_rsa_key_generation`: Validates 2048-bit RSA key generation.
   - `test_signing_and_verification`: Verifies valid RSASSA-PSS signatures with SHA-256.
   - `test_tampered_message_rejected`: Ensures modified signatures are rejected.
   - `test_wrong_public_key_rejected`: Verifies mismatched keys fail signature validation.
   - `test_transaction_sign_and_verify`: Validates complete transaction cryptographic lifecycle.
4. **`test_stage_validation.py`**:
   - `test_valid_supply_chain_flow`: Verifies `mint` $\rightarrow$ `distribute` $\rightarrow$ `purchase`.
   - `test_reject_skipping_stages`: Rejects skipping directly from `mint` to `purchase`.
   - `test_reject_duplicate_purchase`: Rejects multiple purchase attempts on the same batch.
5. **`test_api.py`**:
   - `test_auth_success`: Validates JWT token generation for all 3 roles.
   - `test_auth_invalid_credentials`: Rejects bad credentials with 401.
   - `test_role_guard_forbidden`: Rejects unauthorized role actions with 403 Forbidden.
   - `test_full_supply_chain_api_flow`: Complete end-to-end integration test across all 3 nodes.
   - `test_query_endpoints`: Validates `/query/chain`, `/query/batch/{id}`, and `/query/batches`.

---

## 12. Technical Defense & Viva FAQ

### 1. Why Proof of Authority (PoA) instead of Proof of Work (PoW) or Proof of Stake (PoS)?
- **Regulatory Accountability**: Under pharmaceutical regulations (such as the US FDA DSCSA and EU FMD), anonymous block validators are strictly prohibited. Every entity creating blocks must be an identifiable, licensed enterprise.
- **Zero Energy Waste**: PoW burns computational power solving arbitrary mathematical puzzles. In a consortium network of trusted partners, identity is the stake.
- **Immediate Finality**: Deterministic round-robin schedules ensure consistent, sub-second block creation without fork resolution delays or chain splits.

### 2. How does the 10-Digit Proof-of-Transaction Protocol prevent physical-digital discrepancies?
- A classic flaw in supply chain blockchains is the "garbage-in, garbage-out" problem: a distributor could record a digital receipt on-chain before the physical shipment arrives.
- The 10-digit verification code acts as an out-of-band cryptographic handshake. The physical manifest or shipment seal carries the single-use code generated by the previous actor. The receiving node cannot seal the next block without entering this code, guaranteeing physical verification prior to digital finalization.

### 3. How do RSA-2048 PSS Signatures ensure Non-Repudiation?
- Every transaction is signed using the sender's private key (`RSASSA-PSS` with `SHA-256` and `MGF1`).
- Because private keys are stored securely on the respective node servers and never transmitted over the network, an actor cannot claim they did not dispatch or receive a batch (non-repudiation).
- Altering any transaction parameter (such as inflating the price from $100 to $500) breaks signature verification because the decrypted digest will not match the hash of the tampered data.

### 4. What causes Chain Health and Consensus Health to change?
- **Chain Health** reflects cryptographic integrity:
  - If any block's payload or timestamp is modified in the database, `block.hash != block.calculate_hash()`.
  - If an attacker attempts to recalculate the hash of Block $N$, Block $N+1$'s `previous_hash` will fail to match.
  - In either case, `blockchain.is_chain_valid()` returns `False`, Chain Health drops to Degraded, and tamper alerts appear on all dashboards.
- **Consensus Health** reflects round-robin compliance:
  - Every block must be sealed by the validator whose turn corresponds to $(N - 1) \pmod{|\text{Validators}|}$. If a block was injected or forged by an out-of-turn node, the consensus validator flags the block as invalid.

### 5. Why a Hybrid On-Chain / Off-Chain Architecture?
- Storing full chemical formulas, patient guides, dosage forms, and clinical trial records directly inside blockchain transactions causes ledger bloat, slow sync times, and potential privacy leaks.
- Pharma-Chain stores high-volume metadata in PostgreSQL while anchoring state transitions to the blockchain via the unique `batch_id`. This delivers the speed and queryability of SQL with the cryptographic immutability of blockchain.
