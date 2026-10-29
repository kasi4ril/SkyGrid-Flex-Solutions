"""
cold_start.py
Days 1-14 Synthetic Load Curve & Solar Generation Archetype Generator.

Architecture:
Before 14 days of live TimescaleDB telemetry are accumulated, machine learning models
suffer from the cold-start problem. This module deterministically transforms the customer's
onboarding appliance catalog specifications into realistic 24-hour load and solar curves.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, List, Optional


@dataclass(frozen=True)
class ColdStartApplianceSpec:
    """Specification of an appliance from the sizing calculator."""
    code: str
    rated_watts: float
    quantity: int
    day_hours: float       # Operation during daylight (08:00 - 17:00, 9 hours window)
    night_hours: float     # Operation at night (17:00 - 08:00, 15 hours window)


class ColdStartSyntheticGenerator:
    """Generates synthetic hourly load curves from sizing calculator inputs."""

    # Typical Nigerian residential hourly load weighting factors (0 to 23)
    # Peak evening hours (19:00 - 23:00) have highest load; late night (01:00 - 06:00) lowest.
    HOURLY_BASE_WEIGHTS = {
        0: 0.65, 1: 0.55, 2: 0.50, 3: 0.50, 4: 0.55, 5: 0.70,
        6: 0.85, 7: 0.95, 8: 1.00, 9: 1.00, 10: 0.95, 11: 0.95,
        12: 1.00, 13: 1.00, 14: 0.95, 15: 0.95, 16: 1.00, 17: 1.05,
        18: 1.15, 19: 1.30, 20: 1.35, 21: 1.30, 22: 1.10, 23: 0.85,
    }

    @classmethod
    def build_24h_load_profile_watts(
        cls,
        appliances: List[ColdStartApplianceSpec],
        default_baseline_w: float = 350.0,
    ) -> Dict[int, float]:
        """
        Builds a 24-hour dictionary mapping hour (0..23) -> average load in watts.
        """
        if not appliances:
            return {h: default_baseline_w * cls.HOURLY_BASE_WEIGHTS.get(h, 1.0) for h in range(24)}

        # Separate day (08:00 - 17:00 = 9h) and night (17:00 - 08:00 = 15h)
        daytime_hours_count = 9.0
        nighttime_hours_count = 15.0

        hourly_load = {h: 0.0 for h in range(24)}

        for app in appliances:
            total_rated = float(app.rated_watts) * int(app.quantity)

            # Distribute daytime energy across daylight hours (8..16)
            if app.day_hours > 0:
                day_duty_cycle = min(1.0, app.day_hours / daytime_hours_count)
                day_w = total_rated * day_duty_cycle
                for h in range(8, 17):
                    hourly_load[h] += day_w

            # Distribute nighttime energy across night hours (17..23 and 0..7)
            if app.night_hours > 0:
                night_duty_cycle = min(1.0, app.night_hours / nighttime_hours_count)
                night_w = total_rated * night_duty_cycle
                for h in list(range(17, 24)) + list(range(0, 8)):
                    hourly_load[h] += night_w

        # Ensure minimal standby load and realistic Nigerian evening curve shaping
        result: Dict[int, float] = {}
        for h in range(24):
            base = max(80.0, hourly_load[h])
            factor = cls.HOURLY_BASE_WEIGHTS.get(h, 1.0)
            result[h] = round(base * factor, 2)

        return result
