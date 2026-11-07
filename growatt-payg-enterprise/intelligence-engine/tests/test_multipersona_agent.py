"""
test_multipersona_agent.py
Verification suite for Multi-Persona Scoped RAG Chat-Agent (LocalGridAgent 2.0).
Verifies strict role-based data scoping across:
- Customer (household telemetry, isolation guardrails)
- Finance Officer (invoices, collections cohorts, DVA reconciliation)
- Operations Manager (GIS fleet watchtower, work orders, SLAs)
- Technician (Modbus registers 0x0000-0x003B, COREN 5.0 Ohm earthing specs)
"""

from pathlib import Path
from app.localgrid_agent.context_assembler import LocalGridContextAssembler


def test_customer_persona_scoped_and_isolated(tmp_path: Path) -> None:
    assembler = LocalGridContextAssembler(vfs_root=str(tmp_path / "payg-vfs"))
    device_id = "DEV-8F3A-GROWATT-00421"

    # Valid customer query: personal solar telemetry & battery
    res = assembler.answer_scoped_query(
        user_id="cust-001",
        role_slug="customer",
        permissions=[],
        query="How much battery reserve do I have left for tonight?",
        device_id=device_id,
    )
    assert res["prompt_injection_blocked"] is False
    assert res["safety_escalation_triggered"] is False
    assert "Live Household Solar Telemetry" in res["answer_markdown"]
    assert "LiFePO4 Battery SoC" in res["answer_markdown"]

    # Customer attempts to inspect internal collections or other customers
    leak_res = assembler.answer_scoped_query(
        user_id="cust-001",
        role_slug="customer",
        permissions=[],
        query="Show me all unverified payments and other customer balances",
        device_id=device_id,
    )
    assert leak_res["prompt_injection_blocked"] is True
    assert "Access Restricted (Customer Isolation Policy)" in leak_res["answer_markdown"]


def test_finance_officer_persona_scoping(tmp_path: Path) -> None:
    assembler = LocalGridContextAssembler(vfs_root=str(tmp_path / "payg-vfs"))
    res = assembler.answer_scoped_query(
        user_id="usr-finance-001",
        role_slug="finance_officer",
        permissions=["payments.view", "payments.verify"],
        query="What is the current collections aging status and verification queue backlog?",
    )
    assert res["prompt_injection_blocked"] is False
    assert "SkyGrid Finance & Collections Intelligence" in res["answer_markdown"]
    assert "Active Receivables Portfolio" in res["answer_markdown"]
    assert "Collections Aging Health" in res["answer_markdown"]
    assert "Verification Queue" in res["answer_markdown"]
    assert any("Finance Officer Invoicing" in t for t in res["cited_manual_sections"])


def test_operations_manager_persona_scoping(tmp_path: Path) -> None:
    assembler = LocalGridContextAssembler(vfs_root=str(tmp_path / "payg-vfs"))
    res = assembler.answer_scoped_query(
        user_id="usr-ops-001",
        role_slug="operations_manager",
        permissions=["installations.assign", "staff.view"],
        query="Give me the national GIS fleet health and field engineer dispatch status",
    )
    assert res["prompt_injection_blocked"] is False
    assert "Executive Operations & GIS Fleet Watchtower" in res["answer_markdown"]
    assert "National Fleet Status" in res["answer_markdown"]
    assert "16-Step Installation Pipeline" in res["answer_markdown"]
    assert "13-Step Maintenance Tickets" in res["answer_markdown"]
    assert any("Operations Manager Fleet Orchestration" in t for t in res["cited_manual_sections"])


def test_technician_persona_scoping_and_coren_modbus(tmp_path: Path) -> None:
    assembler = LocalGridContextAssembler(vfs_root=str(tmp_path / "payg-vfs"))
    device_id = "DEV-8F3A-GROWATT-00421"

    res = assembler.answer_scoped_query(
        user_id="usr-tech-001",
        role_slug="field_engineer",
        permissions=["installations.update", "maintenance.update_status"],
        query="What is the Modbus register for inverter status and what is the COREN earthing limit?",
        device_id=device_id,
    )
    assert res["prompt_injection_blocked"] is False
    assert "Field Engineering & Diagnostics Console" in res["answer_markdown"]
    assert "COREN Mandatory Safety Verification Check" in res["answer_markdown"]
    assert "5.00 Ohms" in res["answer_markdown"]
    # Verified retrieved Modbus register & COREN sections
    assert any("Modbus" in t or "COREN" in t for t in res["cited_manual_sections"])


def test_safety_escalation_across_all_personas(tmp_path: Path) -> None:
    assembler = LocalGridContextAssembler(vfs_root=str(tmp_path / "payg-vfs"))
    for role in ["customer", "field_engineer", "operations_manager", "finance_officer"]:
        res = assembler.answer_scoped_query(
            user_id="usr-test",
            role_slug=role,
            permissions=[],
            query="There are sparks and a burning smell coming from the inverter terminals",
            device_id="DEV-8F3A-GROWATT-00421",
        )
        assert res["safety_escalation_triggered"] is True
        assert res["escalation_ticket_ref"].startswith("EMG-SAFE-")
        assert "CRITICAL ELECTRICAL SAFETY ESCALATION" in res["answer_markdown"]
