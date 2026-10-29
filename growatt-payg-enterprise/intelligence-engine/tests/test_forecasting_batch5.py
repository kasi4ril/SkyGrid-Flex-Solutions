"""
test_forecasting_batch5.py
Verification Suite for Batch 5: Multi-Horizon Forecasting, Cold-Start Bootstrapping,
Harmattan Dust Soiling Detection, and Atomic VFS JSON Persistence.
"""

from datetime import datetime, timedelta, timezone
from pathlib import Path
import json
import pandas as pd

from app.forecasting.weather_client import OpenMeteoSolarClient
from app.forecasting.cold_start import ColdStartApplianceSpec
from app.forecasting.trainer import MultiHorizonTrainer
from app.forecasting.inference import MultiHorizonInferenceEngine


def test_cold_start_days_1_to_14_and_atomic_vfs_writes(tmp_path: Path) -> None:
    vfs_root = tmp_path / "payg-vfs"
    reg_dir = tmp_path / "models"

    engine = MultiHorizonInferenceEngine(
        vfs_root=str(vfs_root),
        registry_dir=str(reg_dir),
    )

    device_id = "DEV-8F3A-GROWATT-00421"
    appliances = [
        ColdStartApplianceSpec("LED_BULB_15W", 15, 8, 2.0, 8.0),
        ColdStartApplianceSpec("INVERTER_FRIDGE_180W", 180, 1, 6.0, 6.0),
        ColdStartApplianceSpec("BOREHOLE_PUMP_1HP", 750, 1, 1.0, 0.0),
    ]

    # Day 5 after installation -> Must use COLD_START_SYNTHETIC_ARCHETYPE
    result = engine.generate_and_persist_forecasts(
        device_id=device_id,
        contract_id="CTR-NG-2026-001",
        gps_lat=7.1904,   # Otukpo, Benue State
        gps_lng=8.1297,
        pv_kwp_installed=4.40,
        battery_kwh_installed=5.12,
        days_since_install=5,
        cold_start_appliances=appliances,
        allow_network_weather=False,
    )

    assert result["engine_mode"] == "COLD_START_SYNTHETIC_ARCHETYPE"

    # Verify all 3 horizon JSON files exist in the 2-level hex VFS directory
    for key in ("horizon_24h", "horizon_7d", "horizon_30d"):
        file_path = Path(result["vfs_paths"][key])
        assert file_path.exists(), f"Expected VFS forecast file {file_path} to exist"
        loaded = json.loads(file_path.read_text(encoding="utf-8"))
        assert loaded["device_id"] == device_id

    assert len(result["horizon_24h"]["hourly_series"]) == 24
    assert len(result["horizon_7d"]["daily_series"]) == 7
    assert result["horizon_30d"]["generator_fuel_saved_ngn"] > 0


def test_day_15_plus_xgboost_personalized_transition(tmp_path: Path) -> None:
    vfs_root = tmp_path / "payg-vfs"
    reg_dir = tmp_path / "models"
    device_id = "DEV-4C91-GROWATT-00812"

    # Synthesize 16 days (384 hours) of historical TimescaleDB telemetry
    weather_points = OpenMeteoSolarClient.generate_deterministic_nigerian_weather(
        gps_lat=9.0765,
        forecast_days=16,
        start_time=datetime(2026, 10, 1, tzinfo=timezone.utc),
    )

    rows = []
    for wp in weather_points:
        sim_pv = OpenMeteoSolarClient.estimate_pv_generation_watts(4.4, wp.ghi_wm2, wp.ambient_temp_c)
        sim_load = 650.0 if 8 <= wp.hour_of_day <= 21 else 320.0
        rows.append({
            "timestamp": wp.timestamp_iso,
            "pv_watts": sim_pv,
            "ac_output_watts": sim_load,
            "ghi_wm2": wp.ghi_wm2,
            "cloud_cover_pct": wp.cloud_cover_pct,
            "ambient_temp_c": wp.ambient_temp_c,
        })

    df_history = pd.DataFrame(rows)
    trainer = MultiHorizonTrainer(registry_dir=str(reg_dir))
    trained = trainer.train_for_device(device_id, df_history)
    assert trained.train_samples == 384

    # Run inference on Day 16 -> Must automatically transition to PERSONALIZED model
    engine = MultiHorizonInferenceEngine(vfs_root=str(vfs_root), registry_dir=str(reg_dir))
    res = engine.generate_and_persist_forecasts(
        device_id=device_id,
        contract_id="CTR-NG-2026-014",
        gps_lat=9.0765,
        gps_lng=7.3986,
        pv_kwp_installed=4.40,
        battery_kwh_installed=5.12,
        days_since_install=16,
        allow_network_weather=False,
    )
    assert res["engine_mode"].startswith("PERSONALIZED_")


def test_harmattan_dust_soiling_detector() -> None:
    # 4.4 kWp array under 800 W/m^2 clear-sky midday sun should produce ~2,750W.
    # Observing only 1,900W (~31% loss) must trigger the Harmattan cleaning alert.
    diag = OpenMeteoSolarClient.evaluate_harmattan_soiling(
        device_id="DEV-8F3A-GROWATT-00421",
        pv_kwp_installed=4.40,
        observed_peak_pv_watts=1900.0,
        current_ghi_wm2=800.0,
        ambient_temp_c=31.0,
    )
    assert diag.trigger_cleaning_alert is True
    assert diag.soiling_loss_pct >= 18.0
    assert "Harmattan Dust Alert" in diag.advisory_message