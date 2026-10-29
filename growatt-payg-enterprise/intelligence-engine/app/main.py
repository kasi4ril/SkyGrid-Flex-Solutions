"""
main.py
Unified FastAPI & gRPC Entrypoint for the Python Intelligence Engine
(Batch 5 Multi-Horizon Forecasting + Batch 6 LocalGridAgent RAG).
"""

from __future__ import annotations

import os
from typing import List, Optional
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from .forecasting.cold_start import ColdStartApplianceSpec
from .forecasting.inference import MultiHorizonInferenceEngine
from .forecasting.weather_client import OpenMeteoSolarClient
from .localgrid_agent.context_assembler import LocalGridContextAssembler

VFS_ROOT = os.getenv("PAYG_VFS_ROOT", "/tmp/payg-vfs-dev")
MODELS_DIR = os.getenv("MODELS_REGISTRY_DIR", "./models_registry")

app = FastAPI(
    title="SkyTron Growatt PAYG Intelligence Engine (ML Forecasting & LocalGridAgent RAG)",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

forecast_engine = MultiHorizonInferenceEngine(vfs_root=VFS_ROOT, registry_dir=MODELS_DIR)
agent_assembler = LocalGridContextAssembler(vfs_root=VFS_ROOT)


class ApplianceInputDTO(BaseModel):
    appliance_code: str
    rated_watts: int
    quantity: int
    daytime_hours: float
    nighttime_hours: float


class GenerateForecastRequestDTO(BaseModel):
    device_id: str
    contract_id: str
    gps_lat: float = 9.0765
    gps_lng: float = 7.3986
    pv_kwp_installed: float = 4.40
    battery_kwh_installed: float = 5.12
    days_since_install: int = Field(default=5, ge=1)
    cold_start_appliances: Optional[List[ApplianceInputDTO]] = None


class AgentQueryRequestDTO(BaseModel):
    device_id: str
    model_sku: str = "GROWATT_SPF_5000ES"
    customer_query: str


class DailyBriefingRequestDTO(BaseModel):
    device_id: str
    briefing_type: str = "MORNING_0700"


@app.get("/healthz")
def health_check() -> dict:
    return {"status": "healthy", "service": "growatt-payg-intelligence-engine", "vfs_root": VFS_ROOT}


@app.post("/api/v1/intelligence/forecast")
def generate_forecasts(req: GenerateForecastRequestDTO) -> dict:
    specs = None
    if req.cold_start_appliances:
        specs = [
            ColdStartApplianceSpec(
                appliance_code=a.appliance_code,
                rated_watts=a.rated_watts,
                quantity=a.quantity,
                daytime_hours=a.daytime_hours,
                nighttime_hours=a.nighttime_hours,
            )
            for a in req.cold_start_appliances
        ]
    return forecast_engine.generate_and_persist_forecasts(
        device_id=req.device_id,
        contract_id=req.contract_id,
        gps_lat=req.gps_lat,
        gps_lng=req.gps_lng,
        pv_kwp_installed=req.pv_kwp_installed,
        battery_kwh_installed=req.battery_kwh_installed,
        days_since_install=req.days_since_install,
        cold_start_appliances=specs,
        allow_network_weather=False,
    )


@app.post("/api/v1/intelligence/harmattan-check")
def check_harmattan_soiling(
    device_id: str,
    pv_kwp_installed: float = 4.4,
    observed_peak_pv_watts: float = 1950.0,
    current_ghi_wm2: float = 800.0,
    ambient_temp_c: float = 31.0,
) -> dict:
    diag = OpenMeteoSolarClient.evaluate_harmattan_soiling(
        device_id=device_id,
        pv_kwp_installed=pv_kwp_installed,
        observed_peak_pv_watts=observed_peak_pv_watts,
        current_ghi_wm2=current_ghi_wm2,
        ambient_temp_c=ambient_temp_c,
    )
    return diag.__dict__


@app.post("/api/v1/intelligence/agent-query")
def query_localgrid_agent(req: AgentQueryRequestDTO) -> dict:
    return agent_assembler.answer_customer_query(
        device_id=req.device_id,
        model_sku=req.model_sku,
        customer_query=req.customer_query,
    )


@app.post("/api/v1/intelligence/daily-briefing")
def generate_daily_briefing(req: DailyBriefingRequestDTO) -> dict:
    return agent_assembler.generate_deterministic_daily_briefing(
        device_id=req.device_id,
        briefing_type=req.briefing_type,
    )