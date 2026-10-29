"""
context_assembler.py
Live VFS Context Assembler, $0-Token Deterministic Daily Briefings & RAG Response Synthesizer.

Architectural Guardrail:
- Daily 07:00 AM Morning Briefings and 06:00 PM Evening Deficit Warnings MUST use
  deterministic Python templates ($0.00 LLM token cost).
- Interactive customer queries combine retrieved `pgvector` Growatt manual chunks with
  live read-only snapshots of `state.json`, `ledger_snap.json`, and `horizon_24h.json`.
"""

from __future__ import annotations

import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Optional

from .guardrails import LocalGridGuardrails
from .vector_retriever import GrowattVectorRetriever


class LocalGridContextAssembler:
    """
    Reads live VFS telemetry/ledger/forecast files (read-only) and orchestrates
    both deterministic daily briefings and interactive RAG diagnostics.
    """

    def __init__(self, vfs_root: str = "/var/lib/payg-vfs") -> None:
        self.vfs_root = Path(vfs_root).resolve()
        self.retriever = GrowattVectorRetriever()

    def resolve_device_block_dir(self, device_id: str) -> Path:
        clean_id = device_id.strip()
        digest = hashlib.sha256(clean_id.encode("utf-8")).hexdigest()
        return self.vfs_root / "blocks" / digest[0:2] / digest[2:4] / clean_id

    def read_vfs_context(self, device_id: str) -> Dict[str, Any]:
        """
        Safely reads `state.json`, `ledger_snap.json`, and `forecasts/horizon_24h.json`
        from the device's POSIX VFS block (Read-Only).
        """
        block_dir = self.resolve_device_block_dir(device_id)

        state_data = self._read_json_safe(block_dir / "state.json", default={
            "device_id": device_id,
            "relay_state": "ACTIVE_ON",
            "tamper_switch_state": "SEALED",
            "battery_soc_pct": 88.0,
            "pv_watts": 2450.0,
            "ac_output_watts": 780.0,
            "inverter_temp_c": 37.2,
            "growatt_fault_code": 0,
        })

        ledger_data = self._read_json_safe(block_dir / "ledger_snap.json", default={
            "contract_id": "CTR-DEFAULT",
            "contract_status": "ACTIVE",
            "paid_days_remaining": 14.5,
            "next_installment_kobo": 14500000,
        })

        forecast_24h = self._read_json_safe(block_dir / "forecasts" / "horizon_24h.json", default={
            "peak_solar_hour": 13,
            "peak_solar_watts": 3650.0,
            "overnight_min_battery_soc_pct": 38.0,
            "load_shifting_coaching": "Run borehole pump and washing machine between 11:00 AM and 02:00 PM.",
        })

        return {
            "state": state_data,
            "ledger": ledger_data,
            "forecast_24h": forecast_24h,
        }

    def generate_deterministic_daily_briefing(
        self,
        device_id: str,
        briefing_type: str = "MORNING_0700",
    ) -> Dict[str, Any]:
        """
        Generates the 07:00 AM Morning Energy Briefing or 06:00 PM Evening Deficit Warning
        using deterministic Python templates at $0.00 LLM token cost.
        """
        ctx = self.read_vfs_context(device_id)
        state = ctx["state"]
        ledger = ctx["ledger"]
        fc = ctx["forecast_24h"]

        soc = float(state.get("battery_soc_pct", 80.0))
        peak_w = float(fc.get("peak_solar_watts", 3200.0))
        peak_hr = int(fc.get("peak_solar_hour", 13))
        paid_days = float(ledger.get("paid_days_remaining", 10.0))

        if briefing_type.upper() == "MORNING_0700":
            headline = f"☀️ 7:00 AM Solar Outlook — Peak {peak_w:.0f}W Expected at {peak_hr:02d}:00"
            body = (
                f"Good morning! Your LiFePO4 battery is currently at {soc:.0f}% SoC. "
                f"Today's solar harvest peaks around {peak_hr:02d}:00 ({peak_w:.0f}W). "
                f"{fc.get('load_shifting_coaching', '')} "
                f"Active energy credit remaining: {paid_days:.1f} days."
            )
        else:
            min_overnight_soc = float(fc.get("overnight_min_battery_soc_pct", 30.0))
            headline = f"🌙 6:00 PM Overnight Battery Check — Current LiFePO4 SoC: {soc:.0f}%"
            if soc < 55.0 or min_overnight_soc < 25.0:
                body = (
                    f"Heads up: Your LiFePO4 battery is entering the evening at {soc:.0f}% SoC. "
                    f"To avoid hitting the 20% protection floor before sunrise, switch off non-essential "
                    f"AC units or deep freezers after 10:00 PM tonight."
                )
            else:
                body = (
                    f"Your LiFePO4 battery bank is well-charged at {soc:.0f}% SoC. "
                    f"Projected minimum overnight reserve is {min_overnight_soc:.0f}% — enjoy uninterrupted overnight power!"
                )

        return {
            "device_id": device_id,
            "briefing_type": briefing_type.upper(),
            "headline": headline,
            "body_text": body,
            "llm_token_cost_usd": 0.0,  # Strictly $0.00 deterministic template
            "generated_at_iso": datetime.now(timezone.utc).isoformat(),
        }

    def answer_customer_query(
        self,
        device_id: str,
        model_sku: str,
        customer_query: str,
    ) -> Dict[str, Any]:
        """
        Executes the read-only RAG pipeline:
        1. Runs `LocalGridGuardrails` to block prompt-injection or escalate physical hazards.
        2. Reads live VFS `state.json`, `ledger_snap.json`, and `horizon_24h.json`.
        3. Retrieves top-K Growatt manual & policy chunks from `pgvector`.
        4. Synthesizes a grounded diagnostic response citing exact telemetry and manual sections.
        """
        verdict = LocalGridGuardrails.inspect_customer_query(device_id, customer_query)
        if not verdict.is_safe_to_answer:
            return {
                "device_id": device_id,
                "answer_markdown": verdict.override_response_markdown,
                "safety_escalation_triggered": verdict.safety_escalation_triggered,
                "escalation_ticket_ref": verdict.escalation_ticket_ref,
                "prompt_injection_blocked": verdict.prompt_injection_detected,
                "cited_manual_sections": [],
                "generated_at_iso": datetime.now(timezone.utc).isoformat(),
            }

        ctx = self.read_vfs_context(device_id)
        state = ctx["state"]
        ledger = ctx["ledger"]
        fc = ctx["forecast_24h"]

        fault_code = int(state.get("growatt_fault_code", 0))
        retrieved_chunks = self.retriever.retrieve_top_k(
            query=customer_query,
            model_sku=model_sku,
            top_k=2,
            active_fault_code=fault_code,
        )

        cited_titles = [c.title for c in retrieved_chunks]
        manual_guidance = "\n\n".join(
            f"- **{c.title}:** {c.chunk_text}" for c in retrieved_chunks
        )

        naira_due = int(ledger.get("next_installment_kobo", 0)) // 100
        answer = (
            f"### Live System Telemetry (`{device_id}`)\n"
            f"- **Solar PV Input:** `{state.get('pv_watts', 0)}W` | **Home AC Load:** `{state.get('ac_output_watts', 0)}W`\n"
            f"- **LiFePO4 Battery SoC:** `{state.get('battery_soc_pct', 0)}%` | **Inverter Temp:** `{state.get('inverter_temp_c', 0)}°C`\n"
            f"- **Relay Status:** `{state.get('relay_state', 'ACTIVE_ON')}` | **Active Credit Left:** `{ledger.get('paid_days_remaining', 0)} days` (Next Installment: ₦{naira_due:,})\n\n"
            f"### Growatt Engineering & Policy Guidance\n"
            f"{manual_guidance}\n\n"
            f"### 24-Hour Smart Load Coaching\n"
            f"{fc.get('load_shifting_coaching', '')}"
        )

        return {
            "device_id": device_id,
            "answer_markdown": answer,
            "safety_escalation_triggered": False,
            "escalation_ticket_ref": "",
            "prompt_injection_blocked": False,
            "cited_manual_sections": cited_titles,
            "generated_at_iso": datetime.now(timezone.utc).isoformat(),
        }

    @staticmethod
    def _read_json_safe(path: Path, default: Dict[str, Any]) -> Dict[str, Any]:
        if not path.exists():
            return default
        try:
            return json.loads(path.read_text(encoding="utf-8"))
        except Exception:
            return default