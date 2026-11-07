package usecases_test

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/SkyGrid-Flex-Solutions/growatt-payg-enterprise/core-backend/internal/adapters/repositories"
	"github.com/SkyGrid-Flex-Solutions/growatt-payg-enterprise/core-backend/internal/adapters/vfs_store"
	"github.com/SkyGrid-Flex-Solutions/growatt-payg-enterprise/core-backend/internal/domain"
	"github.com/SkyGrid-Flex-Solutions/growatt-payg-enterprise/core-backend/internal/usecases"
)

func setupERPServices(t *testing.T) (*usecases.InstallationService, *usecases.MaintenanceService, *usecases.FinanceService, repositories.ERPRepository) {
	erpRepo := repositories.NewMemoryERPRepository()
	vfsRoot := t.TempDir()
	vfs, err := vfs_store.NewVFSManager(vfsRoot)
	if err != nil {
		t.Fatalf("failed to init vfs: %v", err)
	}
	tokenEngine := usecases.NewOfflineTokenEngine("test-sts-master-key-2026")
	ledgerProc := usecases.NewLedgerProcessor(vfs, tokenEngine)

	financeService := usecases.NewFinanceService(erpRepo, ledgerProc, tokenEngine)
	instService := usecases.NewInstallationService(erpRepo, financeService)
	maintService := usecases.NewMaintenanceService(erpRepo, financeService)

	return instService, maintService, financeService, erpRepo
}

// ----------------------------------------------------------------------------
// 1. 16-Step Installation Pipeline & COREN <= 5.0 Ohm Earthing Guardrail
// ----------------------------------------------------------------------------
func TestInstallationPipeline_16StepsAndCORENEarthing(t *testing.T) {
	instService, _, financeService, _ := setupERPServices(t)
	ctx := context.Background()

	// Step 1: 1_REQUEST_SUBMITTED
	createDTO := usecases.CreateInstallationDTO{
		CustomerID:        "CUST-ABUJA-0042",
		CustomerName:      "Ibrahim Musa",
		CustomerPhone:     "08021112233",
		CustomerEmail:     "ibrahim.m@example.com",
		SiteAddress:       "Plot 42, Gwarinpa Estate, Abuja FCT",
		GPSLat:            9.1021,
		GPSLng:            7.4011,
		StateRegion:       "Abuja FCT",
		InverterSKU:       "GROWATT_SPF_5000ES",
		PVKWpPlanned:      5.40,
		BatteryKWhPlanned: 10.24,
		TotalAmountKobo:   4500000 * 100, // ₦4,500,000
		Notes:             "Executive 5.4 kWp Solar Home with LiFePO4 battery bank",
	}
	order, err := instService.CreateInstallation(ctx, createDTO)
	if err != nil {
		t.Fatalf("failed to create installation request: %v", err)
	}
	if order.Status != domain.InstallStatus1RequestSubmitted {
		t.Errorf("expected Step 1 status, got %s", order.Status)
	}

	// Test out-of-order transition rejection (Step 1 -> Step 5 must fail)
	_, err = instService.TransitionStatus(ctx, order.ID, usecases.TransitionInstallationDTO{
		NextStatus: domain.InstallStatus5QuotationPrepared,
	})
	if !errors.Is(err, usecases.ErrInvalidStepTransition) {
		t.Errorf("expected ErrInvalidStepTransition when skipping steps, got %v", err)
	}

	// Step 2: 2_OPS_REVIEWED
	order, err = instService.TransitionStatus(ctx, order.ID, usecases.TransitionInstallationDTO{
		NextStatus: domain.InstallStatus2OpsReviewed,
		Notes:      "Grid stability verified, Band A feeder line confirmed",
	})
	if err != nil {
		t.Fatalf("Step 2 failed: %v", err)
	}

	// Step 3: 3_SITE_ASSESSMENT_SCHEDULED
	schedAudit := time.Now().UTC().Add(48 * time.Hour)
	order, err = instService.TransitionStatus(ctx, order.ID, usecases.TransitionInstallationDTO{
		NextStatus:    domain.InstallStatus3SiteAssessmentScheduled,
		ScheduledDate: &schedAudit,
	})
	if err != nil {
		t.Fatalf("Step 3 failed: %v", err)
	}

	// Step 4: 4_SITE_ASSESSED
	order, err = instService.TransitionStatus(ctx, order.ID, usecases.TransitionInstallationDTO{
		NextStatus: domain.InstallStatus4SiteAssessed,
		Notes:      "South-facing roof, 15 deg tilt, zero tree shading, PSH 4.9",
	})
	if err != nil {
		t.Fatalf("Step 4 failed: %v", err)
	}

	// Step 5: 5_QUOTATION_PREPARED
	order, err = instService.TransitionStatus(ctx, order.ID, usecases.TransitionInstallationDTO{
		NextStatus: domain.InstallStatus5QuotationPrepared,
	})
	if err != nil {
		t.Fatalf("Step 5 failed: %v", err)
	}

	// Step 6: 6_QUOTATION_APPROVED (Triggers automated 30% Down-Payment Invoice)
	order, err = instService.TransitionStatus(ctx, order.ID, usecases.TransitionInstallationDTO{
		NextStatus: domain.InstallStatus6QuotationApproved,
	})
	if err != nil {
		t.Fatalf("Step 6 failed: %v", err)
	}

	// Verify automated invoice generation in finance service
	invoices, _ := financeService.ListInvoices(ctx, "", order.CustomerID)
	if len(invoices) != 1 {
		t.Fatalf("expected 1 automated invoice generated upon quote approval, got %d", len(invoices))
	}
	expectedDepositKobo := order.TotalAmountKobo * 30 / 100 // ₦1,350,000
	if invoices[0].AmountKobo != expectedDepositKobo {
		t.Errorf("expected deposit invoice ₦%d, got ₦%d", expectedDepositKobo/100, invoices[0].AmountKobo/100)
	}

	// Step 7: 7_WORK_ORDER_CREATED
	order, err = instService.TransitionStatus(ctx, order.ID, usecases.TransitionInstallationDTO{
		NextStatus: domain.InstallStatus7WorkOrderCreated,
	})
	if err != nil {
		t.Fatalf("Step 7 failed: %v", err)
	}

	// Step 8: 8_TECHNICIAN_ASSIGNED
	order, err = instService.TransitionStatus(ctx, order.ID, usecases.TransitionInstallationDTO{
		NextStatus:           domain.InstallStatus8TechnicianAssigned,
		AssignedEngineerID:   "ENG-COREN-004",
		AssignedEngineerName: "Eng. Chinedu Okafor (COREN)",
	})
	if err != nil {
		t.Fatalf("Step 8 failed: %v", err)
	}

	// Step 9: 9_INSTALLATION_SCHEDULED
	schedInstall := time.Now().UTC().Add(72 * time.Hour)
	order, err = instService.TransitionStatus(ctx, order.ID, usecases.TransitionInstallationDTO{
		NextStatus:    domain.InstallStatus9InstallationScheduled,
		ScheduledDate: &schedInstall,
	})
	if err != nil {
		t.Fatalf("Step 9 failed: %v", err)
	}

	// Step 10: 10_IN_PROGRESS
	order, err = instService.TransitionStatus(ctx, order.ID, usecases.TransitionInstallationDTO{
		NextStatus: domain.InstallStatus10InProgress,
	})
	if err != nil {
		t.Fatalf("Step 10 failed: %v", err)
	}

	// Step 11: 11_BOM_DOCUMENTED
	order, err = instService.TransitionStatus(ctx, order.ID, usecases.TransitionInstallationDTO{
		NextStatus: domain.InstallStatus11BOMDocumented,
		BOMItems: []domain.BOMItem{
			{ItemCode: "SPF-5000ES", Description: "Growatt 5kW 48V Hybrid Inverter", Quantity: 1, Unit: "PCS"},
			{ItemCode: "LFP-512-100", Description: "LiFePO4 5.12kWh 100Ah Battery", Quantity: 2, Unit: "UNITS"},
			{ItemCode: "PV-550W-MONO", Description: "Tier-1 550W Monocrystalline Solar Panels", Quantity: 10, Unit: "PCS"},
			{ItemCode: "DC-SPD-T2", Description: "Type II DC Surge Protective Device", Quantity: 2, Unit: "PCS"},
		},
	})
	if err != nil {
		t.Fatalf("Step 11 failed: %v", err)
	}

	// Step 12: 12_PHOTOS_UPLOADED
	order, err = instService.TransitionStatus(ctx, order.ID, usecases.TransitionInstallationDTO{
		NextStatus: domain.InstallStatus12PhotosUploaded,
		Photos: []domain.InstallationPhoto{
			{PhotoType: "ROOF_MOUNT", PhotoURL: "https://vfs.skygrid.ng/photos/roof_001.jpg", UploadedAt: time.Now().UTC()},
			{PhotoType: "INVERTER_BOARD", PhotoURL: "https://vfs.skygrid.ng/photos/board_001.jpg", UploadedAt: time.Now().UTC()},
			{PhotoType: "EARTHING_PIT", PhotoURL: "https://vfs.skygrid.ng/photos/earth_001.jpg", UploadedAt: time.Now().UTC()},
		},
	})
	if err != nil {
		t.Fatalf("Step 12 failed: %v", err)
	}

	// =========================================================================
	// Step 13: 13_COREN_INSPECTED (STRICT EARTHING RESISTANCE TEST)
	// =========================================================================

	// Test A: Failing Earthing Resistance (7.80 Ohms > 5.00 Ohms) MUST FAIL
	failingOhms := 7.80
	_, err = instService.TransitionStatus(ctx, order.ID, usecases.TransitionInstallationDTO{
		NextStatus:             domain.InstallStatus13CORENInspected,
		EarthingResistanceOhms: &failingOhms,
		CORENInspectorID:       "INSP-NEMSA-008",
		CORENCertificateNo:     "COREN-CERT-2026-981",
	})
	if !errors.Is(err, usecases.ErrEarthingResistanceTooHigh) {
		t.Fatalf("expected ErrEarthingResistanceTooHigh for 7.80 Ohms, got %v", err)
	}

	// Test B: Compliant Earthing Resistance (2.15 Ohms <= 5.00 Ohms) MUST PASS
	passingOhms := 2.15
	order, err = instService.TransitionStatus(ctx, order.ID, usecases.TransitionInstallationDTO{
		NextStatus:             domain.InstallStatus13CORENInspected,
		EarthingResistanceOhms: &passingOhms,
		CORENInspectorID:       "INSP-NEMSA-008",
		CORENCertificateNo:     "COREN-CERT-2026-981",
	})
	if err != nil {
		t.Fatalf("Step 13 failed with valid earthing resistance: %v", err)
	}
	if *order.EarthingResistanceOhms != passingOhms {
		t.Errorf("expected recorded earthing resistance %.2f, got %.2f", passingOhms, *order.EarthingResistanceOhms)
	}

	// Step 14: 14_COMMISSIONED
	order, err = instService.TransitionStatus(ctx, order.ID, usecases.TransitionInstallationDTO{
		NextStatus:    domain.InstallStatus14Commissioned,
		DeviceID:      "DEV-GROWATT-IBRAHIM-001",
		GrowattSerial: "GW-SPF5000ES-NG-88992",
		BatterySerial: "LFP-512V-100AH-0012",
	})
	if err != nil {
		t.Fatalf("Step 14 failed: %v", err)
	}

	// Step 15: 15_HANDOVER_SIGNED (Missing signature must fail)
	_, err = instService.TransitionStatus(ctx, order.ID, usecases.TransitionInstallationDTO{
		NextStatus:        domain.InstallStatus15HandoverSigned,
		HandoverSignature: "",
	})
	if !errors.Is(err, usecases.ErrMissingHandoverSignature) {
		t.Errorf("expected ErrMissingHandoverSignature for empty signature, got %v", err)
	}

	order, err = instService.TransitionStatus(ctx, order.ID, usecases.TransitionInstallationDTO{
		NextStatus:        domain.InstallStatus15HandoverSigned,
		HandoverSignature: "Ibrahim Musa (Digitally Signed Acceptance)",
	})
	if err != nil {
		t.Fatalf("Step 15 failed: %v", err)
	}

	// Step 16: 16_COMPLETED
	order, err = instService.TransitionStatus(ctx, order.ID, usecases.TransitionInstallationDTO{
		NextStatus: domain.InstallStatus16Completed,
		Notes:      "Installation fully completed, verified, commissioned and handed over",
	})
	if err != nil {
		t.Fatalf("Step 16 failed: %v", err)
	}
	if order.Status != domain.InstallStatus16Completed {
		t.Errorf("expected final status 16_COMPLETED, got %s", order.Status)
	}
}

// ----------------------------------------------------------------------------
// 2. 13-Step Maintenance & After-Sales Lifecycle
// ----------------------------------------------------------------------------
func TestMaintenanceLifecycle_13StepsAndPartsCapture(t *testing.T) {
	_, maintService, financeService, _ := setupERPServices(t)
	ctx := context.Background()

	// Step 1: 1_FAULT_REPORTED
	reportDTO := usecases.ReportFaultDTO{
		CustomerID:       "CUST-LAGOS-0088",
		CustomerName:     "Bolanle Tinubu",
		DeviceID:         "DEV-GROWATT-LAGOS-0044",
		InverterSerial:   "GW-SPF5000ES-00994",
		FaultCode:        7, // Fault 07: Overload Time Out
		FaultDescription: "Inverter tripped while borehole pump was running; screen shows Error 07",
		Severity:         "HIGH",
	}
	ticket, err := maintService.ReportFault(ctx, reportDTO)
	if err != nil {
		t.Fatalf("failed to report maintenance fault: %v", err)
	}
	if ticket.Status != domain.MaintStatus1FaultReported {
		t.Errorf("expected Step 1 status, got %s", ticket.Status)
	}

	// Step 2: 2_TRIAGED
	ticket, err = maintService.TransitionStatus(ctx, ticket.ID, usecases.TransitionMaintenanceDTO{
		NextStatus: domain.MaintStatus2Triaged,
	})
	if err != nil {
		t.Fatalf("Step 2 failed: %v", err)
	}

	// Step 3: 3_WORK_ORDER_CREATED
	ticket, err = maintService.TransitionStatus(ctx, ticket.ID, usecases.TransitionMaintenanceDTO{
		NextStatus: domain.MaintStatus3WorkOrderCreated,
	})
	if err != nil {
		t.Fatalf("Step 3 failed: %v", err)
	}

	// Step 4: 4_TECH_ASSIGNED
	ticket, err = maintService.TransitionStatus(ctx, ticket.ID, usecases.TransitionMaintenanceDTO{
		NextStatus:             domain.MaintStatus4TechAssigned,
		AssignedTechnicianID:   "TECH-LAGOS-002",
		AssignedTechnicianName: "Technician Segun Alabi",
	})
	if err != nil {
		t.Fatalf("Step 4 failed: %v", err)
	}

	// Step 5: 5_SITE_INSPECTED
	ticket, err = maintService.TransitionStatus(ctx, ticket.ID, usecases.TransitionMaintenanceDTO{
		NextStatus: domain.MaintStatus5SiteInspected,
	})
	if err != nil {
		t.Fatalf("Step 5 failed: %v", err)
	}

	// Step 6: 6_DIAGNOSIS_LOGGED (Missing diagnosis notes must fail)
	_, err = maintService.TransitionStatus(ctx, ticket.ID, usecases.TransitionMaintenanceDTO{
		NextStatus:     domain.MaintStatus6DiagnosisLogged,
		DiagnosisNotes: "",
	})
	if !errors.Is(err, usecases.ErrMissingDiagnosisNotes) {
		t.Errorf("expected ErrMissingDiagnosisNotes for empty diagnosis notes, got %v", err)
	}

	ticket, err = maintService.TransitionStatus(ctx, ticket.ID, usecases.TransitionMaintenanceDTO{
		NextStatus:     domain.MaintStatus6DiagnosisLogged,
		DiagnosisNotes: "Fault 07 caused by inductive inrush from non-inverter pump; AC terminal contactor damaged.",
	})
	if err != nil {
		t.Fatalf("Step 6 failed: %v", err)
	}

	// Step 7: 7_REPAIR_IN_PROGRESS
	ticket, err = maintService.TransitionStatus(ctx, ticket.ID, usecases.TransitionMaintenanceDTO{
		NextStatus: domain.MaintStatus7RepairInProgress,
	})
	if err != nil {
		t.Fatalf("Step 7 failed: %v", err)
	}

	// Step 8: 8_PARTS_RECORDED
	spareParts := []domain.SparePartRecord{
		{PartSKU: "CONTACTOR-40A", Description: "Heavy Duty AC Magnetic Contactor 40A", Quantity: 1, UnitCostKobo: 4500000, TotalKobo: 4500000},
		{PartSKU: "SURGE-FUSE-32A", Description: "Ceramic Fast-Blow Fuse 32A", Quantity: 2, UnitCostKobo: 750000, TotalKobo: 1500000},
	}
	ticket, err = maintService.TransitionStatus(ctx, ticket.ID, usecases.TransitionMaintenanceDTO{
		NextStatus: domain.MaintStatus8PartsRecorded,
		SpareParts: spareParts,
	})
	if err != nil {
		t.Fatalf("Step 8 failed: %v", err)
	}
	if ticket.PartsCostKobo != 6000000 { // ₦60,000
		t.Errorf("expected parts cost ₦60,000, got ₦%d", ticket.PartsCostKobo/100)
	}

	// Step 9: 9_COSTS_CAPTURED (Triggers automated maintenance invoice)
	labourKobo := int64(2500000) // ₦25,000
	ticket, err = maintService.TransitionStatus(ctx, ticket.ID, usecases.TransitionMaintenanceDTO{
		NextStatus:     domain.MaintStatus9CostsCaptured,
		LabourCostKobo: labourKobo,
	})
	if err != nil {
		t.Fatalf("Step 9 failed: %v", err)
	}
	expectedTotalKobo := int64(8500000) // ₦85,000
	if ticket.TotalCostKobo != expectedTotalKobo {
		t.Errorf("expected total maintenance cost ₦85,000, got ₦%d", ticket.TotalCostKobo/100)
	}

	// Verify invoice generated in finance service
	invoices, _ := financeService.ListInvoices(ctx, "", ticket.CustomerID)
	if len(invoices) != 1 || invoices[0].AmountKobo != expectedTotalKobo {
		t.Errorf("expected maintenance invoice for ₦%d, got %v", expectedTotalKobo/100, invoices)
	}

	// Step 10: 10_SUPERVISOR_VERIFIED (Requires supervisor notes and ID)
	_, err = maintService.TransitionStatus(ctx, ticket.ID, usecases.TransitionMaintenanceDTO{
		NextStatus:       domain.MaintStatus10SupervisorVerified,
		SupervisorUserID: "",
		SupervisorNotes:  "",
	})
	if !errors.Is(err, usecases.ErrMissingSupervisorReview) {
		t.Errorf("expected ErrMissingSupervisorReview for missing supervisor sign-off, got %v", err)
	}

	ticket, err = maintService.TransitionStatus(ctx, ticket.ID, usecases.TransitionMaintenanceDTO{
		NextStatus:       domain.MaintStatus10SupervisorVerified,
		SupervisorUserID: "MGR-OPS-001",
		SupervisorNotes:  "Contactor replacement tested under 3.5kW resistive load; normal voltage restored.",
	})
	if err != nil {
		t.Fatalf("Step 10 failed: %v", err)
	}

	// Step 11: 11_COMPLETION_REPORTED
	ticket, err = maintService.TransitionStatus(ctx, ticket.ID, usecases.TransitionMaintenanceDTO{
		NextStatus: domain.MaintStatus11CompletionReported,
	})
	if err != nil {
		t.Fatalf("Step 11 failed: %v", err)
	}

	// Step 12: 12_CUSTOMER_NOTIFIED
	ticket, err = maintService.TransitionStatus(ctx, ticket.ID, usecases.TransitionMaintenanceDTO{
		NextStatus: domain.MaintStatus12CustomerNotified,
	})
	if err != nil {
		t.Fatalf("Step 12 failed: %v", err)
	}
	if ticket.CustomerNotifiedAt == nil {
		t.Errorf("expected customer notified timestamp to be recorded")
	}

	// Step 13: 13_CLOSED
	ticket, err = maintService.TransitionStatus(ctx, ticket.ID, usecases.TransitionMaintenanceDTO{
		NextStatus: domain.MaintStatus13Closed,
	})
	if err != nil {
		t.Fatalf("Step 13 failed: %v", err)
	}
	if ticket.Status != domain.MaintStatus13Closed || ticket.ClosedAt == nil {
		t.Errorf("expected ticket to be CLOSED with closed_at set")
	}
}

// ----------------------------------------------------------------------------
// 3. Finance Engine: Invoices, Payments & Verification Queue
// ----------------------------------------------------------------------------
func TestFinanceEngine_InvoicePaymentVerificationAndSTS(t *testing.T) {
	_, _, financeService, _ := setupERPServices(t)
	ctx := context.Background()

	// 1. Create Invoice
	inv, err := financeService.CreateInvoice(ctx, usecases.CreateInvoiceDTO{
		CustomerID:    "CUST-0099",
		CustomerName:  "Grace Danjuma",
		CustomerEmail: "grace.d@example.com",
		RelatedType:   "LEASE_INSTALLMENT",
		RelatedID:     "CTR-NG-2026-004",
		AmountKobo:    14500000, // ₦145,000 monthly installment
		DueDays:       10,
	})
	if err != nil {
		t.Fatalf("failed to create invoice: %v", err)
	}
	if inv.Status != domain.InvoiceStatusIssued {
		t.Errorf("expected invoice status ISSUED, got %s", inv.Status)
	}

	// 2. Record Inbound Manual Bank Transfer
	payment, err := financeService.RecordInboundPayment(ctx, usecases.RecordPaymentDTO{
		CustomerID:          inv.CustomerID,
		CustomerName:        inv.CustomerName,
		InvoiceID:           inv.ID,
		AmountKobo:          inv.AmountKobo,
		PaymentMethod:       "MANUAL_BANK_TRANSFER",
		BankTellerReference: "GTB-TRF-2026-992144",
		BankName:            "Guaranty Trust Bank",
		AutoVerify:          false,
	})
	if err != nil {
		t.Fatalf("failed to record inbound payment: %v", err)
	}
	if payment.Status != domain.PaymentStatusPendingVerification {
		t.Errorf("expected status PENDING_VERIFICATION, got %s", payment.Status)
	}

	// 3. Inspect Finance Officer Verification Queue
	queue, err := financeService.GetVerificationQueue(ctx)
	if err != nil {
		t.Fatalf("failed to retrieve verification queue: %v", err)
	}
	if len(queue) != 1 || queue[0].ID != payment.ID {
		t.Fatalf("expected 1 item in verification queue matching payment ID, got %d", len(queue))
	}

	// 4. Verify Payment (Issues STS token and updates invoice to PAID)
	result, err := financeService.VerifyPayment(
		ctx,
		payment.ID,
		"USR-FINANCE-OFFICER-01",
		"CTR-NG-2026-004",
		"DEV-8F3A-GROWATT-00421",
		"GW-SPF5000ES-99881",
	)
	if err != nil {
		t.Fatalf("payment verification failed: %v", err)
	}

	if result.Payment.Status != domain.PaymentStatusVerified {
		t.Errorf("expected payment status VERIFIED, got %s", result.Payment.Status)
	}
	if result.Invoice == nil || result.Invoice.Status != domain.InvoiceStatusPaid {
		t.Errorf("expected linked invoice to be marked PAID, got %v", result.Invoice)
	}
	if result.STSTokenIssued == "" {
		t.Errorf("expected 20-digit STS unlock token to be issued upon verification")
	}
	if result.CreditDaysExtended < 25.0 {
		t.Errorf("expected credit days extended ~30 days, got %.1f", result.CreditDaysExtended)
	}

	// Queue should now be empty
	queueAfter, _ := financeService.GetVerificationQueue(ctx)
	if len(queueAfter) != 0 {
		t.Errorf("expected verification queue to be empty after approval, got %d items", len(queueAfter))
	}
}
