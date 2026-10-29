"""
FastAPI Microservice Entrypoint for the Intelligence Engine.
Provides HTTP REST endpoints for Multi-Horizon Solar & Load Forecasting,
Cold-Start Generation, and Harmattan Dust Soiling Diagnostics.
"""

from typing import List, Optional
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from app.forecasting.cold_start import ColdStartApplianceSpec
from app.forecasting.inference import MultiHorizonInferenceEngine
from app.forecasting.weather_client import OpenMeteoSolarClient

app = FastAPI(
    title="Growatt PAYG Intelligence Engine",
    description="Multi-Horizon ML Forecasting, Harmattan Detection & LocalGridAgent Microservice",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

engine = MultiHorizonInferenceEngine(
    vfs_root="/var/lib/payg-vfs",
    registry_dir="models_registry",
)


class ApplianceInput(BaseModel):
    code: str
    rated_watts: float
    quantity: int = 1
    day_hours: float = Field(default=2.0, ge=0, le=24)
    night_hours: float = Field(default=8.0, ge=0, le=24)


class ForecastRequest(BaseModel):
    device_id: str
    contract_id: str
    gps_lat: float = 9.0765  # Abuja default
    gps_lng: float = 7.3986
    pv_kwp_installed: float = 4.40
    battery_kwh_installed: float = 5.12
    days_since_install: int = 1
    appliances: Optional[List[ApplianceInput]] = None
    allow_network_weather: bool = False


class HarmattanRequest(BaseModel):
    device_id: str
    pv_kwp_installed: float
    observed_peak_pv_watts: float
    current_ghi_wm2: float
    ambient_temp_c: float = 30.0


@app.get("/healthz")
def healthz():
    return {
        "status": "healthy",
        "service": "intelligence-engine",
        "supported_horizons": ["24h", "7d", "30d"],
    }


@app.post("/api/v1/forecast/generate")
def generate_forecast(req: ForecastRequest):
    try:
        cold_start_specs = [
            ColdStartApplianceSpec(
                code=a.code,
                rated_watts=a.rated_watts,
                quantity=a.quantity,
                day_hours=a.day_hours,
                night_hours=a.night_hours,
            )
            for a in (req.appliances or [])
        ]

        result = engine.generate_and_persist_forecasts(
            device_id=req.device_id,
            contract_id=req.contract_id,
            gps_lat=req.gps_lat,
            gps_lng=req.gps_lng,
            pv_kwp_installed=req.pv_kwp_installed,
            battery_kwh_installed=req.battery_kwh_installed,
            days_since_install=req.days_since_install,
            cold_start_appliances=cold_start_specs,
            allow_network_weather=req.allow_network_weather,
        )
        return {
            "status": "success",
            "data": result,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/v1/diagnostics/harmattan")
def check_harmattan(req: HarmattanRequest):
    try:
        diag = OpenMeteoSolarClient.evaluate_harmattan_soiling(
            device_id=req.device_id,
            pv_kwp_installed=req.pv_kwp_installed,
            observed_peak_pv_watts=req.observed_peak_pv_watts,
            current_ghi_wm2=req.current_ghi_wm2,
            ambient_temp_c=req.ambient_temp_c,
        )
        return {
            "status": "success",
            "data": {
                "device_id": diag.device_id,
                "expected_pv_watts": diag.expected_pv_watts,
                "observed_pv_watts": diag.observed_pv_watts,
                "soiling_loss_pct": diag.soiling_loss_pct,
                "trigger_cleaning_alert": diag.trigger_cleaning_alert,
                "advisory_message": diag.advisory_message,
            },
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)

