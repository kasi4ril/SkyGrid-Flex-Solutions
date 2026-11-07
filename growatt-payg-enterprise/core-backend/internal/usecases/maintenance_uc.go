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
	ErrInvalidMaintenanceStep   = errors.New("invalid maintenance step transition")
	ErrMissingDiagnosisNotes    = errors.New("diagnosis notes required before advancing to repair")
	ErrMissingSparePartsRecord  = errors.New("at least one spare part item or nil parts confirmation required")
	ErrMissingSupervisorReview  = errors.New("supervisor notes and ID required for verification")
)

type MaintenanceService struct {
	erpRepo        repositories.ERPRepository
	financeService *FinanceService
}

func NewMaintenanceService(
	erpRepo repositories.ERPRepository,
	financeService *FinanceService,
) *MaintenanceService {
	return &MaintenanceService{
		erpRepo:        erpRepo,
		financeService: financeService,
	}
}

type ReportFaultDTO struct {
	CustomerID       string `json:"customer_id,omitempty"`
	CustomerName     string `json:"customer_name"`
	DeviceID         string `json:"device_id"`
	InverterSerial   string `json:"inverter_serial,omitempty"`
	FaultCode        int    `json:"fault_code"`
	FaultDescription string `json:"fault_description"`
	Severity         string `json:"severity"` // LOW, MEDIUM, HIGH, CRITICAL
}

type TransitionMaintenanceDTO struct {
	NextStatus             domain.MaintenanceStatus  `json:"next_status"`
	AssignedTechnicianID   string                    `json:"assigned_technician_id,omitempty"`
	AssignedTechnicianName string                    `json:"assigned_technician_name,omitempty"`
	DiagnosisNotes         string                    `json:"diagnosis_notes,omitempty"`
	SpareParts             []domain.SparePartRecord  `json:"spare_parts,omitempty"`
	LabourCostKobo         int64                     `json:"labour_cost_kobo,omitempty"`
	SupervisorUserID       string                    `json:"supervisor_user_id,omitempty"`
	SupervisorNotes        string                    `json:"supervisor_notes,omitempty"`
}

// ReportFault creates a new maintenance ticket at Step 1: 1_FAULT_REPORTED.
func (s *MaintenanceService) ReportFault(ctx context.Context, dto ReportFaultDTO) (*domain.MaintenanceTicket, error) {
	if strings.TrimSpace(dto.DeviceID) == "" || strings.TrimSpace(dto.FaultDescription) == "" {
		return nil, errors.New("device_id and fault_description are required")
	}

	severity := strings.ToUpper(strings.TrimSpace(dto.Severity))
	if severity == "" {
		severity = "MEDIUM"
	}

	ticketNum := fmt.Sprintf("TCK-MNT-2026-%s", strings.ToUpper(newRandomTokenHex(3)))

	ticket := &domain.MaintenanceTicket{
		TicketNumber:     ticketNum,
		CustomerID:       dto.CustomerID,
		CustomerName:     dto.CustomerName,
		DeviceID:         dto.DeviceID,
		InverterSerial:   dto.InverterSerial,
		FaultCode:        dto.FaultCode,
		FaultDescription: dto.FaultDescription,
		Severity:         severity,
		Status:           domain.MaintStatus1FaultReported,
		SpareParts:       []domain.SparePartRecord{},
	}

	if err := s.erpRepo.CreateMaintenanceTicket(ctx, ticket); err != nil {
		return nil, fmt.Errorf("failed to create maintenance ticket: %w", err)
	}

	return ticket, nil
}

// TransitionStatus moves the ticket through the 13-step lifecycle with strict checks.
func (s *MaintenanceService) TransitionStatus(
	ctx context.Context,
	ticketID string,
	dto TransitionMaintenanceDTO,
) (*domain.MaintenanceTicket, error) {
	ticket, err := s.erpRepo.GetMaintenanceTicketByID(ctx, ticketID)
	if err != nil {
		return nil, err
	}

	currentIdx := maintStepIndex(ticket.Status)
	nextIdx := maintStepIndex(dto.NextStatus)
	if nextIdx != currentIdx+1 {
		return nil, fmt.Errorf("%w: cannot transition from %s to %s", ErrInvalidMaintenanceStep, ticket.Status, dto.NextStatus)
	}

	switch dto.NextStatus {
	case domain.MaintStatus4TechAssigned:
		if dto.AssignedTechnicianID != "" {
			ticket.AssignedTechnicianID = dto.AssignedTechnicianID
			ticket.AssignedTechnicianName = dto.AssignedTechnicianName
		}

	case domain.MaintStatus6DiagnosisLogged:
		if strings.TrimSpace(dto.DiagnosisNotes) == "" {
			return nil, ErrMissingDiagnosisNotes
		}
		ticket.DiagnosisNotes = dto.DiagnosisNotes

	case domain.MaintStatus8PartsRecorded:
		if len(dto.SpareParts) > 0 {
			ticket.SpareParts = dto.SpareParts
			var partsTotal int64
			for _, part := range dto.SpareParts {
				partsTotal += part.TotalKobo
			}
			ticket.PartsCostKobo = partsTotal
		}

	case domain.MaintStatus9CostsCaptured:
		if dto.LabourCostKobo > 0 {
			ticket.LabourCostKobo = dto.LabourCostKobo
		}
		ticket.TotalCostKobo = ticket.PartsCostKobo + ticket.LabourCostKobo

		// Automatically generate maintenance repair invoice if costs were incurred
		if s.financeService != nil && ticket.TotalCostKobo > 0 {
			_, _ = s.financeService.CreateInvoice(ctx, CreateInvoiceDTO{
				CustomerID:   ticket.CustomerID,
				CustomerName: ticket.CustomerName,
				RelatedType:  "MAINTENANCE",
				RelatedID:    ticket.ID,
				AmountKobo:   ticket.TotalCostKobo,
				DueDays:      7,
			})
		}

	case domain.MaintStatus10SupervisorVerified:
		if strings.TrimSpace(dto.SupervisorUserID) == "" || strings.TrimSpace(dto.SupervisorNotes) == "" {
			return nil, ErrMissingSupervisorReview
		}
		now := time.Now().UTC()
		ticket.SupervisorUserID = dto.SupervisorUserID
		ticket.SupervisorNotes = dto.SupervisorNotes
		ticket.SupervisorVerifiedAt = &now

	case domain.MaintStatus12CustomerNotified:
		now := time.Now().UTC()
		ticket.CustomerNotifiedAt = &now

	case domain.MaintStatus13Closed:
		now := time.Now().UTC()
		ticket.ClosedAt = &now
	}

	ticket.Status = dto.NextStatus

	if err := s.erpRepo.UpdateMaintenanceTicket(ctx, ticket); err != nil {
		return nil, fmt.Errorf("failed to update maintenance ticket: %w", err)
	}

	return ticket, nil
}

func (s *MaintenanceService) GetTicket(ctx context.Context, id string) (*domain.MaintenanceTicket, error) {
	return s.erpRepo.GetMaintenanceTicketByID(ctx, id)
}

func (s *MaintenanceService) ListTickets(ctx context.Context, status, deviceID, techID string) ([]domain.MaintenanceTicket, error) {
	return s.erpRepo.ListMaintenanceTickets(ctx, status, deviceID, techID)
}

func maintStepIndex(status domain.MaintenanceStatus) int {
	for i, s := range domain.OrderedMaintenanceSteps {
		if s == status {
			return i
		}
	}
	return -1
}
