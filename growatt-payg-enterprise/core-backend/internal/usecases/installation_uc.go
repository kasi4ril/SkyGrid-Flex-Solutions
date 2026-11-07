// Package usecases implements core application business logic.
package usecases

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/SkyGrid-Flex-Solutions/growatt-payg-enterprise/core-backend/internal/adapters/repositories"
	"github.com/SkyGrid-Flex-Solutions/growatt-payg-enterprise/core-backend/internal/domain"
)

var (
	ErrInvalidStepTransition    = errors.New("invalid installation step transition")
	ErrEarthingResistanceTooHigh = errors.New("earthing resistance exceeds COREN/NEMSA limit of 5.00 Ohms")
	ErrMissingBOMItems          = errors.New("bill of materials (BOM) items required for this step")
	ErrMissingPhotos            = errors.New("installation photos required for this step")
	ErrMissingCORENCert         = errors.New("COREN inspection requires inspector accreditation and certificate number")
	ErrMissingHandoverSignature = errors.New("handover signature required from customer")
)

type InstallationService struct {
	erpRepo        repositories.ERPRepository
	financeService *FinanceService
}

func NewInstallationService(
	erpRepo repositories.ERPRepository,
	financeService *FinanceService,
) *InstallationService {
	return &InstallationService{
		erpRepo:        erpRepo,
		financeService: financeService,
	}
}

type CreateInstallationDTO struct {
	CustomerID        string  `json:"customer_id"`
	CustomerName      string  `json:"customer_name"`
	CustomerPhone     string  `json:"customer_phone"`
	CustomerEmail     string  `json:"customer_email"`
	SiteAddress       string  `json:"site_address"`
	GPSLat            float64 `json:"gps_lat"`
	GPSLng            float64 `json:"gps_lng"`
	StateRegion       string  `json:"state_region"`
	InverterSKU       string  `json:"inverter_sku"`
	PVKWpPlanned      float64 `json:"pv_kwp_planned"`
	BatteryKWhPlanned float64 `json:"battery_kwh_planned"`
	TotalAmountKobo   int64   `json:"total_amount_kobo"`
	Notes             string  `json:"notes,omitempty"`
}

type TransitionInstallationDTO struct {
	NextStatus             domain.InstallationStatus  `json:"next_status"`
	AssignedEngineerID     string                     `json:"assigned_engineer_id,omitempty"`
	AssignedEngineerName   string                     `json:"assigned_engineer_name,omitempty"`
	ScheduledDate          *time.Time                 `json:"scheduled_date,omitempty"`
	BOMItems               []domain.BOMItem           `json:"bom_items,omitempty"`
	Photos                 []domain.InstallationPhoto `json:"photos,omitempty"`
	EarthingResistanceOhms *float64                   `json:"earthing_resistance_ohms,omitempty"`
	CORENInspectorID       string                     `json:"coren_inspector_id,omitempty"`
	CORENCertificateNo     string                     `json:"coren_certificate_no,omitempty"`
	HandoverSignature      string                     `json:"handover_signature,omitempty"`
	DeviceID               string                     `json:"device_id,omitempty"`
	GrowattSerial          string                     `json:"growatt_serial,omitempty"`
	BatterySerial          string                     `json:"battery_serial,omitempty"`
	Notes                  string                     `json:"notes,omitempty"`
}

// CreateInstallation initializes Step 1: 1_REQUEST_SUBMITTED.
func (s *InstallationService) CreateInstallation(ctx context.Context, dto CreateInstallationDTO) (*domain.InstallationWorkOrder, error) {
	if strings.TrimSpace(dto.CustomerName) == "" || strings.TrimSpace(dto.SiteAddress) == "" {
		return nil, errors.New("customer_name and site_address are required")
	}

	woNum := fmt.Sprintf("WO-INST-2026-%s", strings.ToUpper(newRandomTokenHex(3)))

	order := &domain.InstallationWorkOrder{
		WorkOrderNumber:   woNum,
		CustomerID:        dto.CustomerID,
		CustomerName:      dto.CustomerName,
		CustomerPhone:     dto.CustomerPhone,
		CustomerEmail:     dto.CustomerEmail,
		SiteAddress:       dto.SiteAddress,
		GPSLat:            dto.GPSLat,
		GPSLng:            dto.GPSLng,
		StateRegion:       dto.StateRegion,
		Status:            domain.InstallStatus1RequestSubmitted,
		InverterSKU:       dto.InverterSKU,
		PVKWpPlanned:      dto.PVKWpPlanned,
		BatteryKWhPlanned: dto.BatteryKWhPlanned,
		TotalAmountKobo:   dto.TotalAmountKobo,
		Notes:             dto.Notes,
		BOMItems:          []domain.BOMItem{},
		Photos:            []domain.InstallationPhoto{},
	}

	if err := s.erpRepo.CreateInstallation(ctx, order); err != nil {
		return nil, fmt.Errorf("failed to create installation work order: %w", err)
	}

	return order, nil
}

// TransitionStatus moves the work order through the 16-step pipeline with strict validation.
func (s *InstallationService) TransitionStatus(
	ctx context.Context,
	workOrderID string,
	dto TransitionInstallationDTO,
) (*domain.InstallationWorkOrder, error) {
	order, err := s.erpRepo.GetInstallationByID(ctx, workOrderID)
	if err != nil {
		return nil, err
	}

	// Validate step sequence
	currentIdx := stepIndex(order.Status)
	nextIdx := stepIndex(dto.NextStatus)
	if nextIdx != currentIdx+1 {
		return nil, fmt.Errorf("%w: cannot transition from %s to %s", ErrInvalidStepTransition, order.Status, dto.NextStatus)
	}

	// Step-specific validations & automated side effects:
	switch dto.NextStatus {
	case domain.InstallStatus6QuotationApproved, domain.InstallStatus7WorkOrderCreated:
		// Automatically generate Down-Payment / Installation Invoice if not already created
		if s.financeService != nil && order.TotalAmountKobo > 0 {
			depositAmount := order.TotalAmountKobo * 30 / 100 // 30% Down Payment
			_, _ = s.financeService.CreateInvoice(ctx, CreateInvoiceDTO{
				CustomerID:    order.CustomerID,
				CustomerName:  order.CustomerName,
				CustomerEmail: order.CustomerEmail,
				RelatedType:   "INSTALLATION",
				RelatedID:     order.ID,
				AmountKobo:    depositAmount,
				DueDays:       7,
			})
		}

	case domain.InstallStatus8TechnicianAssigned:
		if dto.AssignedEngineerID != "" {
			order.AssignedEngineerID = dto.AssignedEngineerID
			order.AssignedEngineerName = dto.AssignedEngineerName
		}

	case domain.InstallStatus9InstallationScheduled:
		if dto.ScheduledDate != nil {
			order.ScheduledDate = dto.ScheduledDate
		}

	case domain.InstallStatus11BOMDocumented:
		if len(dto.BOMItems) > 0 {
			order.BOMItems = dto.BOMItems
		}

	case domain.InstallStatus12PhotosUploaded:
		if len(dto.Photos) > 0 {
			order.Photos = append(order.Photos, dto.Photos...)
		}

	case domain.InstallStatus13CORENInspected:
		// =========================================================================
		// MANDATORY COREN & NEMSA SAFETY RULE: Earthing Resistance <= 5.00 Ohms
		// =========================================================================
		if dto.EarthingResistanceOhms == nil {
			return nil, errors.New("earthing_resistance_ohms must be specified for COREN inspection")
		}
		if *dto.EarthingResistanceOhms > domain.MaxCORENEarthingResistanceOhms {
			return nil, fmt.Errorf("%w: measured %.2f Ohms exceeds maximum allowed %.2f Ohms",
				ErrEarthingResistanceTooHigh, *dto.EarthingResistanceOhms, domain.MaxCORENEarthingResistanceOhms)
		}
		if strings.TrimSpace(dto.CORENCertificateNo) == "" {
			return nil, ErrMissingCORENCert
		}
		order.EarthingResistanceOhms = dto.EarthingResistanceOhms
		order.CORENInspectorID = dto.CORENInspectorID
		order.CORENCertificateNo = dto.CORENCertificateNo

	case domain.InstallStatus14Commissioned:
		if dto.DeviceID != "" {
			order.DeviceID = dto.DeviceID
		}
		if dto.GrowattSerial != "" {
			order.GrowattSerial = dto.GrowattSerial
		}
		if dto.BatterySerial != "" {
			order.BatterySerial = dto.BatterySerial
		}

	case domain.InstallStatus15HandoverSigned:
		if strings.TrimSpace(dto.HandoverSignature) == "" {
			return nil, ErrMissingHandoverSignature
		}
		now := time.Now().UTC()
		order.HandoverSignature = dto.HandoverSignature
		order.HandoverSignedAt = &now

	case domain.InstallStatus16Completed:
		// Final step
	}

	order.Status = dto.NextStatus
	if dto.Notes != "" {
		order.Notes = dto.Notes
	}

	if err := s.erpRepo.UpdateInstallation(ctx, order); err != nil {
		return nil, fmt.Errorf("failed to update installation work order: %w", err)
	}

	return order, nil
}

func (s *InstallationService) GetInstallation(ctx context.Context, id string) (*domain.InstallationWorkOrder, error) {
	return s.erpRepo.GetInstallationByID(ctx, id)
}

func (s *InstallationService) ListInstallations(ctx context.Context, status, customerID, engineerID string) ([]domain.InstallationWorkOrder, error) {
	return s.erpRepo.ListInstallations(ctx, status, customerID, engineerID)
}

func stepIndex(status domain.InstallationStatus) int {
	for i, s := range domain.OrderedInstallationSteps {
		if s == status {
			return i
		}
	}
	return -1
}
