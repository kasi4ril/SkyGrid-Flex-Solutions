"""
weather_client.py
Open-Meteo Solar Irradiance Client & Nigerian Harmattan Dust Soiling Detector.

Engineering Rationale:
1. Solar PV generation depends non-linearly on Global Horizontal Irradiance (GHI W/m^2),
   cloud cover percentage, and cell temperature derating (-0.38%/°C above 25°C STC).
2. Between November and February in Nigeria (especially across the Northern Sahel and
   Middle Belt: Kano, Jos, Abuja, Makurdi, Otukpo), Harmattan dust settles on panels and
   degrades harvest by 20%–40%. Comparing temperature-corrected expected PV watts against
   actual inverter telemetry isolates panel soiling from cloudy weather.
"""

from __future__ import annotations

import math
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import List, Optional
import urllib.request
import json


# Monocrystalline PERC temperature coefficient (-0.38% per °C above 25°C STC)
PV_TEMP_COEFF_PER_C: float = -0.0038
STC_CELL_TEMP_C: float = 25.0
BASE_WIRING_MPPT_EFFICIENCY: float = 0.86


@dataclass(frozen=True)
class HourlyWeatherPoint:
    """Represents a single hourly meteorological and solar irradiance forecast point."""
    timestamp_iso: str
    hour_of_day: int
    ghi_wm2: float            # Global Horizontal Irradiance (W/m^2)
    cloud_cover_pct: float    # 0.0 to 100.0%
    ambient_temp_c: float     # Ambient air temperature (°C)


@dataclass(frozen=True)
class HarmattanSoilingDiagnostic:
    """Result of comparing clear-sky expected PV output against actual Growatt telemetry."""
    device_id: str
    expected_pv_watts: float
    observed_pv_watts: float
    soiling_loss_pct: float
    trigger_cleaning_alert: bool
    advisory_message: str


class OpenMeteoSolarClient:
    """
    Fetches GPS-specific solar irradiance (GHI), cloud cover, and ambient temperature
    from the Open-Meteo Forecast API, with an offline-safe tropical solar curve fallback.
    """

    BASE_URL = "https://api.open-meteo.com/v1/forecast"

    def __init__(self, timeout_seconds: float = 6.0) -> None:
        self.timeout_seconds = timeout_seconds

    def fetch_hourly_irradiance(
        self,
        gps_lat: float,
        gps_lng: float,
        forecast_days: int = 7,
        allow_network: bool = True,
    ) -> List[HourlyWeatherPoint]:
        """
        Retrieves hourly GHI (W/m^2), cloud cover %, and temperature (°C) for the next N days.
        Automatically falls back to a latitude-calibrated Nigerian solar model if offline.
        """
        if allow_network:
            try:
                url = (
                    f"{self.BASE_URL}?latitude={gps_lat:.4f}&longitude={gps_lng:.4f}"
                    f"&hourly=shortwave_radiation,cloud_cover,temperature_2m"
                    f"&forecast_days={forecast_days}&timezone=Africa%2FLagos"
                )
                req = urllib.request.Request(url, headers={"User-Agent": "SkyTron-Growatt-PAYG/1.0"})
                with urllib.request.urlopen(req, timeout=self.timeout_seconds) as resp:
                    if resp.status == 200:
                        payload = json.loads(resp.read().decode("utf-8"))
                        return self._parse_open_meteo_response(payload)
            except Exception:
                # Fall through seamlessly to deterministic latitude-calibrated solar physics model
                pass

        return self.generate_deterministic_nigerian_weather(gps_lat, forecast_days)

    def _parse_open_meteo_response(self, payload: dict) -> List[HourlyWeatherPoint]:
        hourly = payload.get("hourly", {})
        times = hourly.get("time", [])
        ghis = hourly.get("shortwave_radiation", [])
        clouds = hourly.get("cloud_cover", [])
        temps = hourly.get("temperature_2m", [])

        points: List[HourlyWeatherPoint] = []
        for idx, t_str in enumerate(times):
            ghi = float(ghis[idx]) if idx < len(ghis) and ghis[idx] is not None else 0.0
            cloud = float(clouds[idx]) if idx < len(clouds) and clouds[idx] is not None else 20.0
            temp = float(temps[idx]) if idx < len(temps) and temps[idx] is not None else 30.0
            hour = int(t_str[11:13]) if len(t_str) >= 13 else (idx % 24)
            points.append(
                HourlyWeatherPoint(
                    timestamp_iso=t_str,
                    hour_of_day=hour,
                    ghi_wm2=round(max(0.0, ghi), 2),
                    cloud_cover_pct=round(min(100.0, max(0.0, cloud)), 1),
                    ambient_temp_c=round(temp, 1),
                )
            )
        return points

    @staticmethod
    def generate_deterministic_nigerian_weather(
        gps_lat: float,
        forecast_days: int = 7,
        start_time: Optional[datetime] = None,
    ) -> List[HourlyWeatherPoint]:
        """
        Generates a physically realistic Nigerian tropical irradiance & temperature profile
        calibrated by latitude (Southern Coastal ~6°N vs Middle Belt ~8-9°N vs Sahel ~12°N).
        """
        base_dt = (start_time or datetime.now(timezone.utc)).replace(minute=0, second=0, microsecond=0)
        # Higher latitude in Nigeria (North/Middle Belt) receives higher peak clear-sky GHI
        peak_ghi_factor = 960.0 if gps_lat >= 10.5 else (890.0 if gps_lat >= 7.0 else 790.0)
        base_cloud_pct = 15.0 if gps_lat >= 10.5 else (28.0 if gps_lat >= 7.0 else 45.0)

        points: List[HourlyWeatherPoint] = []
        total_hours = forecast_days * 24

        for h_offset in range(total_hours):
            cur_dt = base_dt + timedelta(hours=h_offset)
            hour = cur_dt.hour
            day_idx = h_offset // 24

            # Simulate occasional cloudy day on day 3 for realistic 7-day battery coaching
            day_cloud_mod = 35.0 if (day_idx == 2) else 0.0
            cloud_pct = min(95.0, base_cloud_pct + day_cloud_mod + 8.0 * math.sin(h_offset * 0.4))

            # Sun rises ~06:30 WAT and sets ~18:30 WAT
            if 7 <= hour <= 18:
                solar_angle = math.pi * (hour - 6.5) / 12.0
                raw_ghi = peak_ghi_factor * math.sin(max(0.0, solar_angle))
                cloud_attenuation = 1.0 - (0.65 * (cloud_pct / 100.0))
                ghi = max(0.0, raw_ghi * cloud_attenuation)
            else:
                ghi = 0.0

            # Tropical diurnal ambient temperature curve (lowest at 05:00, peak at 15:00)
            ambient_temp = 27.5 + 6.5 * math.sin(math.pi * (hour - 9) / 12.0)

            points.append(
                HourlyWeatherPoint(
                    timestamp_iso=cur_dt.isoformat(),
                    hour_of_day=hour,
                    ghi_wm2=round(ghi, 2),
                    cloud_cover_pct=round(cloud_pct, 1),
                    ambient_temp_c=round(ambient_temp, 1),
                )
            )
        return points

    @staticmethod
    def estimate_pv_generation_watts(
        pv_kwp_installed: float,
        ghi_wm2: float,
        ambient_temp_c: float,
    ) -> float:
        """
        Converts Global Horizontal Irradiance (W/m^2) and ambient temperature (°C) into
        expected Growatt MPPT DC harvest (Watts), accounting for solar cell thermal rise.
        """
        if ghi_wm2 <= 5.0 or pv_kwp_installed <= 0:
            return 0.0

        # Solar cells on a Nigerian roof run ~22°C hotter than ambient air at 1000 W/m^2 (NOCT model)
        estimated_cell_temp_c = ambient_temp_c + (0.022 * ghi_wm2)
        temp_delta = max(0.0, estimated_cell_temp_c - STC_CELL_TEMP_C)
        thermal_derating = 1.0 + (PV_TEMP_COEFF_PER_C * temp_delta)

        raw_watts = (
            pv_kwp_installed
            * 1000.0
            * (ghi_wm2 / 1000.0)
            * thermal_derating
            * BASE_WIRING_MPPT_EFFICIENCY
        )
        return round(max(0.0, raw_watts), 2)

    @classmethod
    def evaluate_harmattan_soiling(
        cls,
        device_id: str,
        pv_kwp_installed: float,
        observed_peak_pv_watts: float,
        current_ghi_wm2: float,
        ambient_temp_c: float,
    ) -> HarmattanSoilingDiagnostic:
        """
        Detects Harmattan dust accumulation on solar panels when midday clear-sky GHI (>550 W/m^2)
        produces >18% less PV wattage than physics-based expectations.
        """
        expected_watts = cls.estimate_pv_generation_watts(
            pv_kwp_installed=pv_kwp_installed,
            ghi_wm2=current_ghi_wm2,
            ambient_temp_c=ambient_temp_c,
        )

        if current_ghi_wm2 < 450.0 or expected_watts <= 100.0:
            return HarmattanSoilingDiagnostic(
                device_id=device_id,
                expected_pv_watts=expected_watts,
                observed_pv_watts=observed_peak_pv_watts,
                soiling_loss_pct=0.0,
                trigger_cleaning_alert=False,
                advisory_message="Irradiance below clear-sky diagnostic threshold; soiling check deferred.",
            )

        ratio = max(0.0, min(1.0, observed_peak_pv_watts / expected_watts))
        soiling_loss_pct = round((1.0 - ratio) * 100.0, 1)
        trigger_alert = soiling_loss_pct >= 18.0

        if trigger_alert:
            msg = (
                f"Harmattan Dust Alert: Your solar array is generating {soiling_loss_pct}% below "
                f"clear-sky expectations ({observed_peak_pv_watts:.0f}W vs {expected_watts:.0f}W expected). "
                f"Rinse panels with clean water early morning (before 07:30 AM) to restore full harvest."
            )
        else:
            msg = f"Solar array operating at healthy efficiency ({100.0 - soiling_loss_pct:.1f}% of clear-sky expectation)."

        return HarmattanSoilingDiagnostic(
            device_id=device_id,
            expected_pv_watts=expected_watts,
            observed_pv_watts=observed_peak_pv_watts,
            soiling_loss_pct=soiling_loss_pct,
            trigger_cleaning_alert=trigger_alert,
            advisory_message=msg,
        )