# SkyGrid Flex Solutions - Enterprise Growatt PAYG & Smart Energy Platform

Unified Enterprise Pay-As-You-Go (PAYG) solar management and smart energy platform integrating:
- **Core Go Backend**: REST API, Atomic POSIX Virtual File System (VFS), and concurrency-safe token/credit ledgers.
- **Python Intelligence Engine**: FastAPI & ML forecasting (Open-Meteo solar yield, Harmattan dust soiling detection, cold-start bootstrapping).
- **Background Workers**: MQTT Gateway (EMQX integration) & automated Cron Scheduler for daily billing and heartbeat reconciliations.
- **Docker Infrastructure**: TimescaleDB (PostgreSQL 16 + pgvector), EMQX MQTT broker, and Redis 7.

---

## 🚀 Quickstart Guide (After Cloning from GitHub)

Because compiled binaries and Python virtual environments (`.venv/`) are excluded from Git (`.gitignore`), setting up a freshly cloned repository is automated.

### Option 1: Zero-Configuration Auto Boot (Recommended)

Simply clone and launch:

```bash
git clone <repo-url>
cd SkyGrid-Flex-Solutions
./start_all.sh
```

> **Note:** On your first run, `./start_all.sh` automatically detects that `.venv` is missing, provisions the virtual environment, installs the required Python microservice dependencies, and boots all platform services with zero manual effort.

---

### Option 2: Explicit Developer Setup

If you prefer to initialize the environment, dependencies, and binaries before booting:

```bash
git clone <repo-url>
cd SkyGrid-Flex-Solutions
./setup.sh
./start_all.sh
```

Or via Make (inside `growatt-payg-enterprise/`):

```bash
make setup
make build
./start_all.sh
```

---

## 🛑 Stopping All Services

To cleanly terminate all microservices and background processes:

```bash
./stop_all.sh
```
Or press `Ctrl+C` in the terminal where `./start_all.sh` is running.

---

## 🌐 Service Endpoints

Once booted, the following services are available:

| Service | Port / Protocol | Health Check / Documentation |
| :--- | :--- | :--- |
| **Core REST API** | `http://localhost:8080` | `http://localhost:8080/healthz` |
| **Sizing & ROI Catalog** | `http://localhost:8080` | `http://localhost:8080/api/v1/public/catalog` |
| **Python Intelligence Engine** | `http://localhost:8000` | `http://localhost:8000/healthz` |
| **Interactive Swagger Docs** | `http://localhost:8000` | `http://localhost:8000/docs` |
| **EMQX MQTT Broker** | `tcp://localhost:1883` | `http://localhost:18083` (Dashboard) |
| **Redis Cache** | `localhost:6379` | `redis-cli ping` |

---

## 🛠️ Prerequisites

- **Linux / macOS / WSL2**
- **Python 3.10+** (with `python3-venv`)
- **Go 1.22+**
- **Docker & Docker Compose** (Optional: the platform includes a local fallback Atomic POSIX VFS mode when Docker is not running)
