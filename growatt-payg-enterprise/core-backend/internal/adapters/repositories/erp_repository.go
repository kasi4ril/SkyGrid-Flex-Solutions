// Package repositories implements persistence adapters for enterprise ERP workflows.
package repositories

import (
	"context"
	"errors"
	"sync"
	"time"

	"github.com/SkyGrid-Flex-Solutions/growatt-payg-enterprise/core-backend/internal/domain"
)

var (
	ErrInstallationNotFound = errors.New("installation work order not found")
	ErrTicketNotFound       = errors.New("maintenance ticket not found")
	ErrInvoiceNotFound      = errors.New("invoice not found")
	ErrPaymentNotFound      = errors.New("finance payment record not found")
)

type ERPRepository interface {
	// Installations
	CreateInstallation(ctx context.Context, order *domain.InstallationWorkOrder) error
	GetInstallationByID(ctx context.Context, id string) (*domain.InstallationWorkOrder, error)
	GetInstallationByNumber(ctx context.Context, number string) (*domain.InstallationWorkOrder, error)
	UpdateInstallation(ctx context.Context, order *domain.InstallationWorkOrder) error
	ListInstallations(ctx context.Context, status string, customerID string, engineerID string) ([]domain.InstallationWorkOrder, error)

	// Maintenance
	CreateMaintenanceTicket(ctx context.Context, ticket *domain.MaintenanceTicket) error
	GetMaintenanceTicketByID(ctx context.Context, id string) (*domain.MaintenanceTicket, error)
	GetMaintenanceTicketByNumber(ctx context.Context, number string) (*domain.MaintenanceTicket, error)
	UpdateMaintenanceTicket(ctx context.Context, ticket *domain.MaintenanceTicket) error
	ListMaintenanceTickets(ctx context.Context, status string, deviceID string, technicianID string) ([]domain.MaintenanceTicket, error)

	// Invoices
	CreateInvoice(ctx context.Context, inv *domain.Invoice) error
	GetInvoiceByID(ctx context.Context, id string) (*domain.Invoice, error)
	GetInvoiceByNumber(ctx context.Context, number string) (*domain.Invoice, error)
	UpdateInvoice(ctx context.Context, inv *domain.Invoice) error
	ListInvoices(ctx context.Context, status string, customerID string) ([]domain.Invoice, error)

	// Payments
	CreateFinancePayment(ctx context.Context, payment *domain.FinancePayment) error
	GetFinancePaymentByID(ctx context.Context, id string) (*domain.FinancePayment, error)
	GetFinancePaymentByReference(ctx context.Context, ref string) (*domain.FinancePayment, error)
	UpdateFinancePayment(ctx context.Context, payment *domain.FinancePayment) error
	ListFinancePayments(ctx context.Context, status string, customerID string) ([]domain.FinancePayment, error)
}

type MemoryERPRepository struct {
	mu            sync.RWMutex
	installations map[string]*domain.InstallationWorkOrder
	instByNumber  map[string]*domain.InstallationWorkOrder

	tickets        map[string]*domain.MaintenanceTicket
	ticketByNumber map[string]*domain.MaintenanceTicket

	invoices    map[string]*domain.Invoice
	invByNumber map[string]*domain.Invoice

	payments     map[string]*domain.FinancePayment
	paymentByRef map[string]*domain.FinancePayment
}

func NewMemoryERPRepository() *MemoryERPRepository {
	return &MemoryERPRepository{
		installations:  make(map[string]*domain.InstallationWorkOrder),
		instByNumber:   make(map[string]*domain.InstallationWorkOrder),
		tickets:        make(map[string]*domain.MaintenanceTicket),
		ticketByNumber: make(map[string]*domain.MaintenanceTicket),
		invoices:       make(map[string]*domain.Invoice),
		invByNumber:    make(map[string]*domain.Invoice),
		payments:       make(map[string]*domain.FinancePayment),
		paymentByRef:   make(map[string]*domain.FinancePayment),
	}
}

// ----------------------------------------------------------------------------
// Installations
// ----------------------------------------------------------------------------
func (r *MemoryERPRepository) CreateInstallation(ctx context.Context, order *domain.InstallationWorkOrder) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	if order.ID == "" {
		order.ID = newUUID()
	}
	now := time.Now().UTC()
	if order.CreatedAt.IsZero() {
		order.CreatedAt = now
	}
	order.UpdatedAt = now

	oCopy := *order
	r.installations[order.ID] = &oCopy
	r.instByNumber[order.WorkOrderNumber] = &oCopy
	return nil
}

func (r *MemoryERPRepository) GetInstallationByID(ctx context.Context, id string) (*domain.InstallationWorkOrder, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	order, ok := r.installations[id]
	if !ok {
		return nil, ErrInstallationNotFound
	}
	oCopy := *order
	return &oCopy, nil
}

func (r *MemoryERPRepository) GetInstallationByNumber(ctx context.Context, number string) (*domain.InstallationWorkOrder, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	order, ok := r.instByNumber[number]
	if !ok {
		return nil, ErrInstallationNotFound
	}
	oCopy := *order
	return &oCopy, nil
}

func (r *MemoryERPRepository) UpdateInstallation(ctx context.Context, order *domain.InstallationWorkOrder) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	if _, ok := r.installations[order.ID]; !ok {
		return ErrInstallationNotFound
	}
	order.UpdatedAt = time.Now().UTC()
	oCopy := *order
	r.installations[order.ID] = &oCopy
	r.instByNumber[order.WorkOrderNumber] = &oCopy
	return nil
}

func (r *MemoryERPRepository) ListInstallations(ctx context.Context, status string, customerID string, engineerID string) ([]domain.InstallationWorkOrder, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	var result []domain.InstallationWorkOrder
	for _, inst := range r.installations {
		if status != "" && string(inst.Status) != status {
			continue
		}
		if customerID != "" && inst.CustomerID != customerID {
			continue
		}
		if engineerID != "" && inst.AssignedEngineerID != engineerID {
			continue
		}
		result = append(result, *inst)
	}
	return result, nil
}

// ----------------------------------------------------------------------------
// Maintenance
// ----------------------------------------------------------------------------
func (r *MemoryERPRepository) CreateMaintenanceTicket(ctx context.Context, ticket *domain.MaintenanceTicket) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	if ticket.ID == "" {
		ticket.ID = newUUID()
	}
	now := time.Now().UTC()
	if ticket.CreatedAt.IsZero() {
		ticket.CreatedAt = now
	}
	ticket.UpdatedAt = now

	tCopy := *ticket
	r.tickets[ticket.ID] = &tCopy
	r.ticketByNumber[ticket.TicketNumber] = &tCopy
	return nil
}

func (r *MemoryERPRepository) GetMaintenanceTicketByID(ctx context.Context, id string) (*domain.MaintenanceTicket, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	ticket, ok := r.tickets[id]
	if !ok {
		return nil, ErrTicketNotFound
	}
	tCopy := *ticket
	return &tCopy, nil
}

func (r *MemoryERPRepository) GetMaintenanceTicketByNumber(ctx context.Context, number string) (*domain.MaintenanceTicket, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	ticket, ok := r.ticketByNumber[number]
	if !ok {
		return nil, ErrTicketNotFound
	}
	tCopy := *ticket
	return &tCopy, nil
}

func (r *MemoryERPRepository) UpdateMaintenanceTicket(ctx context.Context, ticket *domain.MaintenanceTicket) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	if _, ok := r.tickets[ticket.ID]; !ok {
		return ErrTicketNotFound
	}
	ticket.UpdatedAt = time.Now().UTC()
	tCopy := *ticket
	r.tickets[ticket.ID] = &tCopy
	r.ticketByNumber[ticket.TicketNumber] = &tCopy
	return nil
}

func (r *MemoryERPRepository) ListMaintenanceTickets(ctx context.Context, status string, deviceID string, technicianID string) ([]domain.MaintenanceTicket, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	var result []domain.MaintenanceTicket
	for _, ticket := range r.tickets {
		if status != "" && string(ticket.Status) != status {
			continue
		}
		if deviceID != "" && ticket.DeviceID != deviceID {
			continue
		}
		if technicianID != "" && ticket.AssignedTechnicianID != technicianID {
			continue
		}
		result = append(result, *ticket)
	}
	return result, nil
}

// ----------------------------------------------------------------------------
// Invoices
// ----------------------------------------------------------------------------
func (r *MemoryERPRepository) CreateInvoice(ctx context.Context, inv *domain.Invoice) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	if inv.ID == "" {
		inv.ID = newUUID()
	}
	now := time.Now().UTC()
	if inv.CreatedAt.IsZero() {
		inv.CreatedAt = now
	}
	inv.UpdatedAt = now

	iCopy := *inv
	r.invoices[inv.ID] = &iCopy
	r.invByNumber[inv.InvoiceNumber] = &iCopy
	return nil
}

func (r *MemoryERPRepository) GetInvoiceByID(ctx context.Context, id string) (*domain.Invoice, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	inv, ok := r.invoices[id]
	if !ok {
		return nil, ErrInvoiceNotFound
	}
	iCopy := *inv
	return &iCopy, nil
}

func (r *MemoryERPRepository) GetInvoiceByNumber(ctx context.Context, number string) (*domain.Invoice, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	inv, ok := r.invByNumber[number]
	if !ok {
		return nil, ErrInvoiceNotFound
	}
	iCopy := *inv
	return &iCopy, nil
}

func (r *MemoryERPRepository) UpdateInvoice(ctx context.Context, inv *domain.Invoice) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	if _, ok := r.invoices[inv.ID]; !ok {
		return ErrInvoiceNotFound
	}
	inv.UpdatedAt = time.Now().UTC()
	iCopy := *inv
	r.invoices[inv.ID] = &iCopy
	r.invByNumber[inv.InvoiceNumber] = &iCopy
	return nil
}

func (r *MemoryERPRepository) ListInvoices(ctx context.Context, status string, customerID string) ([]domain.Invoice, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	var result []domain.Invoice
	for _, inv := range r.invoices {
		if status != "" && string(inv.Status) != status {
			continue
		}
		if customerID != "" && inv.CustomerID != customerID {
			continue
		}
		result = append(result, *inv)
	}
	return result, nil
}

// ----------------------------------------------------------------------------
// Payments
// ----------------------------------------------------------------------------
func (r *MemoryERPRepository) CreateFinancePayment(ctx context.Context, payment *domain.FinancePayment) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	if payment.ID == "" {
		payment.ID = newUUID()
	}
	now := time.Now().UTC()
	if payment.CreatedAt.IsZero() {
		payment.CreatedAt = now
	}
	payment.UpdatedAt = now

	pCopy := *payment
	r.payments[payment.ID] = &pCopy
	r.paymentByRef[payment.PaymentReference] = &pCopy
	return nil
}

func (r *MemoryERPRepository) GetFinancePaymentByID(ctx context.Context, id string) (*domain.FinancePayment, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	p, ok := r.payments[id]
	if !ok {
		return nil, ErrPaymentNotFound
	}
	pCopy := *p
	return &pCopy, nil
}

func (r *MemoryERPRepository) GetFinancePaymentByReference(ctx context.Context, ref string) (*domain.FinancePayment, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	p, ok := r.paymentByRef[ref]
	if !ok {
		return nil, ErrPaymentNotFound
	}
	pCopy := *p
	return &pCopy, nil
}

func (r *MemoryERPRepository) UpdateFinancePayment(ctx context.Context, payment *domain.FinancePayment) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	if _, ok := r.payments[payment.ID]; !ok {
		return ErrPaymentNotFound
	}
	payment.UpdatedAt = time.Now().UTC()
	pCopy := *payment
	r.payments[payment.ID] = &pCopy
	r.paymentByRef[payment.PaymentReference] = &pCopy
	return nil
}

func (r *MemoryERPRepository) ListFinancePayments(ctx context.Context, status string, customerID string) ([]domain.FinancePayment, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	var result []domain.FinancePayment
	for _, p := range r.payments {
		if status != "" && string(p.Status) != status {
			continue
		}
		if customerID != "" && p.CustomerID != customerID {
			continue
		}
		result = append(result, *p)
	}
	return result, nil
}
