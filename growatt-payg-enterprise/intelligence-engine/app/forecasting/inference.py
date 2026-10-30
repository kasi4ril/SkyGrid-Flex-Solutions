"""
inference.py
Multi-Horizon Inference Engine (24h Hourly, 7d Daily, 30d Monthly) & Atomic POSIX VFS Writer.

VFS Compatibility Invariant:
Uses the exact same SHA256 2-level hexadecimal hash resolver (`blocks/{h1}/{h2}/{device_id}/forecasts/`)
and atomic `.tmp` + `os.fsync` + `os.replace` pattern as the Golang `vfs_store` package.
"""

from __future__ import annotations

import hashlib
import json
import math
import os
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

from .cold_start import ColdStartApplianceSpec, ColdStartSyntheticGenerator
from .trainer import FEATURE_COLUMNS, MultiHorizonTrainer, TrainedDeviceModels
from .weather_client import HourlyWeatherPoint, OpenMeteoSolarClient

try:
    import numpy as np
except ImportError:
    np = None


class MultiHorizonInferenceEngine:
    """
    Generates 24-Hour, 7-Day, and 30-Day Solar & Load Forecasts and writes them
    atomically into the device's POSIX Virtual File System (VFS) block.
    """

    def __init__(
        self,
        vfs_root: str = "/var/lib/payg-vfs",
        registry_dir: str = "./models_registry",
    ) -> None:
        self.vfs_root = Path(vfs_root).resolve()
        self.weather_client = OpenMeteoSolarClient()
        self.trainer = MultiHorizonTrainer(registry_dir=registry_dir)

    def resolve_device_forecasts_dir(self, device_id: str) -> Path:
        """
        Matches Golang `VFSManager.ResolveDeviceBlockDir` byte-for-byte:
        SHA256(device_id) -> hex[0:2] / hex[2:4] / device_id / forecasts
        """
        clean_id = device_id.strip()
        if not clean_id or ".." in clean_id or "/" in clean_id or "\\" in clean_id:
            raise ValueError("Invalid or unsafe device_id for VFS resolution")

        digest = hashlib.sha256(clean_id.encode("utf-8")).hexdigest()
        h1, h2 = digest[0:2], digest[2:4]
        forecast_dir = self.vfs_root / "blocks" / h1 / h2 / clean_id / "forecasts"
        forecast_dir.mkdir(parents=True, exist_ok=True)
        return forecast_dir

    @staticmethod
    def write_json_atomic(target_path: Path, payload: Dict[str, Any]) -> None:
        """
        Writes JSON to a sibling `.tmp` file, flushes OS buffers via fsync,
        and performs an atomic POSIX `os.replace()`.
        """
        target_path.parent.mkdir(parents=True, exist_ok=True)
        tmp_path = target_path.with_suffix(f".{os.getpid()}.tmp")

        encoded = (json.dumps(payload, indent=2) + "\n").encode("utf-8")
        with open(tmp_path, "wb") as f:
            f.write(encoded)
            f.flush()
            os.fsync(f.fileno())

        os.replace(tmp_path, target_path)

    def generate_and_persist_forecasts(
        self,
        device_id: str,
        contract_id: str,
        gps_lat: float,
        gps_lng: float,
        pv_kwp_installed: float,
        battery_kwh_installed: float,
        days_since_install: int,
        cold_start_appliances: Optional[List[ColdStartApplianceSpec]] = None,
        allow_network_weather: bool = False,
    ) -> Dict[str, Any]:
        """
        Executes the end-to-end multi-horizon forecast pipeline:
        - Days 1–14: Cold-Start Synthetic Archetype Profile
        - Day 15+: Personalized XGBoost / Gradient Boosting Model (if trained artifact exists)
        Writes `horizon_24h.json`, `horizon_7d.json`, and `horizon_30d.json` to the VFS.
        """
        weather_7d = self.weather_client.fetch_hourly_irradiance(
            gps_lat=gps_lat,
            gps_lng=gps_lng,
            forecast_days=7,
            allow_network=allow_network_weather,
        )

        trained_bundle: Optional[TrainedDeviceModels] = None
        if days_since_install >= 15:
            trained_bundle = self.trainer.load_device_models(device_id)

        engine_mode = (
            f"PERSONALIZED_{trained_bundle.model_type}"
            if (days_since_install >= 15 and trained_bundle is not None)
            else "COLD_START_SYNTHETIC_ARCHETYPE"
        )

        # Build baseline 24-hour load lookup from Cold-Start calculator archetype
        synthetic_24h_load = ColdStartSyntheticGenerator.build_24h_load_profile_watts(
            cold_start_appliances or []
        )

        # Simulate hourly trajectory across 7 days (168 hours) including LiFePO4 SoC %
        hourly_points: List[Dict[str, Any]] = []
        battery_wh_capacity = max(2560.0, battery_kwh_installed * 1000.0)
        current_soc_pct = 82.0
        prev_load_w = synthetic_24h_load.get(0, 350.0)

        for idx, wp in enumerate(weather_7d):
            hour = wp.hour_of_day
            base_load_w = synthetic_24h_load.get(hour, 400.0)

            if trained_bundle is not None and days_since_install >= 15:
                dow = (idx // 24) % 7
                feat_vec = np.array([[
                    math.sin(2.0 * math.pi * hour / 24.0),
                    math.cos(2.0 * math.pi * hour / 24.0),
                    math.sin(2.0 * math.pi * dow / 7.0),
                    math.cos(2.0 * math.pi * dow / 7.0),
                    wp.ghi_wm2,
                    wp.cloud_cover_pct,
                    wp.ambient_temp_c,
                    prev_load_w,
                    base_load_w,
                    base_load_w,
                ]], dtype=np.float64)
                pred_solar_w = float(np.clip(trained_bundle.solar_model.predict(feat_vec)[0], 0.0, pv_kwp_installed * 1000.0))
                if wp.ghi_wm2 <= 5.0:
                    pred_solar_w = 0.0
                pred_load_w = float(np.clip(trained_bundle.load_model.predict(feat_vec)[0], 50.0, 12000.0))
            else:
                pred_solar_w = self.weather_client.estimate_pv_generation_watts(
                    pv_kwp_installed=pv_kwp_installed,
                    ghi_wm2=wp.ghi_wm2,
                    ambient_temp_c=wp.ambient_temp_c,
                )
                pred_load_w = base_load_w

            prev_load_w = pred_load_w

            # Update projected LiFePO4 Battery State of Charge (SoC %) with 20% reserve floor (80% DoD)
            net_watts = pred_solar_w - pred_load_w
            delta_soc = (net_watts / battery_wh_capacity) * 100.0
            current_soc_pct = max(20.0, min(100.0, current_soc_pct + delta_soc))

            hourly_points.append({
                "timestamp_iso": wp.timestamp_iso,
                "hour_of_day": hour,
                "ghi_wm2": wp.ghi_wm2,
                "cloud_cover_pct": wp.cloud_cover_pct,
                "predicted_solar_watts": round(pred_solar_w, 1),
                "predicted_load_watts": round(pred_load_w, 1),
                "projected_battery_soc_pct": round(current_soc_pct, 1),
                "optimal_heavy_appliance_window": bool(pred_solar_w >= pred_load_w + 600.0),
            })

        now_iso = datetime.now(timezone.utc).isoformat()
        forecasts_dir = self.resolve_device_forecasts_dir(device_id)

        # 1. Construct & Write Next 24-Hour Hourly Forecast (horizon_24h.json)
        next_24h = hourly_points[:24]
        peak_solar_hour = max(next_24h, key=lambda x: x["predicted_solar_watts"])
        min_soc_point = min(next_24h, key=lambda x: x["projected_battery_soc_pct"])

        horizon_24h_payload = {
            "device_id": device_id,
            "contract_id": contract_id,
            "horizon": "24_HOURS_HOURLY",
            "engine_mode": engine_mode,
            "generated_at": now_iso,
            "peak_solar_hour": peak_solar_hour["hour_of_day"],
            "peak_solar_watts": peak_solar_hour["predicted_solar_watts"],
            "overnight_min_battery_soc_pct": min_soc_point["projected_battery_soc_pct"],
            "load_shifting_coaching": (
                f"Run 1HP borehole pump, iron, and washing machine between 11:00 AM and 02:30 PM "
                f"(Peak Solar: {peak_solar_hour['predicted_solar_watts']:.0f}W) to enter tonight at 100% LiFePO4 charge."
            ),
            "hourly_series": next_24h,
        }
        path_24h = forecasts_dir / "horizon_24h.json"
        self.write_json_atomic(path_24h, horizon_24h_payload)

        # 2. Construct & Write Next 7-Day Daily Forecast (horizon_7d.json)
        daily_series: List[Dict[str, Any]] = []
        for day_idx in range(7):
            chunk = hourly_points[day_idx * 24 : (day_idx + 1) * 24]
            if not chunk:
                continue
            solar_kwh = sum(p["predicted_solar_watts"] for p in chunk) / 1000.0
            load_kwh = sum(p["predicted_load_watts"] for p in chunk) / 1000.0
            avg_cloud = sum(p["cloud_cover_pct"] for p in chunk) / len(chunk)
            rainy_day_alert = solar_kwh < (load_kwh * 0.90)

            daily_series.append({
                "day_index": day_idx + 1,
                "date_iso": chunk[0]["timestamp_iso"][:10],
                "predicted_solar_kwh": round(solar_kwh, 2),
                "predicted_load_kwh": round(load_kwh, 2),
                "avg_cloud_cover_pct": round(avg_cloud, 1),
                "rainy_deficit_warning": rainy_day_alert,
                "battery_coaching_tip": (
                    "Cloudy/Rainy deficit expected: reduce overnight AC runtime by 2 hours to preserve 35% LiFePO4 reserve."
                    if rainy_day_alert
                    else "Surplus solar harvest expected: full overnight appliance autonomy available."
                ),
            })

        horizon_7d_payload = {
            "device_id": device_id,
            "contract_id": contract_id,
            "horizon": "7_DAYS_DAILY",
            "engine_mode": engine_mode,
            "generated_at": now_iso,
            "daily_series": daily_series,
        }
        path_7d = forecasts_dir / "horizon_7d.json"
        self.write_json_atomic(path_7d, horizon_7d_payload)

        # 3. Construct & Write Next 30-Day Monthly Forecast & Generator Savings (horizon_30d.json)
        avg_daily_solar_kwh = sum(d["predicted_solar_kwh"] for d in daily_series) / max(1, len(daily_series))
        avg_daily_load_kwh = sum(d["predicted_load_kwh"] for d in daily_series) / max(1, len(daily_series))
        projected_30d_solar_kwh = round(avg_daily_solar_kwh * 30.0, 1)
        projected_30d_load_kwh = round(avg_daily_load_kwh * 30.0, 1)

        # Nigerian ROI Metrics:
        # 1 kWh generated by a household petrol generator consumes ~0.42 Liters of PMS (@ ₦1,250/L)
        # DisCo Band A tariff = ₦209.50 / kWh
        liters_petrol_displaced = round(projected_30d_solar_kwh * 0.42, 1)
        generator_fuel_saved_ngn = round(liters_petrol_displaced * 1250.0, 0)
        band_a_grid_equivalent_ngn = round(projected_30d_solar_kwh * 209.5, 0)
        co2_avoided_kg = round(liters_petrol_displaced * 2.31, 1)

        horizon_30d_payload = {
            "device_id": device_id,
            "contract_id": contract_id,
            "horizon": "30_DAYS_MONTHLY",
            "engine_mode": engine_mode,
            "generated_at": now_iso,
            "projected_30d_solar_kwh": projected_30d_solar_kwh,
            "projected_30d_load_kwh": projected_30d_load_kwh,
            "self_sufficiency_ratio_pct": round(min(100.0, (projected_30d_solar_kwh / max(1.0, projected_30d_load_kwh)) * 100.0), 1),
            "liters_petrol_displaced_30d": liters_petrol_displaced,
            "generator_fuel_saved_ngn": generator_fuel_saved_ngn,
            "disco_band_a_value_ngn": band_a_grid_equivalent_ngn,
            "co2_offset_kg_30d": co2_avoided_kg,
        }
        path_30d = forecasts_dir / "horizon_30d.json"
        self.write_json_atomic(path_30d, horizon_30d_payload)

        return {
            "device_id": device_id,
            "engine_mode": engine_mode,
            "vfs_paths": {
                "horizon_24h": str(path_24h),
                "horizon_7d": str(path_7d),
                "horizon_30d": str(path_30d),
            },
            "horizon_24h": horizon_24h_payload,
            "horizon_7d": horizon_7d_payload,
            "horizon_30d": horizon_30d_payload,
        }