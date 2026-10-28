# MASTER SYSTEM SPECIFICATION & AGENT IMPLEMENTATION PROMPT
**Project:** Enterprise Growatt Pay-As-You-Go (PAYG) Solar, Fintech & AI Energy Management Platform  
**Architecture Standard:** Clean Architecture, Domain-Driven Design (DDD), Polyglot Microservices, Atomic POSIX Virtual File System (VFS)  
**Tech Stack:** Golang (Core Backend, Fintech Ledger, IoT Gateway) | TypeScript/Next.js (Showroom, Customer PWA, Admin Command) | Python (Multi-Horizon ML Forecasting & LocalGridAgent RAG+LLM) | PostgreSQL 16 (OLTP + TimescaleDB + pgvector) + EMQX MQTT

---

## 1. ROLE & SYSTEM DIRECTIVE FOR AI CODING AGENT
You are a Principal Distributed Systems Architect, Embedded Solar IoT Engineer, Fintech Ledger Specialist, and Machine Learning Engineer. Your objective is to build an end-to-end, production-grade Pay-As-You-Go (PAYG) Solar and Smart Energy-as-a-Service (EaaS) platform centered around **Growatt Inverters** (SPF Off-Grid & SPH Hybrid series) and **LiFePO4 Battery Storage**.

You must execute this system strictly in **6 Sequential Batches**, adhering to all business rules, electrical engineering protections, hardware anti-tamper protocols, idempotent financial accounting rules, and read-only AI guardrails defined in this specification. Do not skip modules or use placeholder logic.

---

## 2. BUSINESS, ENGINEERING & ARCHITECTURAL GUARDRAILS (NON-NEGOTIABLE)

### A. Business & Credit Risk Rules
1. **Curated Growatt Bundles & LiFePO4 Mandate:**
   - All lease-to-own installment plans (>12 months up to 36 months) MUST strictly pair Growatt inverters with **LiFePO4 (Lithium Iron Phosphate) batteries** (4,000–6,000 cycles, 80% Depth of Discharge) to prevent battery death before the 36-month amortization completes.
   - Lead-Acid/Tubular batteries are restricted exclusively to 100% Outright Cash purchases.
2. **FX & Inflation Protection (30%–35% Down Payment):**
   - Installment plans (3 to 36 months) require an upfront **30% to 35% Down Payment** before installation, plus a mandatory **1.5%–2% Equipment Insurance Fee** baked into the amortization schedule.
3. **Multi-Rail Payment Engine:**
   - Support **Dedicated Virtual Accounts (DVAs)** via **Moniepoint**, **Paystack**, and **OPay** APIs, alongside tokenized card/direct-debit mandates and USSD/POS field agent collections.
4. **Amortization & Credit Clock:**
   - Every cleared payment converts into exact `active_energy_seconds` added to the customer's contract countdown timer.
   - Reminder cadence: T-5 days (Push/SMS), T-1 day (SMS/WhatsApp with DVA details), Grace Period (24–48 hours), Default State (Automated AC Output Lockout), 36th Payment Cleared (`FULLY_OWNED` permanent unlock).

### B. Electrical & Hardware Anti-Tamper Engineering Rules
1. **Sealed Lower Terminal Security Box ("Inbuilt" Accountability):**
   - Never open the upper Growatt factory chassis (preserves factory warranty and prevents Faraday cage signal blocking).
   - Install a custom, heavy-gauge lockable metal shroud bolted flush to the bottom of the Growatt chassis enclosing the USB, RS485 (RJ45), Dry Contact ports, and AC/DC breakers, sealed with serialized steel utility meter cables and an internal **micro-plunger tamper switch**.
2. **Fail-Safe Heartbeat ("Dead-Man's Switch") Logic:**
   - Do not rely on sending a "LOCK" command over the air when a customer defaults (which can be defeated by jamming the antenna).
   - An edge Modbus/IoT controller inside the sealed lower shroud maintains a local countdown timer (`paid_until_ttl`). The Golang server sends an encrypted **Stay-Alive Heartbeat** every 15 minutes via MQTT. If the customer defaults OR blocks cellular connectivity, the local timer hits zero and cuts AC output automatically.
3. **Growatt EEPROM Flash Protection & Parasitic Drain Prevention:**
   - **NEVER** write continuous Modbus register updates to the Growatt inverter every few minutes (which wears out the 100,000-cycle EEPROM flash memory).
   - Trigger state changes **only on transition** (once on lock, once on unlock) OR switch an external 63A/100A AC Contactor / Growatt Dry Contact port in RAM.
   - During lockout, place the inverter into **Low-Power Standby Mode** while keeping the **Solar MPPT Charger ACTIVE** so batteries stay charged at 80%–100% SoC without dying from the inverter's 40W–60W idle self-consumption.
4. **Store-and-Forward Edge Buffering:**
   - The local edge controller must buffer up to 7 days of 5-minute telemetry frames in local flash memory during cellular outages and batch-upload upon reconnection.

### C. Software, ML & AI Guardrails
1. **Idempotent Double-Entry Financial Ledger:**
   - All payment webhooks (Paystack, Moniepoint, OPay) must verify HMAC cryptographic signatures and enforce a unique `idempotency_tx_ref` constraint.
   - Never overwrite a raw balance column; compute balances from immutable, append-only `ledger_entries` (`UPDATE` and `DELETE` disabled via PostgreSQL trigger).
2. **Cold-Start ML Bootstrapping:**
   - Days 1–14 after installation (when historical telemetry is insufficient) must use a **Synthetic Archetype Load Profile** generated from the customer's initial website Auto-Sizing Calculator appliance list.
   - Day 15+ transitions automatically to personalized **XGBoost / LightGBM** multi-horizon models (24-Hour hourly, 7-Day daily, 30-Day monthly).
3. **Strict Read-Only Boundary for LocalGridAgent (RAG + LLM):**
   - The AI chatbot (`LocalGridAgent`) has **ZERO write/execution permissions** on the billing ledger or hardware relay controls to prevent prompt injection attacks.
   - Use deterministic Python templates for daily 7:00 AM and 6:00 PM proactive energy briefings ($0 LLM token cost) and invoke the RAG+LLM pipeline only for interactive customer queries.

---

## 3. MONOREPO & VIRTUAL FILE SYSTEM (VFS) STRUCTURE

### A. Source Code Monorepo Layout
```text
growatt-payg-enterprise/
├── docker-compose.yml                  # Postgres 16 (TimescaleDB + pgvector), EMQX, Redis
├── Makefile                            # Build, test, migrate, and run orchestration
├── proto/                              # gRPC definitions (Golang <-> Python)
│   ├── forecasting.proto
│   └── localgrid_agent.proto
├── web-suite/                          # TypeScript / Next.js App Router Monorepo
│   ├── apps/
│   │   ├── public-showroom/            # Growatt Catalog, Appliance Calculator, Lead Capture
│   │   ├── customer-portal/            # Customer PWA: Live Energy Triangle, Forecasts, Pay, AI Chat
│   │   └── admin-command/              # Executive MRR/PAR, GIS Fleet Map, Tamper Watchtower, CRM
│   └── packages/
│       ├── ui-kit/                     # Shared SVG gauges, energy flow components, Tailwind theme
│       └── sizing-sdk/                 # Shared client/server sizing validation types
├── core-backend/                       # Golang Clean Architecture Engine
│   ├── cmd/
│   │   ├── api-server/main.go          # Fiber REST & WebSocket Server
│   │   ├── mqtt-gateway/main.go        # EMQX Telemetry Ingest & Heartbeat Publisher
│   │   └── cron-scheduler/main.go      # Credit Countdown & Lockout Enforcement Worker
│   ├── internal/
│   │   ├── domain/                     # Core entities: Customer, Contract, LedgerEntry, Device, Quote
│   │   ├── usecases/                   # Sizing, Amortization, PaymentProcessing, TelemetrySync
│   │   ├── adapters/
│   │   │   ├── handlers/               # REST controllers & Webhook receivers
│   │   │   ├── repositories/           # PostgreSQL / TimescaleDB repositories
│   │   │   ├── vfs_store/              # Atomic POSIX Virtual File System manager
│   │   │   ├── payments/               # Paystack, Moniepoint, OPay gateway drivers
│   │   │   └── growatt_oss/            # Growatt OpenAPI V1 & Edge Modbus protocol drivers
│   └── migrations/                     # SQL schema migrations
└── intelligence-engine/                # Python ML & RAG Microservice
    ├── app/
    │   ├── main.py                     # FastAPI / gRPC entrypoint
    │   ├── forecasting/
    │   │   ├── weather_client.py       # Open-Meteo / Solcast GPS irradiance client
    │   │   ├── cold_start.py           # Days 1-14 calculator-based synthetic curve generator
    │   │   ├── trainer.py              # XGBoost / LightGBM multi-horizon training pipeline
    │   │   └── inference.py            # 24h, 7d, and 30d prediction generator
    │   └── localgrid_agent/
    │       ├── ingest_manuals.py       # PDF chunker for Growatt manuals, fault codes & policies
    │       ├── vector_retriever.py     # pgvector semantic search
    │       ├── context_assembler.py    # Injects live state.json + ledger_snap.json + forecasts
    │       └── guardrails.py           # Read-only enforcement & safety escalation detector
    └── models_registry/                # Serialized model artifacts
```

### B. Runtime Virtual File System (VFS) Block Store (`/var/lib/payg-vfs/`)
Uses 2-level hexadecimal hash partitioning (`{h1}/{h2}`) derived from the Device UUID to prevent Linux inode exhaustion. All state updates MUST write to `{filename}.tmp` and execute an atomic POSIX `os.Rename()`.

```text
/var/lib/payg-vfs/
├── catalog/
│   └── growatt_spf_5000es/
│       ├── spec_sheet.json             # Rated W, surge VA, MPPT range, Modbus registers
│       └── manuals_embeddings.idx
└── blocks/
    └── 8f/
        └── 3a/
            └── DEV-8F3A-GROWATT-00421/
                ├── identity.json       # Immutable: Growatt S/N, LiFePO4 S/N, GPS, Install Date
                ├── state.json          # Atomic Dynamic: Relay state, Heartbeat TTL, Tamper status
                ├── ledger_snap.json    # Atomic Financial: Paid Days Left, Total Paid, Next Due
                ├── forecasts/
                │   ├── horizon_24h.json
                │   ├── horizon_7d.json
                │   └── horizon_30d.json
                ├── telemetry_wal/      # Append-only daily Parquet/CSV sensor logs
                │   └── 2026-10-28.parquet
                └── audit_vault/        # KYC documents, site audit photos, signed contract PDF
```

---

## 4. CORE ENGINEERING FORMULAS & DATA SCHEMAS

### A. Deterministic Auto-Sizing Calculator Formulas (Golang)
1. **Peak Running Load ($W_{\text{run}}$):** $\sum (\text{Appliance Watts} \times \text{Quantity})$
2. **Required Inverter Capacity ($VA_{\text{inv}}$):**
   $$\text{VA}_{\text{inv}} = \max\left(W_{\text{run}} \times 1.25, \, W_{\text{run}} + W_{\text{largest\_motor\_surge}}\right)$$
   *(Maps to Growatt SKUs: $\le 2400W \rightarrow \text{SPF 3000TL}$, $\le 4000W \rightarrow \text{SPF 5000ES}$, $> 4000W \rightarrow \text{Parallel SPF 5000ES or SPH 10000TL}$).*
3. **Required LiFePO4 Battery Bank ($Wh_{\text{batt}}$):**
   $$\text{Wh}_{\text{batt}} = \frac{\sum (W_{\text{night\_load}} \times \text{Backup Hours})}{\eta_{\text{inv}} (0.92) \times \text{DoD}_{\text{LiFePO4}} (0.80)}$$
4. **Required Solar PV Array ($W_{\text{pv}}$):**
   $$\text{W}_{\text{pv}} = \frac{(\text{Wh}_{\text{batt}} \times 0.80) + \text{Wh}_{\text{daytime\_load}}}{\text{Peak Sun Hours } (4.5\text{h}) \times \text{System Derating } (0.78)}$$

### B. Unified PostgreSQL 16 Schema Specification (OLTP + TimescaleDB + pgvector)
- **`sizing_quotes` (OLTP):** `id (UUID PK)`, `full_name`, `phone`, `email`, `city`, `gps_lat`, `gps_lng`, `appliances_jsonb`, `running_watts`, `surge_va`, `recommended_growatt_sku`, `recommended_battery_kwh`, `recommended_pv_kwp`, `payment_mode (OUTRIGHT, INSTALLMENT)`, `tenure_months (1..36)`, `down_payment_kobo`, `monthly_installment_kobo`, `status`.
- **`contracts` (OLTP):** `id (UUID PK)`, `customer_id (UUID FK)`, `device_id (UUID FK)`, `total_price_kobo`, `down_payment_kobo`, `insurance_fee_kobo`, `monthly_installment_kobo`, `tenure_months`, `repayment_frequency (DAILY, WEEKLY, MONTHLY)`, `paid_until_at (TIMESTAMPTZ)`, `status (PENDING_INSTALL, ACTIVE, GRACE_PERIOD, LOCKED_DEFAULT, LOCKED_TAMPER, FULLY_OWNED)`.
- **`virtual_accounts` (OLTP):** `id (UUID PK)`, `contract_id (UUID FK)`, `provider (MONIEPOINT, PAYSTACK, OPAY)`, `account_number (UNIQUE)`, `account_name`, `bank_name`, `provider_customer_code`.
- **`ledger_entries` (Immutable OLTP):** `id (UUID PK)`, `contract_id (UUID FK)`, `provider`, `idempotency_tx_ref (VARCHAR UNIQUE NOT NULL)`, `entry_type (CREDIT, DEBIT)`, `amount_kobo (BIGINT NOT NULL)`, `energy_seconds_delta (BIGINT NOT NULL)`, `raw_webhook_jsonb`, `created_at (TIMESTAMPTZ)`. *(Enforce PostgreSQL trigger blocking `UPDATE` and `DELETE`)*.
- **`devices` (OLTP):** `id (UUID PK)`, `growatt_serial (VARCHAR UNIQUE)`, `battery_serial`, `edge_controller_imei (UNIQUE)`, `model_sku`, `pv_kwp_installed`, `battery_kwh_installed`, `gps_lat`, `gps_lng`, `vfs_path`, `relay_state (ACTIVE_ON, STANDBY_LOCKED, FAULT_OFF)`, `tamper_switch_state (SEALED, TRIPPED)`, `last_heartbeat_at`.
- **`inverter_telemetry` (TimescaleDB Hypertable):** `time (TIMESTAMPTZ NOT NULL)`, `device_id (UUID NOT NULL)`, `pv_volts`, `pv_watts`, `ac_output_watts`, `ac_grid_volts`, `battery_volts`, `battery_soc_pct`, `inverter_temp_c`, `growatt_status_code`, `growatt_fault_code`, `tamper_pin_high (BOOL)`. *(Partitioned by 7 days, compressed after 14 days)*.
- **`knowledge_vectors` (pgvector):** `id (UUID PK)`, `doc_category (GROWATT_MANUAL, FAULT_CODE, FINANCING_POLICY, APPLIANCE_TIPS)`, `model_sku`, `chunk_text`, `embedding (VECTOR(1536))`.

---

## 5. SEQUENTIAL 6-BATCH EXECUTION PLAN

Execute the project strictly one batch at a time. After completing all files in a batch, provide verification tests and wait for user approval before moving to the next batch.

### BATCH 1: Database Cluster, Immutable Migrations & Golang Atomic VFS Engine
1. Create `docker-compose.yml` provisioning PostgreSQL 16 (with `timescaledb` and `vector` extensions), EMQX 5.x MQTT broker, and Redis.
2. Write complete SQL migration files in `core-backend/migrations/` creating all tables, indexes, TimescaleDB hypertables, and the append-only PostgreSQL trigger for `ledger_entries`.
3. Implement `core-backend/internal/adapters/vfs_store/vfs.go`:
   - Deterministic 2-level SHA256/UUID hex directory resolver (`/var/lib/payg-vfs/blocks/{h1}/{h2}/{device_id}`).
   - Thread-safe `WriteJSONAtomic(relPath, payload)` using `.tmp` file write + `fsync` + `os.Rename`.
   - `ReadJSON(relPath, targetStruct)` and Parquet/CSV append logger for `telemetry_wal`.

### BATCH 2: Golang Auto-Sizing Engine & Public Website Showroom (Next.js)
1. Implement `core-backend/internal/usecases/sizing_calculator.go`:
   - Pre-configured Nigerian household appliance database (wattage + inductive motor surge factors for fridges, freezers, borehole pumps, inverter ACs, fans, lighting).
   - Exact Growatt bundle matcher, LiFePO4 battery sizing, PV array sizing, and 36-month amortization schedule generator (enforcing the 30%–35% down payment and insurance fee).
2. Expose `POST /api/v1/public/calculate-size` and `POST /api/v1/public/leads`.
3. Build `web-suite/apps/public-showroom`:
   - Growatt Product Showroom (Starter 3kVA, Family 5kVA, Commercial 10kVA bundles).
   - Interactive Appliance-First Visual Calculator with Daytime/Nighttime hour sliders and 3-to-36-month payment plan configurator.
   - Lead capture modal booking a physical Site Audit.

### BATCH 3: Idempotent Fintech Engine, Multi-Rail Webhooks & Credit Clock (Golang)
1. Implement `core-backend/internal/adapters/payments/` for **Paystack**, **Moniepoint**, and **OPay**:
   - Dedicated Virtual Account (DVA) provisioning upon contract creation.
   - HMAC-SHA512 webhook signature verification middleware.
2. Implement `core-backend/internal/usecases/ledger_processor.go`:
   - ACID transaction processing incoming webhooks, checking `idempotency_tx_ref`, inserting into `ledger_entries`, converting `amount_kobo` into `energy_seconds_delta`, updating `contracts.paid_until_at`, and atomically syncing `ledger_snap.json` in the VFS.
3. Implement `core-backend/cmd/cron-scheduler/main.go`:
   - Evaluates active contracts every 5 minutes, dispatches T-5d and T-1d reminders, transitions expired contracts from `ACTIVE` $\rightarrow$ `GRACE_PERIOD` $\rightarrow$ `LOCKED_DEFAULT`, and transitions completed 36-month contracts to `FULLY_OWNED`.

### BATCH 4: Hardware Comms (MQTT + Growatt OSS), Fail-Safe Heartbeat & Admin Command Center
1. Implement `core-backend/cmd/mqtt-gateway/main.go`:
   - Subscribes to `devices/+/telemetry` and `devices/+/tamper` on EMQX.
   - Writes incoming 5-minute frames to TimescaleDB `inverter_telemetry` and VFS `state.json`.
   - Immediately locks contract and triggers critical alert if `tamper_pin_high == true`.
   - Publishes encrypted 15-minute **Stay-Alive Heartbeat** (`devices/{id}/heartbeat`) containing `paid_until_unix` so the local sealed controller keeps the AC contactor/dry-contact closed without wearing out Growatt EEPROM.
2. Implement `core-backend/internal/adapters/growatt_oss/client.go`:
   - Secondary cloud poller integrating Growatt ShineServer / OpenAPI V1 for historical verification.
3. Build `web-suite/apps/admin-command`:
   - Executive KPI cards (Active Fleet, MRR, Collection Efficiency %, PAR > 30d).
   - Live GIS Fleet Map with Green (Active), Yellow (Due/Low Battery), and Red (Locked/Tamper Tripped) GPS pins.
   - CRM Lead-to-Commissioning workflow and Serial Number Inventory tracker.

### BATCH 5: Python Multi-Horizon Forecasting Pipeline (24h, 7d, 30d)
1. Implement `intelligence-engine/app/forecasting/weather_client.py`:
   - Fetches hourly & daily Global Horizontal Irradiance ($GHI$), cloud cover %, and ambient temperature for each device's exact GPS coordinates via Open-Meteo Solar API.
2. Implement `intelligence-engine/app/forecasting/cold_start.py`:
   - Generates hourly load & solar curves for newly installed systems (Days 1–14) using their `sizing_quotes.appliances_jsonb` archetype.
3. Implement `intelligence-engine/app/forecasting/trainer.py` & `inference.py`:
   - Extracts temporal encodings, 1h/24h/168h lags, and rolling consumption averages from TimescaleDB.
   - Trains XGBoost regressors for **Solar Generation ($W$)** and **Customer Load Demand ($W$)** across **Next 24 Hours (hourly)**, **Next 7 Days (daily)**, and **Next 30 Days (monthly)**.
   - Writes atomic forecast JSON files directly to `/var/lib/payg-vfs/blocks/{h1}/{h2}/{device_id}/forecasts/` and exposes gRPC endpoints to Golang.

### BATCH 6: LocalGridAgent (RAG + Read-Only LLM) & Customer Mobile/Web PWA
1. Implement `intelligence-engine/app/localgrid_agent/`:
   - `ingest_manuals.py`: Indexes Growatt SPF/SPH manuals, warning/fault codes (e.g., Warning 04 Low Battery, Fault 09 Bus Soft Start, Fault 58 Output Voltage Low), and company repayment policies into PostgreSQL `pgvector`.
   - `context_assembler.py`: Dynamically combines retrieved manual chunks with the customer's live `state.json`, `ledger_snap.json`, and `horizon_24h.json`.
   - `guardrails.py`: Enforces strict read-only permissions (zero tool-calling access to unlock relays or modify balances) and escalates physical safety keywords (fire, smoke, arc, broken panel) to the Admin dashboard.
   - Deterministic 7:00 AM Morning Briefing and 6:00 PM Deficit Warning generator.
2. Build `web-suite/apps/customer-portal` (Mobile-First PWA):
   - Animated SVG **Live Energy Flow Triangle** (Solar PV $\rightarrow$ Growatt Inverter $\rightarrow$ Home Load & LiFePO4 Battery SoC).
   - **Forecast & Savings Tabs:** 24h optimal appliance load-shifting timeline, 7d rainy-day battery coaching, 30d generator fuel savings calculator.
   - **Financial Hub:** Circular "Active Energy Days Remaining" gauge, 36-month ownership progress bar, one-tap copy for Dedicated Virtual Account (Moniepoint/Paystack/OPay), and instant PDF receipt downloads.
   - **LocalGridAgent Chat Drawer:** Interactive AI energy advisor & Growatt diagnostics assistant.

---

## 6. INITIALIZATION INSTRUCTION
Acknowledge this specification, confirm the architecture constraints, and immediately generate **BATCH 1** (`docker-compose.yml`, complete SQL migrations in `core-backend/migrations/001_init_schema.sql`, and the complete `core-backend/internal/adapters/vfs_store/vfs.go` package).
