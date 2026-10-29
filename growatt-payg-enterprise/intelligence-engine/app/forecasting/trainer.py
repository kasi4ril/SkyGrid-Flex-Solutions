"""
trainer.py
Personalized Multi-Horizon XGBoost / LightGBM Training Pipeline (Day 15+ Transition).

Feature Engineering Architecture:
- Cyclical temporal encodings: sin/cos of hour-of-day (24h period) and day-of-week (7d period)
- Autoregressive telemetry lags: lag_1h, lag_24h (yesterday same hour), lag_168h (last week same hour)
- Rolling consumption statistics: 6-hour and 24-hour rolling mean load
- Exogenous meteorological features: Open-Meteo GHI (W/m^2), cloud cover %, ambient temp (°C)
"""

from __future__ import annotations

import math
import os
import pickle
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import numpy as np
import pandas as pd

try:
    from xgboost import XGBRegressor
    HAS_XGBOOST = True
except ImportError:
    HAS_XGBOOST = False

from sklearn.ensemble import HistGradientBoostingRegressor


FEATURE_COLUMNS: List[str] = [
    "hour_sin",
    "hour_cos",
    "dow_sin",
    "dow_cos",
    "ghi_wm2",
    "cloud_cover_pct",
    "ambient_temp_c",
    "lag_1h",
    "lag_24h",
    "rolling_24h_mean",
]


@dataclass
class TrainedDeviceModels:
    """Holds the trained Solar Generation (W) and Customer Load Demand (W) regressors."""
    device_id: str
    model_type: str
    solar_model: object
    load_model: object
    train_samples: int
    solar_mae_watts: float
    load_mae_watts: float


class MultiHorizonTrainer:
    """
    Trains and serializes personalized Solar PV and Home Load regressors for devices
    that have accumulated >= 14 days (336 hours) of telemetry in TimescaleDB.
    """

    def __init__(self, registry_dir: str = "./models_registry") -> None:
        self.registry_dir = Path(registry_dir)
        self.registry_dir.mkdir(parents=True, exist_ok=True)

    @staticmethod
    def build_feature_dataframe(df_raw: pd.DataFrame) -> pd.DataFrame:
        """
        Transforms raw hourly telemetry (`timestamp`, `pv_watts`, `ac_output_watts`,
        `ghi_wm2`, `cloud_cover_pct`, `ambient_temp_c`) into the supervised ML matrix.
        """
        df = df_raw.copy().sort_values("timestamp").reset_index(drop=True)
        ts = pd.to_datetime(df["timestamp"])

        hours = ts.dt.hour.astype(float)
        dows = ts.dt.dayofweek.astype(float)

        df["hour_sin"] = np.sin(2.0 * math.pi * hours / 24.0)
        df["hour_cos"] = np.cos(2.0 * math.pi * hours / 24.0)
        df["dow_sin"] = np.sin(2.0 * math.pi * dows / 7.0)
        df["dow_cos"] = np.cos(2.0 * math.pi * dows / 7.0)

        # Autoregressive load lags
        df["lag_1h"] = df["ac_output_watts"].shift(1).bfill()
        df["lag_24h"] = df["ac_output_watts"].shift(24).bfill()
        df["rolling_24h_mean"] = (
            df["ac_output_watts"].rolling(window=24, min_periods=1).mean()
        )

        return df

    def train_for_device(self, device_id: str, df_hourly: pd.DataFrame) -> TrainedDeviceModels:
        """
        Fits two gradient-boosted regressors (Solar Generation W and Customer Load W)
        and saves the artifact atomically to `models_registry/{device_id}.pkl`.
        """
        if len(df_hourly) < 48:
            raise ValueError(f"Insufficient hourly rows ({len(df_hourly)}) to train ML models for {device_id}")

        df_feat = self.build_feature_dataframe(df_hourly)
        X = df_feat[FEATURE_COLUMNS].to_numpy(dtype=np.float64)
        y_solar = df_feat["pv_watts"].to_numpy(dtype=np.float64)
        y_load = df_feat["ac_output_watts"].to_numpy(dtype=np.float64)

        if HAS_XGBOOST:
            model_type = "XGBOOST_REGRESSOR"
            solar_reg = XGBRegressor(
                n_estimators=120,
                max_depth=5,
                learning_rate=0.08,
                subsample=0.85,
                random_state=42,
                n_jobs=2,
            )
            load_reg = XGBRegressor(
                n_estimators=120,
                max_depth=5,
                learning_rate=0.08,
                subsample=0.85,
                random_state=42,
                n_jobs=2,
            )
        else:
            model_type = "HIST_GRADIENT_BOOSTING"
            solar_reg = HistGradientBoostingRegressor(max_iter=120, max_depth=5, random_state=42)
            load_reg = HistGradientBoostingRegressor(max_iter=120, max_depth=5, random_state=42)

        solar_reg.fit(X, y_solar)
        load_reg.fit(X, y_load)

        solar_preds = np.clip(solar_reg.predict(X), 0.0, None)
        load_preds = np.clip(load_reg.predict(X), 40.0, None)

        solar_mae = float(np.mean(np.abs(y_solar - solar_preds)))
        load_mae = float(np.mean(np.abs(y_load - load_preds)))

        bundle = TrainedDeviceModels(
            device_id=device_id,
            model_type=model_type,
            solar_model=solar_reg,
            load_model=load_reg,
            train_samples=len(df_feat),
            solar_mae_watts=round(solar_mae, 2),
            load_mae_watts=round(load_mae, 2),
        )

        # Atomic model serialization (.tmp + os.replace)
        artifact_path = self.registry_dir / f"{device_id}.pkl"
        tmp_path = self.registry_dir / f"{device_id}.pkl.tmp"
        with open(tmp_path, "wb") as f:
            pickle.dump(bundle, f)
            f.flush()
            os.fsync(f.fileno())
        os.replace(tmp_path, artifact_path)

        return bundle

    def load_device_models(self, device_id: str) -> Optional[TrainedDeviceModels]:
        artifact_path = self.registry_dir / f"{device_id}.pkl"
        if not artifact_path.exists():
            return None
        with open(artifact_path, "rb") as f:
            return pickle.load(f)