// Package domain contains core enterprise IAM, RBAC, and onboarding entities.
package domain

import "time"

// UserType classifies users into internal company staff or external PAYG solar customers.
type UserType string

const (
	UserTypeStaff    UserType = "STAFF"
	UserTypeCustomer UserType = "CUSTOMER"
)

// UserStatus represents the lifecycle state of a platform account.
type UserStatus string

const (
	UserStatusPendingVerification UserStatus = "PENDING_VERIFICATION"
	UserStatusPendingApproval     UserStatus = "PENDING_APPROVAL"
	UserStatusActive              UserStatus = "ACTIVE"
	UserStatusSuspended           UserStatus = "SUSPENDED"
	UserStatusDeactivated         UserStatus = "DEACTIVATED"
)

// User is the central authentication and authorization identity entity.
type User struct {
	ID              string     `json:"id"`
	Email           string     `json:"email"`
	Phone           string     `json:"phone,omitempty"`
	PasswordHash    string     `json:"-"`
	UserType        UserType   `json:"user_type"`
	Status          UserStatus `json:"status"`
	EmailVerifiedAt *time.Time `json:"email_verified_at,omitempty"`
	PhoneVerifiedAt *time.Time `json:"phone_verified_at,omitempty"`
	MFAEnabled      bool       `json:"mfa_enabled"`
	PreferredMFA    string     `json:"preferred_mfa,omitempty"`
	CreatedAt       time.Time  `json:"created_at"`
	UpdatedAt       time.Time  `json:"updated_at"`
}

// Role defines a collection of permissions representing an enterprise job responsibility.
type Role struct {
	ID           string    `json:"id"`
	Slug         string    `json:"slug"`
	Name         string    `json:"name"`
	Description  string    `json:"description,omitempty"`
	IsSystemRole bool      `json:"is_system_role"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}

// Permission is a granular capability slug guarding backend endpoints and business actions.
type Permission struct {
	ID        string    `json:"id"`
	Slug      string    `json:"slug"`
	Name      string    `json:"name"`
	Module    string    `json:"module"`
	CreatedAt time.Time `json:"created_at"`
}

// 7 Enterprise System Role Slugs
const (
	RoleSuperAdmin        = "super_admin"
	RoleOperationsManager = "operations_manager"
	RoleFieldEngineer     = "field_engineer"
	RoleFinanceOfficer    = "finance_officer"
	RoleCustomerSupport   = "customer_support"
	RoleComplianceAuditor = "compliance_auditor"
	RoleCustomer          = "customer"
)

// 17 Granular Enterprise Permission Slugs
const (
	PermStaffView                = "staff.view"
	PermStaffInvite              = "staff.invite"
	PermStaffApprove             = "staff.approve"
	PermStaffManageRoles         = "staff.manage_roles"
	PermCustomersView            = "customers.view"
	PermCustomersManage          = "customers.manage"
	PermInstallationsCreate      = "installations.create"
	PermInstallationsAssign      = "installations.assign"
	PermInstallationsUpdate      = "installations.update"
	PermMaintenanceCreate        = "maintenance.create"
	PermMaintenanceAssign        = "maintenance.assign"
	PermMaintenanceUpdateStatus  = "maintenance.update_status"
	PermPaymentsView             = "payments.view"
	PermPaymentsVerify           = "payments.verify"
	PermReportsView              = "reports.view"
	PermAuditView                = "audit.view"
	PermSettingsManage           = "settings.manage"
)

// StaffProfile holds internal HR, regional, and engineering accreditation metadata.
type StaffProfile struct {
	UserID         string    `json:"user_id"`
	EmployeeCode   string    `json:"employee_code"`
	Department     string    `json:"department"`
	CorenRegNumber string    `json:"coren_reg_number,omitempty"`
	AssignedRegion string    `json:"assigned_region"`
	CreatedAt      time.Time `json:"created_at"`
	UpdatedAt      time.Time `json:"updated_at"`
}

// OnboardingStatus models the state machine of candidate staff onboarding.
type OnboardingStatus string

const (
	OnboardingStatusAwaitingEmailVerify     OnboardingStatus = "AWAITING_EMAIL_VERIFY"
	OnboardingStatusPendingSuperAdminReview OnboardingStatus = "PENDING_SUPERADMIN_REVIEW"
	OnboardingStatusApprovedInvited         OnboardingStatus = "APPROVED_INVITED"
	OnboardingStatusRejected                OnboardingStatus = "REJECTED"
	OnboardingStatusActivated               OnboardingStatus = "ACTIVATED"
)

// StaffOnboardingRequest represents an applicant moving through the Hybrid Staff Onboarding Pipeline.
type StaffOnboardingRequest struct {
	ID                    string           `json:"id"`
	ApplicantEmail        string           `json:"applicant_email"`
	ApplicantPhone        string           `json:"applicant_phone,omitempty"`
	FullName              string           `json:"full_name"`
	NIN                   string           `json:"nin,omitempty"`
	DateOfBirth           string           `json:"date_of_birth,omitempty"`
	Gender                string           `json:"gender,omitempty"`
	RequestedDepartment   string           `json:"requested_department"`
	CorenRegNumber        string           `json:"coren_reg_number,omitempty"`
	AssignedRegion        string           `json:"assigned_region,omitempty"`
	VerificationTokenHash string           `json:"-"`
	Status                OnboardingStatus `json:"status"`
	AssignedRoleID        *string          `json:"assigned_role_id,omitempty"`
	ReviewedByUserID      *string          `json:"reviewed_by_user_id,omitempty"`
	ReviewNotes           string           `json:"review_notes,omitempty"`
	ActivationTokenHash   string           `json:"-"`
	TokenExpiresAt        *time.Time       `json:"token_expires_at,omitempty"`
	CreatedAt             time.Time        `json:"created_at"`
	UpdatedAt             time.Time        `json:"updated_at"`
}

// Session tracks an authenticated refresh token rotation grant.
type Session struct {
	ID               string     `json:"id"`
	UserID           string     `json:"user_id"`
	RefreshTokenHash string     `json:"-"`
	IPAddress        string     `json:"ip_address,omitempty"`
	UserAgent        string     `json:"user_agent,omitempty"`
	ExpiresAt        time.Time  `json:"expires_at"`
	RevokedAt        *time.Time `json:"revoked_at,omitempty"`
	CreatedAt        time.Time  `json:"created_at"`
	UpdatedAt        time.Time  `json:"updated_at"`
}

// AuditLog tracks privileged administrative, technical, and security operations.
type AuditLog struct {
	ID           string         `json:"id"`
	ActorUserID  *string        `json:"actor_user_id,omitempty"`
	Action       string         `json:"action"`
	ResourceType string         `json:"resource_type"`
	ResourceID   string         `json:"resource_id,omitempty"`
	Payload      map[string]any `json:"payload,omitempty"`
	IPAddress    string         `json:"ip_address,omitempty"`
	CreatedAt    time.Time      `json:"created_at"`
}

// MFAChannel specifies the dispatch medium for 2FA one-time passwords.
type MFAChannel string

const (
	MFAChannelEmailAndSMS MFAChannel = "EMAIL_AND_SMS"
	MFAChannelEmail       MFAChannel = "EMAIL"
	MFAChannelSMS         MFAChannel = "SMS"
)

// MFAChallenge models a transient 2FA verification challenge during login.
type MFAChallenge struct {
	ID             string     `json:"id"`
	UserID         string     `json:"user_id"`
	MFATokenHash   string     `json:"-"`
	CodeHash       string     `json:"-"`
	Channel        MFAChannel `json:"channel"`
	RecipientEmail string     `json:"recipient_email,omitempty"`
	RecipientPhone string     `json:"recipient_phone,omitempty"`
	Attempts       int        `json:"attempts"`
	MaxAttempts    int        `json:"max_attempts"`
	ExpiresAt      time.Time  `json:"expires_at"`
	CreatedAt      time.Time  `json:"created_at"`
}

// PasswordResetToken models a self-service password recovery challenge.
type PasswordResetToken struct {
	ID        string     `json:"id"`
	UserID    string     `json:"user_id"`
	TokenHash string     `json:"-"`
	CodeHash  string     `json:"-"`
	ExpiresAt time.Time  `json:"expires_at"`
	UsedAt    *time.Time `json:"used_at,omitempty"`
	CreatedAt time.Time  `json:"created_at"`
}
