// Package repositories provides data access adapters for IAM, RBAC, and Staff Onboarding.
package repositories

import (
	"context"
	"crypto/rand"
	"errors"
	"fmt"
	"sync"
	"time"

	"github.com/SkyGrid-Flex-Solutions/growatt-payg-enterprise/core-backend/internal/domain"
)

var (
	ErrUserNotFound          = errors.New("user not found")
	ErrUserAlreadyExists     = errors.New("user with this email or phone already exists")
	ErrRoleNotFound          = errors.New("role not found")
	ErrOnboardingNotFound    = errors.New("onboarding request not found")
	ErrSessionNotFound       = errors.New("session not found")
	ErrSessionExpiredOrRevoked = errors.New("session is expired or revoked")
	ErrMFAChallengeNotFound  = errors.New("mfa challenge not found or expired")
	ErrPasswordResetNotFound = errors.New("password reset token not found or expired")
)

// IAMRepository defines the required data access operations for enterprise IAM & RBAC.
type IAMRepository interface {
	// User operations
	CreateUser(ctx context.Context, user *domain.User) error
	GetUserByID(ctx context.Context, id string) (*domain.User, error)
	GetUserByEmail(ctx context.Context, email string) (*domain.User, error)
	GetUserByPhone(ctx context.Context, phone string) (*domain.User, error)
	UpdateUser(ctx context.Context, user *domain.User) error
	UpdateUserPassword(ctx context.Context, userID, newPasswordHash string) error

	// Role & Permission operations
	GetRoleBySlug(ctx context.Context, slug string) (*domain.Role, error)
	GetRoleByID(ctx context.Context, id string) (*domain.Role, error)
	ListRoles(ctx context.Context) ([]domain.Role, error)
	GetRolePermissions(ctx context.Context, roleID string) ([]domain.Permission, error)
	GetUserRoles(ctx context.Context, userID string) ([]domain.Role, error)
	GetUserPermissions(ctx context.Context, userID string) ([]string, error)
	AssignRoleToUser(ctx context.Context, userID, roleID string, assignedByUserID *string) error

	// Staff profile operations
	CreateStaffProfile(ctx context.Context, profile *domain.StaffProfile) error
	GetStaffProfile(ctx context.Context, userID string) (*domain.StaffProfile, error)

	// Staff onboarding pipeline operations
	CreateOnboardingRequest(ctx context.Context, req *domain.StaffOnboardingRequest) error
	GetOnboardingRequestByID(ctx context.Context, id string) (*domain.StaffOnboardingRequest, error)
	GetOnboardingRequestByEmail(ctx context.Context, email string) (*domain.StaffOnboardingRequest, error)
	GetOnboardingRequestByVerifyTokenHash(ctx context.Context, hash string) (*domain.StaffOnboardingRequest, error)
	GetOnboardingRequestByActivationTokenHash(ctx context.Context, hash string) (*domain.StaffOnboardingRequest, error)
	UpdateOnboardingRequest(ctx context.Context, req *domain.StaffOnboardingRequest) error
	ReviewOnboardingTransaction(ctx context.Context, reqID string, status domain.OnboardingStatus, roleID *string, reviewerID string, notes string, actTokenHash string, expiresAt *time.Time, audit *domain.AuditLog) error
	ActivateStaffTransaction(ctx context.Context, reqID string, user *domain.User, profile *domain.StaffProfile, roleID string, audit *domain.AuditLog) error

	// Two-Factor Authentication (MFA) operations
	CreateMFAChallenge(ctx context.Context, challenge *domain.MFAChallenge) error
	GetMFAChallengeByTokenHash(ctx context.Context, hash string) (*domain.MFAChallenge, error)
	UpdateMFAChallenge(ctx context.Context, challenge *domain.MFAChallenge) error
	DeleteMFAChallenge(ctx context.Context, id string) error

	// Password Recovery operations
	CreatePasswordResetToken(ctx context.Context, token *domain.PasswordResetToken) error
	GetPasswordResetByCodeHash(ctx context.Context, userID, codeHash string) (*domain.PasswordResetToken, error)
	GetPasswordResetByTokenHash(ctx context.Context, hash string) (*domain.PasswordResetToken, error)
	MarkPasswordResetUsed(ctx context.Context, id string) error

	// Session & Token rotation operations
	CreateSession(ctx context.Context, session *domain.Session) error
	GetSessionByRefreshHash(ctx context.Context, hash string) (*domain.Session, error)
	RevokeSession(ctx context.Context, id string) error
	RevokeAllUserSessions(ctx context.Context, userID string) error
	RotateSession(ctx context.Context, oldSessionID string, newSession *domain.Session) error

	// Audit logging
	CreateAuditLog(ctx context.Context, log *domain.AuditLog) error
}

// MemoryIAMRepository provides a robust, thread-safe in-memory IAM repository
// pre-seeded with all 7 enterprise roles and 17 granular permissions.
type MemoryIAMRepository struct {
	mu sync.RWMutex

	users               map[string]*domain.User
	usersByEmail        map[string]*domain.User
	usersByPhone        map[string]*domain.User
	roles               map[string]*domain.Role
	rolesBySlug         map[string]*domain.Role
	permissions         map[string]*domain.Permission
	permissionsBySlug   map[string]*domain.Permission
	rolePermissions     map[string][]string // roleID -> []permissionID
	userRoles           map[string][]string // userID -> []roleID
	staffProfiles       map[string]*domain.StaffProfile
	onboardingRequests  map[string]*domain.StaffOnboardingRequest
	onboardingByEmail   map[string]*domain.StaffOnboardingRequest
	onboardingByVerify  map[string]*domain.StaffOnboardingRequest
	onboardingByAct     map[string]*domain.StaffOnboardingRequest
	sessions            map[string]*domain.Session
	sessionsByRefresh   map[string]*domain.Session
	auditLogs           []*domain.AuditLog

	mfaChallenges       map[string]*domain.MFAChallenge     // id -> challenge
	mfaByTokenHash      map[string]*domain.MFAChallenge     // tokenHash -> challenge
	passwordResets      map[string]*domain.PasswordResetToken // id -> token
	passwordResetsByTokenHash map[string]*domain.PasswordResetToken
	passwordResetsByCodeHash  map[string]*domain.PasswordResetToken
}

// NewMemoryIAMRepository constructs and seeds the in-memory enterprise IAM store.
func NewMemoryIAMRepository() *MemoryIAMRepository {
	repo := &MemoryIAMRepository{
		users:                     make(map[string]*domain.User),
		usersByEmail:              make(map[string]*domain.User),
		usersByPhone:              make(map[string]*domain.User),
		roles:                     make(map[string]*domain.Role),
		rolesBySlug:               make(map[string]*domain.Role),
		permissions:               make(map[string]*domain.Permission),
		permissionsBySlug:         make(map[string]*domain.Permission),
		rolePermissions:           make(map[string][]string),
		userRoles:                 make(map[string][]string),
		staffProfiles:             make(map[string]*domain.StaffProfile),
		onboardingRequests:        make(map[string]*domain.StaffOnboardingRequest),
		onboardingByEmail:         make(map[string]*domain.StaffOnboardingRequest),
		onboardingByVerify:        make(map[string]*domain.StaffOnboardingRequest),
		onboardingByAct:           make(map[string]*domain.StaffOnboardingRequest),
		sessions:                  make(map[string]*domain.Session),
		sessionsByRefresh:         make(map[string]*domain.Session),
		auditLogs:                 make([]*domain.AuditLog, 0),
		mfaChallenges:             make(map[string]*domain.MFAChallenge),
		mfaByTokenHash:            make(map[string]*domain.MFAChallenge),
		passwordResets:            make(map[string]*domain.PasswordResetToken),
		passwordResetsByTokenHash: make(map[string]*domain.PasswordResetToken),
		passwordResetsByCodeHash:  make(map[string]*domain.PasswordResetToken),
	}

	repo.seedSystemData()
	return repo
}

func (r *MemoryIAMRepository) seedSystemData() {
	now := time.Now().UTC()

	// 17 Granular Permissions
	perms := []struct {
		slug, name, module string
	}{
		{domain.PermStaffView, "View Staff Directory & Applications", "staff"},
		{domain.PermStaffInvite, "Directly Invite New Staff Members", "staff"},
		{domain.PermStaffApprove, "Review & Approve Staff Onboarding Requests", "staff"},
		{domain.PermStaffManageRoles, "Assign & Revoke Staff Enterprise Roles", "staff"},
		{domain.PermCustomersView, "View Customer Accounts & Credit Telemetry", "customers"},
		{domain.PermCustomersManage, "Modify Customer Metadata & Contract Terms", "customers"},
		{domain.PermInstallationsCreate, "Schedule & Dispatch Solar Installations", "installations"},
		{domain.PermInstallationsAssign, "Assign Field Engineers to Site Installations", "installations"},
		{domain.PermInstallationsUpdate, "Execute Digital Commissioning & Earthing Check", "installations"},
		{domain.PermMaintenanceCreate, "Log Fault Tickets & RMA Hardware Swaps", "maintenance"},
		{domain.PermMaintenanceAssign, "Assign Technicians to Maintenance Tickets", "maintenance"},
		{domain.PermMaintenanceUpdateStatus, "Resolve Maintenance Tasks & Update Shroud State", "maintenance"},
		{domain.PermPaymentsView, "Inspect Inbound Webhooks & Financial Ledgers", "payments"},
		{domain.PermPaymentsVerify, "Verify Bank Transfers & Generate STS Tokens", "payments"},
		{domain.PermReportsView, "Access Financial & Technical Performance Reports", "reports"},
		{domain.PermAuditView, "Inspect Administrative & Security Audit Trail", "audit"},
		{domain.PermSettingsManage, "Configure System Secrets, Tariffs & SLA Limits", "settings"},
	}

	for _, p := range perms {
		perm := &domain.Permission{
			ID:        newUUID(),
			Slug:      p.slug,
			Name:      p.name,
			Module:    p.module,
			CreatedAt: now,
		}
		r.permissions[perm.ID] = perm
		r.permissionsBySlug[perm.Slug] = perm
	}

	// 7 System Enterprise Roles
	roles := []struct {
		slug, name, desc string
		perms            []string
	}{
		{
			slug: domain.RoleSuperAdmin,
			name: "Super Administrator",
			desc: "Full platform control, executive overrides, role administration and auditing.",
			perms: []string{
				domain.PermStaffView, domain.PermStaffInvite, domain.PermStaffApprove, domain.PermStaffManageRoles,
				domain.PermCustomersView, domain.PermCustomersManage,
				domain.PermInstallationsCreate, domain.PermInstallationsAssign, domain.PermInstallationsUpdate,
				domain.PermMaintenanceCreate, domain.PermMaintenanceAssign, domain.PermMaintenanceUpdateStatus,
				domain.PermPaymentsView, domain.PermPaymentsVerify,
				domain.PermReportsView, domain.PermAuditView, domain.PermSettingsManage,
			},
		},
		{
			slug: domain.RoleOperationsManager,
			name: "Operations Manager",
			desc: "Fleet orchestration, installation dispatch, ticket assignment and reporting.",
			perms: []string{
				domain.PermStaffView, domain.PermCustomersView, domain.PermCustomersManage,
				domain.PermInstallationsCreate, domain.PermInstallationsAssign, domain.PermInstallationsUpdate,
				domain.PermMaintenanceCreate, domain.PermMaintenanceAssign, domain.PermMaintenanceUpdateStatus,
				domain.PermPaymentsView, domain.PermReportsView, domain.PermAuditView,
			},
		},
		{
			slug: domain.RoleFieldEngineer,
			name: "Field Engineer",
			desc: "Site audits, physical installations, <5.0 Ohm earthing sign-off and RMA swaps.",
			perms: []string{
				domain.PermInstallationsUpdate, domain.PermMaintenanceCreate, domain.PermMaintenanceUpdateStatus, domain.PermCustomersView,
			},
		},
		{
			slug: domain.RoleFinanceOfficer,
			name: "Finance & Risk Officer",
			desc: "Payment verification, ledger oversight, debt reconciliation and KYC underwriting.",
			perms: []string{
				domain.PermPaymentsView, domain.PermPaymentsVerify, domain.PermReportsView, domain.PermCustomersView, domain.PermAuditView,
			},
		},
		{
			slug: domain.RoleCustomerSupport,
			name: "Customer Support Representative",
			desc: "Customer inquiries, dispute handling, basic ticketing and token lookups.",
			perms: []string{
				domain.PermCustomersView, domain.PermCustomersManage, domain.PermMaintenanceCreate, domain.PermPaymentsView,
			},
		},
		{
			slug: domain.RoleComplianceAuditor,
			name: "Compliance & Quality Auditor",
			desc: "COREN/NEMSA technical audits, safety log inspection and regulatory reporting.",
			perms: []string{
				domain.PermAuditView, domain.PermReportsView, domain.PermInstallationsUpdate, domain.PermStaffView, domain.PermCustomersView,
			},
		},
		{
			slug: domain.RoleCustomer,
			name: "PAYG Solar Customer",
			desc: "Access to personal solar telemetry, virtual accounts, receipts and token keypad.",
			perms: []string{},
		},
		{
			slug: "technician",
			name: "COREN Field Technician",
			desc: "Site audits, physical installations, <5.0 Ohm earthing sign-off and RMA swaps.",
			perms: []string{
				domain.PermInstallationsUpdate, domain.PermMaintenanceCreate, domain.PermMaintenanceUpdateStatus, domain.PermCustomersView,
			},
		},
	}

	for _, rDef := range roles {
		role := &domain.Role{
			ID:           newUUID(),
			Slug:         rDef.slug,
			Name:         rDef.name,
			Description:  rDef.desc,
			IsSystemRole: true,
			CreatedAt:    now,
			UpdatedAt:    now,
		}
		r.roles[role.ID] = role
		r.rolesBySlug[role.Slug] = role

		permIDs := make([]string, 0, len(rDef.perms))
		for _, pSlug := range rDef.perms {
			if p, ok := r.permissionsBySlug[pSlug]; ok {
				permIDs = append(permIDs, p.ID)
			}
		}
		r.rolePermissions[role.ID] = permIDs
	}

	// Pre-seed 5 Developer Test Accounts for Localhost & Testing
	devAccounts := []struct {
		id       string
		email    string
		phone    string
		hash     string
		userType domain.UserType
		roleSlug string
	}{
		{
			id:       "usr-dev-admin-001",
			email:    "admin@skytron.ng",
			phone:    "+2348007598766",
			hash:     "$2b$10$2h5PZOXqx2tzwra80qEiquaZzYUwRZYA0aK1XrS0ZtR7DoKgI7f/q",
			userType: domain.UserTypeStaff,
			roleSlug: domain.RoleSuperAdmin,
		},
		{
			id:       "usr-dev-ops-001",
			email:    "ops@skytron.ng",
			phone:    "+2348011234567",
			hash:     "$2b$10$y/gLZFD10GufZLURfmNC2uZIpBw.axxV3RprZTMFDjSEZYt1OWMLW",
			userType: domain.UserTypeStaff,
			roleSlug: domain.RoleOperationsManager,
		},
		{
			id:       "usr-dev-finance-001",
			email:    "finance@skytron.ng",
			phone:    "+2348022345678",
			hash:     "$2b$10$hoa2MI3PEE6YSdacbArgmOHZ88VjiHCPYtZuimFuYuuOfDuY1xLKm",
			userType: domain.UserTypeStaff,
			roleSlug: domain.RoleFinanceOfficer,
		},
		{
			id:       "usr-dev-tech-001",
			email:    "tech@skytron.ng",
			phone:    "+2348033456789",
			hash:     "$2b$10$2Xq53fz/doAzoqOO6.Qc5ugwvHIbxkLq3kwyPLKpW.kUPq8lLIBs.",
			userType: domain.UserTypeStaff,
			roleSlug: domain.RoleFieldEngineer,
		},
		{
			id:       "usr-dev-cust-001",
			email:    "customer@skytron.ng",
			phone:    "+2348044567890",
			hash:     "$2b$10$wglltUTxkZZuV3EH7.TzBO4gPbaRIK7Lp1U0i5jZW.AKyhrjHi8bm",
			userType: domain.UserTypeCustomer,
			roleSlug: domain.RoleCustomer,
		},
	}

	for _, acc := range devAccounts {
		u := &domain.User{
			ID:              acc.id,
			Email:           acc.email,
			Phone:           acc.phone,
			PasswordHash:    acc.hash,
			UserType:        acc.userType,
			Status:          domain.UserStatusActive,
			EmailVerifiedAt: &now,
			PhoneVerifiedAt: &now,
			MFAEnabled:      true,
			PreferredMFA:    string(domain.MFAChannelEmailAndSMS),
			CreatedAt:       now,
			UpdatedAt:       now,
		}
		r.users[u.ID] = u
		r.usersByEmail[u.Email] = u
		if u.Phone != "" {
			r.usersByPhone[u.Phone] = u
		}

		var roleIDs []string
		if role, ok := r.rolesBySlug[acc.roleSlug]; ok {
			roleIDs = append(roleIDs, role.ID)
		}
		// Also assign "technician" alias if field engineer
		if acc.roleSlug == domain.RoleFieldEngineer {
			if techRole, ok := r.rolesBySlug["technician"]; ok {
				roleIDs = append(roleIDs, techRole.ID)
			}
		}
		r.userRoles[u.ID] = roleIDs
	}

	r.staffProfiles["usr-dev-admin-001"] = &domain.StaffProfile{
		UserID:         "usr-dev-admin-001",
		EmployeeCode:   "EMP-2026-ADM01",
		Department:     "Executive Command",
		AssignedRegion: "Abuja FCT",
		CreatedAt:      now,
		UpdatedAt:      now,
	}
	r.staffProfiles["usr-dev-ops-001"] = &domain.StaffProfile{
		UserID:         "usr-dev-ops-001",
		EmployeeCode:   "EMP-2026-OPS01",
		Department:     "Fleet Operations",
		AssignedRegion: "National",
		CreatedAt:      now,
		UpdatedAt:      now,
	}
	r.staffProfiles["usr-dev-finance-001"] = &domain.StaffProfile{
		UserID:         "usr-dev-finance-001",
		EmployeeCode:   "EMP-2026-FIN01",
		Department:     "Finance & Risk",
		AssignedRegion: "National",
		CreatedAt:      now,
		UpdatedAt:      now,
	}
	r.staffProfiles["usr-dev-tech-001"] = &domain.StaffProfile{
		UserID:         "usr-dev-tech-001",
		EmployeeCode:   "EMP-2026-TCH01",
		Department:     "Field Engineering",
		CorenRegNumber: "COREN/R.54921/ENG",
		AssignedRegion: "North-Central",
		CreatedAt:      now,
		UpdatedAt:      now,
	}
}

// User methods
func (r *MemoryIAMRepository) CreateUser(ctx context.Context, user *domain.User) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	if _, exists := r.usersByEmail[user.Email]; exists {
		return ErrUserAlreadyExists
	}
	if user.Phone != "" {
		if _, exists := r.usersByPhone[user.Phone]; exists {
			return ErrUserAlreadyExists
		}
	}
	if user.ID == "" {
		user.ID = newUUID()
	}
	if user.CreatedAt.IsZero() {
		user.CreatedAt = time.Now().UTC()
	}
	user.UpdatedAt = user.CreatedAt

	uCopy := *user
	r.users[user.ID] = &uCopy
	r.usersByEmail[user.Email] = &uCopy
	if user.Phone != "" {
		r.usersByPhone[user.Phone] = &uCopy
	}
	return nil
}

func (r *MemoryIAMRepository) GetUserByID(ctx context.Context, id string) (*domain.User, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	u, ok := r.users[id]
	if !ok {
		return nil, ErrUserNotFound
	}
	uCopy := *u
	return &uCopy, nil
}

func (r *MemoryIAMRepository) GetUserByEmail(ctx context.Context, email string) (*domain.User, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	u, ok := r.usersByEmail[email]
	if !ok {
		return nil, ErrUserNotFound
	}
	uCopy := *u
	return &uCopy, nil
}

func (r *MemoryIAMRepository) GetUserByPhone(ctx context.Context, phone string) (*domain.User, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	u, ok := r.usersByPhone[phone]
	if !ok {
		return nil, ErrUserNotFound
	}
	uCopy := *u
	return &uCopy, nil
}

func (r *MemoryIAMRepository) UpdateUserPassword(ctx context.Context, userID, newPasswordHash string) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	u, ok := r.users[userID]
	if !ok {
		return ErrUserNotFound
	}
	u.PasswordHash = newPasswordHash
	u.UpdatedAt = time.Now().UTC()
	return nil
}

func (r *MemoryIAMRepository) UpdateUser(ctx context.Context, user *domain.User) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	existing, ok := r.users[user.ID]
	if !ok {
		return ErrUserNotFound
	}

	user.UpdatedAt = time.Now().UTC()
	uCopy := *user
	r.users[user.ID] = &uCopy
	if existing.Email != user.Email {
		delete(r.usersByEmail, existing.Email)
	}
	r.usersByEmail[user.Email] = &uCopy
	return nil
}

// Role & Permission methods
func (r *MemoryIAMRepository) GetRoleBySlug(ctx context.Context, slug string) (*domain.Role, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	role, ok := r.rolesBySlug[slug]
	if !ok {
		return nil, ErrRoleNotFound
	}
	rCopy := *role
	return &rCopy, nil
}

func (r *MemoryIAMRepository) GetRoleByID(ctx context.Context, id string) (*domain.Role, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	role, ok := r.roles[id]
	if !ok {
		return nil, ErrRoleNotFound
	}
	rCopy := *role
	return &rCopy, nil
}

func (r *MemoryIAMRepository) ListRoles(ctx context.Context) ([]domain.Role, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	list := make([]domain.Role, 0, len(r.roles))
	for _, role := range r.roles {
		list = append(list, *role)
	}
	return list, nil
}

func (r *MemoryIAMRepository) GetRolePermissions(ctx context.Context, roleID string) ([]domain.Permission, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	permIDs, ok := r.rolePermissions[roleID]
	if !ok {
		return []domain.Permission{}, nil
	}

	result := make([]domain.Permission, 0, len(permIDs))
	for _, pid := range permIDs {
		if perm, found := r.permissions[pid]; found {
			result = append(result, *perm)
		}
	}
	return result, nil
}

func (r *MemoryIAMRepository) GetUserRoles(ctx context.Context, userID string) ([]domain.Role, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	roleIDs, ok := r.userRoles[userID]
	if !ok {
		return []domain.Role{}, nil
	}

	result := make([]domain.Role, 0, len(roleIDs))
	for _, rid := range roleIDs {
		if role, found := r.roles[rid]; found {
			result = append(result, *role)
		}
	}
	return result, nil
}

func (r *MemoryIAMRepository) GetUserPermissions(ctx context.Context, userID string) ([]string, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	roleIDs, ok := r.userRoles[userID]
	if !ok {
		return []string{}, nil
	}

	permSet := make(map[string]struct{})
	for _, rid := range roleIDs {
		if permIDs, found := r.rolePermissions[rid]; found {
			for _, pid := range permIDs {
				if perm, pFound := r.permissions[pid]; pFound {
					permSet[perm.Slug] = struct{}{}
				}
			}
		}
	}

	slugs := make([]string, 0, len(permSet))
	for s := range permSet {
		slugs = append(slugs, s)
	}
	return slugs, nil
}

func (r *MemoryIAMRepository) AssignRoleToUser(ctx context.Context, userID, roleID string, assignedByUserID *string) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	if _, ok := r.users[userID]; !ok {
		return ErrUserNotFound
	}
	if _, ok := r.roles[roleID]; !ok {
		return ErrRoleNotFound
	}

	current := r.userRoles[userID]
	for _, rid := range current {
		if rid == roleID {
			return nil // already assigned
		}
	}
	r.userRoles[userID] = append(current, roleID)
	return nil
}

// StaffProfile methods
func (r *MemoryIAMRepository) CreateStaffProfile(ctx context.Context, profile *domain.StaffProfile) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	if profile.CreatedAt.IsZero() {
		profile.CreatedAt = time.Now().UTC()
	}
	profile.UpdatedAt = profile.CreatedAt

	pCopy := *profile
	r.staffProfiles[profile.UserID] = &pCopy
	return nil
}

func (r *MemoryIAMRepository) GetStaffProfile(ctx context.Context, userID string) (*domain.StaffProfile, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	p, ok := r.staffProfiles[userID]
	if !ok {
		return nil, errors.New("staff profile not found")
	}
	pCopy := *p
	return &pCopy, nil
}

// Onboarding methods
func (r *MemoryIAMRepository) CreateOnboardingRequest(ctx context.Context, req *domain.StaffOnboardingRequest) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	if _, exists := r.onboardingByEmail[req.ApplicantEmail]; exists {
		return errors.New("an onboarding request already exists for this email")
	}
	if req.ID == "" {
		req.ID = newUUID()
	}
	if req.CreatedAt.IsZero() {
		req.CreatedAt = time.Now().UTC()
	}
	req.UpdatedAt = req.CreatedAt

	rCopy := *req
	r.onboardingRequests[req.ID] = &rCopy
	r.onboardingByEmail[req.ApplicantEmail] = &rCopy
	if req.VerificationTokenHash != "" {
		r.onboardingByVerify[req.VerificationTokenHash] = &rCopy
	}
	if req.ActivationTokenHash != "" {
		r.onboardingByAct[req.ActivationTokenHash] = &rCopy
	}
	return nil
}

func (r *MemoryIAMRepository) GetOnboardingRequestByID(ctx context.Context, id string) (*domain.StaffOnboardingRequest, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	req, ok := r.onboardingRequests[id]
	if !ok {
		return nil, ErrOnboardingNotFound
	}
	rCopy := *req
	return &rCopy, nil
}

func (r *MemoryIAMRepository) GetOnboardingRequestByEmail(ctx context.Context, email string) (*domain.StaffOnboardingRequest, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	req, ok := r.onboardingByEmail[email]
	if !ok {
		return nil, ErrOnboardingNotFound
	}
	rCopy := *req
	return &rCopy, nil
}

func (r *MemoryIAMRepository) GetOnboardingRequestByVerifyTokenHash(ctx context.Context, hash string) (*domain.StaffOnboardingRequest, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	req, ok := r.onboardingByVerify[hash]
	if !ok {
		return nil, ErrOnboardingNotFound
	}
	rCopy := *req
	return &rCopy, nil
}

func (r *MemoryIAMRepository) GetOnboardingRequestByActivationTokenHash(ctx context.Context, hash string) (*domain.StaffOnboardingRequest, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	req, ok := r.onboardingByAct[hash]
	if !ok {
		return nil, ErrOnboardingNotFound
	}
	rCopy := *req
	return &rCopy, nil
}

func (r *MemoryIAMRepository) UpdateOnboardingRequest(ctx context.Context, req *domain.StaffOnboardingRequest) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	existing, ok := r.onboardingRequests[req.ID]
	if !ok {
		return ErrOnboardingNotFound
	}

	// Clean up old token indexes if changed
	if existing.VerificationTokenHash != req.VerificationTokenHash && existing.VerificationTokenHash != "" {
		delete(r.onboardingByVerify, existing.VerificationTokenHash)
	}
	if existing.ActivationTokenHash != req.ActivationTokenHash && existing.ActivationTokenHash != "" {
		delete(r.onboardingByAct, existing.ActivationTokenHash)
	}

	req.UpdatedAt = time.Now().UTC()
	rCopy := *req
	r.onboardingRequests[req.ID] = &rCopy
	r.onboardingByEmail[req.ApplicantEmail] = &rCopy
	if req.VerificationTokenHash != "" {
		r.onboardingByVerify[req.VerificationTokenHash] = &rCopy
	}
	if req.ActivationTokenHash != "" {
		r.onboardingByAct[req.ActivationTokenHash] = &rCopy
	}
	return nil
}

// ReviewOnboardingTransaction performs atomic state transition and audit logging for admin review.
func (r *MemoryIAMRepository) ReviewOnboardingTransaction(
	ctx context.Context,
	reqID string,
	status domain.OnboardingStatus,
	roleID *string,
	reviewerID string,
	notes string,
	actTokenHash string,
	expiresAt *time.Time,
	audit *domain.AuditLog,
) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	req, ok := r.onboardingRequests[reqID]
	if !ok {
		return ErrOnboardingNotFound
	}

	// Clean up old activation hash index if replacing
	if req.ActivationTokenHash != "" && req.ActivationTokenHash != actTokenHash {
		delete(r.onboardingByAct, req.ActivationTokenHash)
	}

	req.Status = status
	req.AssignedRoleID = roleID
	req.ReviewedByUserID = &reviewerID
	req.ReviewNotes = notes
	req.ActivationTokenHash = actTokenHash
	req.TokenExpiresAt = expiresAt
	req.UpdatedAt = time.Now().UTC()

	rCopy := *req
	r.onboardingRequests[req.ID] = &rCopy
	r.onboardingByEmail[req.ApplicantEmail] = &rCopy
	if actTokenHash != "" {
		r.onboardingByAct[actTokenHash] = &rCopy
	}

	if audit != nil {
		if audit.ID == "" {
			audit.ID = newUUID()
		}
		if audit.CreatedAt.IsZero() {
			audit.CreatedAt = time.Now().UTC()
		}
		aCopy := *audit
		r.auditLogs = append(r.auditLogs, &aCopy)
	}

	return nil
}

// ActivateStaffTransaction atomically creates the user, profile, assigns role, updates request, and writes audit log.
func (r *MemoryIAMRepository) ActivateStaffTransaction(
	ctx context.Context,
	reqID string,
	user *domain.User,
	profile *domain.StaffProfile,
	roleID string,
	audit *domain.AuditLog,
) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	req, ok := r.onboardingRequests[reqID]
	if !ok {
		return ErrOnboardingNotFound
	}

	// Check user uniqueness
	if _, exists := r.usersByEmail[user.Email]; exists {
		return ErrUserAlreadyExists
	}

	now := time.Now().UTC()
	if user.ID == "" {
		user.ID = newUUID()
	}
	user.CreatedAt = now
	user.UpdatedAt = now
	user.Status = domain.UserStatusActive
	user.EmailVerifiedAt = &now

	profile.UserID = user.ID
	profile.CreatedAt = now
	profile.UpdatedAt = now

	// Write user & profile
	uCopy := *user
	r.users[user.ID] = &uCopy
	r.usersByEmail[user.Email] = &uCopy

	pCopy := *profile
	r.staffProfiles[user.ID] = &pCopy

	// Assign role
	r.userRoles[user.ID] = []string{roleID}

	// Mark request activated and clear token
	if req.ActivationTokenHash != "" {
		delete(r.onboardingByAct, req.ActivationTokenHash)
	}
	req.Status = domain.OnboardingStatusActivated
	req.ActivationTokenHash = ""
	req.UpdatedAt = now
	rCopy := *req
	r.onboardingRequests[req.ID] = &rCopy
	r.onboardingByEmail[req.ApplicantEmail] = &rCopy

	if audit != nil {
		if audit.ID == "" {
			audit.ID = newUUID()
		}
		if audit.CreatedAt.IsZero() {
			audit.CreatedAt = now
		}
		aCopy := *audit
		r.auditLogs = append(r.auditLogs, &aCopy)
	}

	return nil
}

// Session methods
func (r *MemoryIAMRepository) CreateSession(ctx context.Context, session *domain.Session) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	if session.ID == "" {
		session.ID = newUUID()
	}
	if session.CreatedAt.IsZero() {
		session.CreatedAt = time.Now().UTC()
	}
	session.UpdatedAt = session.CreatedAt

	sCopy := *session
	r.sessions[session.ID] = &sCopy
	r.sessionsByRefresh[session.RefreshTokenHash] = &sCopy
	return nil
}

func (r *MemoryIAMRepository) GetSessionByRefreshHash(ctx context.Context, hash string) (*domain.Session, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	s, ok := r.sessionsByRefresh[hash]
	if !ok {
		return nil, ErrSessionNotFound
	}
	if s.RevokedAt != nil || time.Now().UTC().After(s.ExpiresAt) {
		return nil, ErrSessionExpiredOrRevoked
	}
	sCopy := *s
	return &sCopy, nil
}

func (r *MemoryIAMRepository) RevokeSession(ctx context.Context, id string) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	s, ok := r.sessions[id]
	if !ok {
		return ErrSessionNotFound
	}
	now := time.Now().UTC()
	s.RevokedAt = &now
	s.UpdatedAt = now
	return nil
}

func (r *MemoryIAMRepository) RotateSession(ctx context.Context, oldSessionID string, newSession *domain.Session) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	now := time.Now().UTC()
	if old, ok := r.sessions[oldSessionID]; ok {
		old.RevokedAt = &now
		old.UpdatedAt = now
		delete(r.sessionsByRefresh, old.RefreshTokenHash)
	}

	if newSession.ID == "" {
		newSession.ID = newUUID()
	}
	newSession.CreatedAt = now
	newSession.UpdatedAt = now

	sCopy := *newSession
	r.sessions[newSession.ID] = &sCopy
	r.sessionsByRefresh[newSession.RefreshTokenHash] = &sCopy
	return nil
}

func (r *MemoryIAMRepository) RevokeAllUserSessions(ctx context.Context, userID string) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	now := time.Now().UTC()
	for _, s := range r.sessions {
		if s.UserID == userID {
			s.RevokedAt = &now
			s.UpdatedAt = now
			delete(r.sessionsByRefresh, s.RefreshTokenHash)
		}
	}
	return nil
}

// MFA methods
func (r *MemoryIAMRepository) CreateMFAChallenge(ctx context.Context, challenge *domain.MFAChallenge) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	if challenge.ID == "" {
		challenge.ID = newUUID()
	}
	if challenge.CreatedAt.IsZero() {
		challenge.CreatedAt = time.Now().UTC()
	}
	cCopy := *challenge
	r.mfaChallenges[challenge.ID] = &cCopy
	r.mfaByTokenHash[challenge.MFATokenHash] = &cCopy
	return nil
}

func (r *MemoryIAMRepository) GetMFAChallengeByTokenHash(ctx context.Context, hash string) (*domain.MFAChallenge, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	c, ok := r.mfaByTokenHash[hash]
	if !ok {
		return nil, ErrMFAChallengeNotFound
	}
	if time.Now().UTC().After(c.ExpiresAt) {
		return nil, ErrMFAChallengeNotFound
	}
	cCopy := *c
	return &cCopy, nil
}

func (r *MemoryIAMRepository) UpdateMFAChallenge(ctx context.Context, challenge *domain.MFAChallenge) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	cCopy := *challenge
	r.mfaChallenges[challenge.ID] = &cCopy
	r.mfaByTokenHash[challenge.MFATokenHash] = &cCopy
	return nil
}

func (r *MemoryIAMRepository) DeleteMFAChallenge(ctx context.Context, id string) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	if c, ok := r.mfaChallenges[id]; ok {
		delete(r.mfaByTokenHash, c.MFATokenHash)
		delete(r.mfaChallenges, id)
	}
	return nil
}

// Password Reset methods
func (r *MemoryIAMRepository) CreatePasswordResetToken(ctx context.Context, token *domain.PasswordResetToken) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	if token.ID == "" {
		token.ID = newUUID()
	}
	if token.CreatedAt.IsZero() {
		token.CreatedAt = time.Now().UTC()
	}
	tCopy := *token
	r.passwordResets[token.ID] = &tCopy
	r.passwordResetsByTokenHash[token.TokenHash] = &tCopy
	r.passwordResetsByCodeHash[token.CodeHash] = &tCopy
	return nil
}

func (r *MemoryIAMRepository) GetPasswordResetByCodeHash(ctx context.Context, userID, codeHash string) (*domain.PasswordResetToken, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	t, ok := r.passwordResetsByCodeHash[codeHash]
	if !ok || (userID != "" && t.UserID != userID) {
		return nil, ErrPasswordResetNotFound
	}
	if t.UsedAt != nil || time.Now().UTC().After(t.ExpiresAt) {
		return nil, ErrPasswordResetNotFound
	}
	tCopy := *t
	return &tCopy, nil
}

func (r *MemoryIAMRepository) GetPasswordResetByTokenHash(ctx context.Context, hash string) (*domain.PasswordResetToken, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	t, ok := r.passwordResetsByTokenHash[hash]
	if !ok {
		return nil, ErrPasswordResetNotFound
	}
	if t.UsedAt != nil || time.Now().UTC().After(t.ExpiresAt) {
		return nil, ErrPasswordResetNotFound
	}
	tCopy := *t
	return &tCopy, nil
}

func (r *MemoryIAMRepository) MarkPasswordResetUsed(ctx context.Context, id string) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	t, ok := r.passwordResets[id]
	if !ok {
		return ErrPasswordResetNotFound
	}
	now := time.Now().UTC()
	t.UsedAt = &now
	return nil
}

// AuditLog methods
func (r *MemoryIAMRepository) CreateAuditLog(ctx context.Context, log *domain.AuditLog) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	if log.ID == "" {
		log.ID = newUUID()
	}
	if log.CreatedAt.IsZero() {
		log.CreatedAt = time.Now().UTC()
	}
	lCopy := *log
	r.auditLogs = append(r.auditLogs, &lCopy)
	return nil
}

// newUUID generates a cryptographically secure RFC 4122 v4 UUID string.
func newUUID() string {
	var buf [16]byte
	_, _ = rand.Read(buf[:])
	buf[6] = (buf[6] & 0x0f) | 0x40 // Version 4
	buf[8] = (buf[8] & 0x3f) | 0x80 // Variant 10
	return fmt.Sprintf("%08x-%04x-%04x-%04x-%012x",
		buf[0:4], buf[4:6], buf[6:8], buf[8:10], buf[10:16])
}
