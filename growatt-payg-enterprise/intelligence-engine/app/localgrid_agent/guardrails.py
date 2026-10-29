"""
guardrails.py
Strict Read-Only Enforcement & Physical Hazard Escalation Guardrails for LocalGridAgent.

Security Invariants (Non-Negotiable):
1. ZERO WRITE/EXECUTION PERMISSIONS: LocalGridAgent cannot execute SQL writes, modify
   VFS state.json/ledger_snap.json, or publish MQTT relay unlock commands.
2. PROMPT INJECTION SHIELD: Detects and rejects adversarial attempts to override billing
   balances, forge offline tokens, or bypass anti-tamper lockouts.
3. PHYSICAL HAZARD ESCALATION: Immediately escalates fire, smoke, electrical arc, or
   damaged hardware reports to the Admin Command Center.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from typing import List
import uuid


@dataclass(frozen=True)
class GuardrailVerdict:
    """Result of evaluating a customer prompt before/after RAG generation."""
    is_safe_to_answer: bool
    prompt_injection_detected: bool
    safety_escalation_triggered: bool
    escalation_ticket_ref: str
    override_response_markdown: str


class LocalGridGuardrails:
    """
    Deterministic security and physical safety filter wrapping LocalGridAgent.
    """

    # Physical electrical/thermal hazard keywords requiring immediate human engineer escalation
    PHYSICAL_HAZARD_KEYWORDS: List[str] = [
        "fire",
        "smoke",
        "smoking",
        "spark",
        "sparking",
        "arcing",
        "burning smell",
        "burnt",
        "melted",
        "swollen battery",
        "explod",
        "electric shock",
        "broken panel",
        "shattered panel",
    ]

    # Adversarial prompt-injection patterns attempting to unlock hardware or alter balances
    PROMPT_INJECTION_PATTERNS: List[str] = [
        "ignore previous instructions",
        "ignore all rules",
        "system override",
        "unlock my inverter",
        "turn on the relay",
        "add credit",
        "reset my balance",
        "mark as fully owned",
        "generate free token",
        "bypass tamper",
    ]

    @classmethod
    def inspect_customer_query(cls, device_id: str, customer_query: str) -> GuardrailVerdict:
        """
        Inspects incoming customer message for physical hazards or prompt-injection attacks.
        """
        q_lower = customer_query.strip().lower()

        # 1. Check Physical Safety Hazards FIRST (Life & Property Priority)
        matched_hazards = [kw for kw in cls.PHYSICAL_HAZARD_KEYWORDS if kw in q_lower]
        if matched_hazards:
            ticket_ref = f"EMG-SAFE-{uuid.uuid4().hex[:8].upper()}"
            emergency_msg = (
                f"🚨 **CRITICAL ELECTRICAL SAFETY ESCALATION ({ticket_ref})**\n\n"
                f"We detected a physical safety hazard in your message (`{', '.join(matched_hazards)}`).\n"
                f"1. **Immediate Action:** Please switch OFF the main AC/DC isolator breaker next to your "
                f"Growatt inverter immediately if it is safe to approach. **Do NOT touch wet or smoking cables.**\n"
                f"2. **Automated Dispatch:** An emergency alert has been escalated to the SkyTron Admin Command "
                f"Watchtower for device `{device_id}`. A COREN-certified Field Engineer is contacting you right now."
            )
            return GuardrailVerdict(
                is_safe_to_answer=False,
                prompt_injection_detected=False,
                safety_escalation_triggered=True,
                escalation_ticket_ref=ticket_ref,
                override_response_markdown=emergency_msg,
            )

        # 2. Check Adversarial Prompt-Injection / Unauthorized Hardware Unlock Attempts
        matched_injections = [pat for pat in cls.PROMPT_INJECTION_PATTERNS if pat in q_lower]
        if matched_injections:
            readonly_msg = (
                "🔒 **Security Guardrail Notice (Read-Only AI Boundary)**\n\n"
                "`LocalGridAgent` is a strictly **Read-Only** diagnostic and energy coaching assistant. "
                "For your security, this AI has **zero write or execution permissions** to modify your financial ledger, "
                "generate unlock tokens, or toggle hardware relays.\n\n"
                "To top up your energy credit and unlock your system automatically, please transfer to your "
                "**Dedicated Virtual Account (Moniepoint, Paystack, or OPay)** shown in your Financial Hub."
            )
            return GuardrailVerdict(
                is_safe_to_answer=False,
                prompt_injection_detected=True,
                safety_escalation_triggered=False,
                escalation_ticket_ref="",
                override_response_markdown=readonly_msg,
            )

        return GuardrailVerdict(
            is_safe_to_answer=True,
            prompt_injection_detected=False,
            safety_escalation_triggered=False,
            escalation_ticket_ref="",
            override_response_markdown="",
        )