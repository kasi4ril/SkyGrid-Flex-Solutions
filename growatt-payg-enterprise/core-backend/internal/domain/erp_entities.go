// Package domain contains the core enterprise business entities, value objects,
// and invariant rules for the Growatt PAYG Solar & Fintech platform.
package domain

import "time"

// ============================================================================
// 1. 16-Step Installation Work-Order Pipeline Entities
// ============================================================================

type InstallationStatus string

const (
	InstallStatus1RequestSubmitted           InstallationStatus = "1_REQUEST_SUBMITTED"
	InstallStatus2OpsReviewed                InstallationStatus = "2_OPS_REVIEWED"
	InstallStatus3SiteAssessmentScheduled    InstallationStatus = "3_SITE_ASSESSMENT_SCHEDULED"
	InstallStatus4SiteAssessed               InstallationStatus = "4_SITE_ASSESSED"
	InstallStatus5QuotationPrepared          InstallationStatus = "5_QUOTATION_PREPARED"
	InstallStatus6QuotationApproved          InstallationStatus = "6_QUOTATION_APPROVED"
	InstallStatus7WorkOrderCreated           InstallationStatus = "7_WORK_ORDER_CREATED"
	InstallStatus8TechnicianAssigned         InstallationStatus = "8_TECHNICIAN_ASSIGNED"
	InstallStatus9InstallationScheduled      InstallationStatus = "9_INSTALLATION_SCHEDULED"
	InstallStatus10InProgress                InstallationStatus = "10_IN_PROGRESS"
	InstallStatus11BOMDocumented             InstallationStatus = "11_BOM_DOCUMENTED"
	InstallStatus12PhotosUploaded            InstallationStatus = "12_PHOTOS_UPLOADED"
	InstallStatus13CORENInspected            InstallationStatus = "13_COREN_INSPECTED"
	InstallStatus14Commissioned              InstallationStatus = "14_COMMISSIONED"
	InstallStatus15HandoverSigned            InstallationStatus = "15_HANDOVER_SIGNED"
	InstallStatus16Completed                 InstallationStatus = "16_COMPLETED"
)

// OrderedInstallationSteps defines the canonical 16-step forward sequence.
var OrderedInstallationSteps = []InstallationStatus{
	InstallStatus1RequestSubmitted,
	InstallStatus2OpsReviewed,
	InstallStatus3SiteAssessmentScheduled,
	InstallStatus4SiteAssessed,
	InstallStatus5QuotationPrepared,
	InstallStatus6QuotationApproved,
	InstallStatus7WorkOrderCreated,
	InstallStatus8TechnicianAssigned,
	InstallStatus9InstallationScheduled,
	InstallStatus10InProgress,
	InstallStatus11BOMDocumented,
	InstallStatus12PhotosUploaded,
	InstallStatus13CORENInspected,
	InstallStatus14Commissioned,
	InstallStatus15HandoverSigned,
	InstallStatus16Completed,
}

// MaxCORENEarthingResistanceOhms enforces the Nigerian COREN / NEMSA electrical safety limit.
const MaxCORENEarthingResistanceOhms = 5.00

type BOMItem struct {
	ItemCode    string  `json:"item_code"`
	Description string  `json:"description"`
	Quantity    float64 `json:"quantity"`
	Unit        string  `json:"unit"`
}

type InstallationPhoto struct {
	PhotoType   string    `json:"photo_type"` // ROOF_MOUNT, INVERTER_BOARD, EARTHING_PIT, BATTERY_RACK
	PhotoURL    string    `json:"photo_url"`
	UploadedAt  time.Time `json:"uploaded_at"`
	Description string    `json:"description,omitempty"`
}

type InstallationWorkOrder struct {
	ID                     string              `json:"id"`
	WorkOrderNumber        string              `json:"work_order_number"`
	CustomerID             string              `json:"customer_id,omitempty"`
	CustomerName           string              `json:"customer_name"`
	CustomerPhone          string              `json:"customer_phone"`
	CustomerEmail          string              `json:"customer_email"`
	SiteAddress            string              `json:"site_address"`
	GPSLat                 float64             `json:"gps_lat"`
	GPSLng                 float64             `json:"gps_lng"`
	StateRegion            string              `json:"state_region"`
	Status                 InstallationStatus  `json:"status"`
	InverterSKU            string              `json:"inverter_sku"`
	PVKWpPlanned           float64             `json:"pv_kwp_planned"`
	BatteryKWhPlanned      float64             `json:"battery_kwh_planned"`
	TotalAmountKobo        int64               `json:"total_amount_kobo"`
	AssignedEngineerID     string              `json:"assigned_engineer_id,omitempty"`
	AssignedEngineerName   string              `json:"assigned_engineer_name,omitempty"`
	ScheduledDate          *time.Time          `json:"scheduled_date,omitempty"`
	BOMItems               []BOMItem           `json:"bom_items"`
	Photos                 []InstallationPhoto `json:"photos"`
	EarthingResistanceOhms *float64            `json:"earthing_resistance_ohms,omitempty"`
	CORENInspectorID       string              `json:"coren_inspector_id,omitempty"`
	CORENCertificateNo     string              `json:"coren_certificate_no,omitempty"`
	HandoverSignature      string              `json:"handover_signature,omitempty"`
	HandoverSignedAt       *time.Time          `json:"handover_signed_at,omitempty"`
	DeviceID               string              `json:"device_id,omitempty"`
	GrowattSerial          string              `json:"growatt_serial,omitempty"`
	BatterySerial          string              `json:"battery_serial,omitempty"`
	ApprovedByUserID       string              `json:"approved_by_user_id,omitempty"`
	ApprovedByStaffName    string              `json:"approved_by_staff_name,omitempty"`
	ApprovalStatus         string              `json:"approval_status,omitempty"`
	ApprovalNotes          string              `json:"approval_notes,omitempty"`
	ReviewedAt             *time.Time          `json:"reviewed_at,omitempty"`
	Notes                  string              `json:"notes,omitempty"`
	CreatedAt              time.Time           `json:"created_at"`
	UpdatedAt              time.Time           `json:"updated_at"`
}

// ============================================================================
// 2. 13-Step Maintenance & After-Sales Service Lifecycle Entities
// ============================================================================

type MaintenanceStatus string

const (
	MaintStatus1FaultReported       MaintenanceStatus = "1_FAULT_REPORTED"
	MaintStatus2Triaged             MaintenanceStatus = "2_TRIAGED"
	MaintStatus3WorkOrderCreated    MaintenanceStatus = "3_WORK_ORDER_CREATED"
	MaintStatus4TechAssigned        MaintenanceStatus = "4_TECH_ASSIGNED"
	MaintStatus5SiteInspected       MaintenanceStatus = "5_SITE_INSPECTED"
	MaintStatus6DiagnosisLogged     MaintenanceStatus = "6_DIAGNOSIS_LOGGED"
	MaintStatus7RepairInProgress    MaintenanceStatus = "7_REPAIR_IN_PROGRESS"
	MaintStatus8PartsRecorded       MaintenanceStatus = "8_PARTS_RECORDED"
	MaintStatus9CostsCaptured       MaintenanceStatus = "9_COSTS_CAPTURED"
	MaintStatus10SupervisorVerified MaintenanceStatus = "10_SUPERVISOR_VERIFIED"
	MaintStatus11CompletionReported MaintenanceStatus = "11_COMPLETION_REPORTED"
	MaintStatus12CustomerNotified   MaintenanceStatus = "12_CUSTOMER_NOTIFIED"
	MaintStatus13Closed             MaintenanceStatus = "13_CLOSED"
)

var OrderedMaintenanceSteps = []MaintenanceStatus{
	MaintStatus1FaultReported,
	MaintStatus2Triaged,
	MaintStatus3WorkOrderCreated,
	MaintStatus4TechAssigned,
	MaintStatus5SiteInspected,
	MaintStatus6DiagnosisLogged,
	MaintStatus7RepairInProgress,
	MaintStatus8PartsRecorded,
	MaintStatus9CostsCaptured,
	MaintStatus10SupervisorVerified,
	MaintStatus11CompletionReported,
	MaintStatus12CustomerNotified,
	MaintStatus13Closed,
}

type SparePartRecord struct {
	PartSKU      string `json:"part_sku"`
	Description  string `json:"description"`
	Quantity     int    `json:"quantity"`
	UnitCostKobo int64  `json:"unit_cost_kobo"`
	TotalKobo    int64  `json:"total_kobo"`
}

type MaintenanceTicket struct {
	ID                     string            `json:"id"`
	TicketNumber           string            `json:"ticket_number"`
	CustomerID             string            `json:"customer_id,omitempty"`
	CustomerName           string            `json:"customer_name"`
	DeviceID               string            `json:"device_id"`
	InverterSerial         string            `json:"inverter_serial,omitempty"`
	FaultCode              int               `json:"fault_code"`
	FaultDescription       string            `json:"fault_description"`
	Severity               string            `json:"severity"` // LOW, MEDIUM, HIGH, CRITICAL
	Status                 MaintenanceStatus `json:"status"`
	AssignedTechnicianID   string            `json:"assigned_technician_id,omitempty"`
	AssignedTechnicianName string            `json:"assigned_technician_name,omitempty"`
	DiagnosisNotes         string            `json:"diagnosis_notes,omitempty"`
	SpareParts             []SparePartRecord `json:"spare_parts"`
	LabourCostKobo         int64             `json:"labour_cost_kobo"`
	PartsCostKobo          int64             `json:"parts_cost_kobo"`
	TotalCostKobo          int64             `json:"total_cost_kobo"`
	SupervisorUserID       string            `json:"supervisor_user_id,omitempty"`
	SupervisorNotes        string            `json:"supervisor_notes,omitempty"`
	SupervisorVerifiedAt   *time.Time        `json:"supervisor_verified_at,omitempty"`
	ApprovedByUserID       string            `json:"approved_by_user_id,omitempty"`
	ApprovedByStaffName    string            `json:"approved_by_staff_name,omitempty"`
	ApprovalStatus         string            `json:"approval_status,omitempty"`
	ApprovalNotes          string            `json:"approval_notes,omitempty"`
	ReviewedAt             *time.Time        `json:"reviewed_at,omitempty"`
	CustomerNotifiedAt     *time.Time        `json:"customer_notified_at,omitempty"`
	ClosedAt               *time.Time        `json:"closed_at,omitempty"`
	CreatedAt              time.Time         `json:"created_at"`
	UpdatedAt              time.Time         `json:"updated_at"`
}

// ============================================================================
// 3. Finance Invoicing & Payment Verification Entities
// ============================================================================

type InvoiceStatus string

const (
	InvoiceStatusDraft         InvoiceStatus = "DRAFT"
	InvoiceStatusIssued        InvoiceStatus = "ISSUED"
	InvoiceStatusPartiallyPaid InvoiceStatus = "PARTIALLY_PAID"
	InvoiceStatusPaid          InvoiceStatus = "PAID"
	InvoiceStatusOverdue       InvoiceStatus = "OVERDUE"
	InvoiceStatusCancelled     InvoiceStatus = "CANCELLED"
)

type Invoice struct {
	ID             string        `json:"id"`
	InvoiceNumber  string        `json:"invoice_number"`
	CustomerID     string        `json:"customer_id,omitempty"`
	CustomerName   string        `json:"customer_name"`
	CustomerEmail  string        `json:"customer_email"`
	RelatedType    string        `json:"related_type"` // INSTALLATION, MAINTENANCE, CONTRACT, RECHARGE
	RelatedID      string        `json:"related_id"`
	AmountKobo     int64         `json:"amount_kobo"`
	PaidAmountKobo int64         `json:"paid_amount_kobo"`
	Status         InvoiceStatus `json:"status"`
	DueDate        time.Time     `json:"due_date"`
	CreatedAt      time.Time     `json:"created_at"`
	UpdatedAt      time.Time     `json:"updated_at"`
}

type PaymentStatus string

const (
	PaymentStatusPendingVerification PaymentStatus = "PENDING_VERIFICATION"
	PaymentStatusVerified            PaymentStatus = "VERIFIED"
	PaymentStatusRejected            PaymentStatus = "REJECTED"
)

type FinancePayment struct {
	ID                  string        `json:"id"`
	PaymentReference    string        `json:"payment_reference"`
	CustomerID          string        `json:"customer_id,omitempty"`
	CustomerName        string        `json:"customer_name"`
	InvoiceID           string        `json:"invoice_id,omitempty"`
	AmountKobo          int64         `json:"amount_kobo"`
	PaymentMethod       string        `json:"payment_method"` // MONIEPOINT_DVA, PAYSTACK_DVA, OPAY_DVA, MANUAL_BANK_TRANSFER
	BankTellerReference string        `json:"bank_teller_ref,omitempty"`
	BankName            string        `json:"bank_name,omitempty"`
	Status              PaymentStatus `json:"status"`
	VerifiedByUserID    string        `json:"verified_by_user_id,omitempty"`
	VerifiedAt          *time.Time    `json:"verified_at,omitempty"`
	ApprovedByUserID    string        `json:"approved_by_user_id,omitempty"`
	ApprovedByStaffName string        `json:"approved_by_staff_name,omitempty"`
	ApprovalStatus      string        `json:"approval_status,omitempty"`
	ApprovalNotes       string        `json:"approval_notes,omitempty"`
	ReviewedAt          *time.Time    `json:"reviewed_at,omitempty"`
	STSTokenIssued      string        `json:"sts_token_issued,omitempty"`
	CreditDaysExtended  float64       `json:"credit_days_extended"`
	RejectionReason     string        `json:"rejection_reason,omitempty"`
	CreatedAt           time.Time     `json:"created_at"`
	UpdatedAt           time.Time     `json:"updated_at"`
}
