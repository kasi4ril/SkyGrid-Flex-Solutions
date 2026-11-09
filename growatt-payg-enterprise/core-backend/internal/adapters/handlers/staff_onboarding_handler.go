// Package handlers provides HTTP transport adapters, routing, and security middleware.
package handlers

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/SkyGrid-Flex-Solutions/growatt-payg-enterprise/core-backend/internal/adapters/repositories"
	"github.com/SkyGrid-Flex-Solutions/growatt-payg-enterprise/core-backend/internal/domain"
	"github.com/SkyGrid-Flex-Solutions/growatt-payg-enterprise/core-backend/internal/usecases"
)

// StaffOnboardingHandler exposes endpoints for the Hybrid Staff Onboarding Pipeline and Auth Lifecycle.
type StaffOnboardingHandler struct {
	repo        repositories.IAMRepository
	authService *usecases.AuthService
}

// NewStaffOnboardingHandler constructs the onboarding and IAM HTTP handler.
func NewStaffOnboardingHandler(
	repo repositories.IAMRepository,
	authService *usecases.AuthService,
) *StaffOnboardingHandler {
	return &StaffOnboardingHandler{
		repo:        repo,
		authService: authService,
	}
}

// ----------------------------------------------------------------------------
// Request & Response DTOs
// ----------------------------------------------------------------------------

type StaffApplyRequest struct {
	ApplicantEmail      string `json:"applicant_email"`
	ApplicantPhone      string `json:"applicant_phone"`
	FullName            string `json:"full_name"`
	NIN                 string `json:"nin,omitempty"`
	DateOfBirth         string `json:"date_of_birth,omitempty"`
	Gender              string `json:"gender,omitempty"`
	RequestedDepartment string `json:"requested_department"`
	CorenRegNumber      string `json:"coren_reg_number,omitempty"`
	AssignedRegion      string `json:"assigned_region,omitempty"`
}

type StaffVerifyEmailRequest struct {
	Email             string `json:"email"`
	VerificationToken string `json:"verification_token"`
}

type StaffReviewRequest struct {
	RequestID          string `json:"request_id"`
	Decision           string `json:"decision"` // APPROVE, REJECT
	AssignedRoleSlug   string `json:"assigned_role_slug,omitempty"`
	AssignedDepartment string `json:"assigned_department,omitempty"`
	AssignedRegion     string `json:"assigned_region,omitempty"`
	ReviewNotes        string `json:"review_notes,omitempty"`
}

type StaffInviteRequest struct {
	Email          string `json:"email"`
	Phone          string `json:"phone,omitempty"`
	FullName       string `json:"full_name"`
	Department     string `json:"department"`
	RoleSlug       string `json:"role_slug"`
	CorenRegNumber string `json:"coren_reg_number,omitempty"`
	AssignedRegion string `json:"assigned_region"`
}

type StaffActivateRequest struct {
	Email           string `json:"email"`
	ActivationToken string `json:"activation_token"`
	Password        string `json:"password"`
}

type LoginRequest struct {
	Identifier string `json:"identifier"`
	Email      string `json:"email"`
	Phone      string `json:"phone"`
	Password   string `json:"password"`
}

type VerifyMFARequest struct {
	MFAToken string `json:"mfa_token"`
	Code     string `json:"code"`
}

type ResendMFARequest struct {
	MFAToken string `json:"mfa_token"`
	Channel  string `json:"channel"`
}

type ForgotPasswordRequest struct {
	Identifier string `json:"identifier"`
	Email      string `json:"email"`
	Phone      string `json:"phone"`
}

type ResetPasswordRequest struct {
	Identifier   string `json:"identifier"`
	Email        string `json:"email"`
	Phone        string `json:"phone"`
	Code         string `json:"code"`
	RecoveryCode string `json:"recovery_code"`
	ResetToken   string `json:"reset_token"`
	NewPassword  string `json:"new_password"`
}

type ChangePasswordRequest struct {
	UserID          string `json:"user_id"`
	Identifier      string `json:"identifier"`
	Email           string `json:"email"`
	CurrentPassword string `json:"current_password"`
	NewPassword     string `json:"new_password"`
}

type RefreshRequest struct {
	RefreshToken string `json:"refresh_token"`
}

// ----------------------------------------------------------------------------
// 1. POST /api/v1/auth/staff/apply (Public Candidate Application)
// ----------------------------------------------------------------------------
func (h *StaffOnboardingHandler) HandleApply(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSONError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}

	var req StaffApplyRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSONError(w, http.StatusBadRequest, "invalid request payload: "+err.Error())
		return
	}

	email := strings.TrimSpace(strings.ToLower(req.ApplicantEmail))
	if email == "" || !strings.Contains(email, "@") {
		writeJSONError(w, http.StatusBadRequest, "a valid applicant email is required")
		return
	}
	if strings.TrimSpace(req.FullName) == "" {
		writeJSONError(w, http.StatusBadRequest, "full_name is required")
		return
	}
	if strings.TrimSpace(req.RequestedDepartment) == "" {
		writeJSONError(w, http.StatusBadRequest, "requested_department is required")
		return
	}

	// Verify not already registered
	if _, err := h.repo.GetUserByEmail(r.Context(), email); err == nil {
		writeJSONError(w, http.StatusConflict, "a user account with this email already exists")
		return
	}

	// Generate single-use verification token (32 bytes hex)
	rawToken := newRandomToken(32)
	tokenHash := h.authService.HashToken(rawToken)
	expiresAt := time.Now().UTC().Add(24 * time.Hour)

	onboardingReq := &domain.StaffOnboardingRequest{
		ApplicantEmail:        email,
		ApplicantPhone:        strings.TrimSpace(req.ApplicantPhone),
		FullName:              strings.TrimSpace(req.FullName),
		NIN:                   strings.TrimSpace(req.NIN),
		DateOfBirth:           strings.TrimSpace(req.DateOfBirth),
		Gender:                strings.TrimSpace(req.Gender),
		RequestedDepartment:   strings.TrimSpace(req.RequestedDepartment),
		CorenRegNumber:        strings.TrimSpace(req.CorenRegNumber),
		AssignedRegion:        strings.TrimSpace(req.AssignedRegion),
		VerificationTokenHash: tokenHash,
		Status:                domain.OnboardingStatusAwaitingEmailVerify,
		TokenExpiresAt:        &expiresAt,
	}

	if err := h.repo.CreateOnboardingRequest(r.Context(), onboardingReq); err != nil {
		writeJSONError(w, http.StatusConflict, err.Error())
		return
	}

	log.Printf("[ONBOARDING] New Staff Application Submitted: %s (%s) - Dept: %s",
		onboardingReq.FullName, onboardingReq.ApplicantEmail, onboardingReq.RequestedDepartment)

	writeJSONResponse(w, http.StatusCreated, map[string]any{
		"status":                 "success",
		"message":                "staff application submitted successfully; verification email dispatched",
		"request_id":             onboardingReq.ID,
		"applicant_email":        onboardingReq.ApplicantEmail,
		"onboarding_status":      onboardingReq.Status,
		"verification_token_dev": rawToken, // Provided for instant automated testing & headless verification
		"expires_at":             expiresAt,
	})
}

// ----------------------------------------------------------------------------
// 2. POST /api/v1/auth/staff/verify-email (Token Verification)
// ----------------------------------------------------------------------------
func (h *StaffOnboardingHandler) HandleVerifyEmail(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSONError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}

	var req StaffVerifyEmailRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSONError(w, http.StatusBadRequest, "invalid request payload: "+err.Error())
		return
	}

	email := strings.TrimSpace(strings.ToLower(req.Email))
	token := strings.TrimSpace(req.VerificationToken)
	if email == "" || token == "" {
		writeJSONError(w, http.StatusBadRequest, "both email and verification_token are required")
		return
	}

	tokenHash := h.authService.HashToken(token)
	onboardingReq, err := h.repo.GetOnboardingRequestByVerifyTokenHash(r.Context(), tokenHash)
	if err != nil || onboardingReq.ApplicantEmail != email {
		writeJSONError(w, http.StatusBadRequest, "invalid or expired email verification token")
		return
	}

	if onboardingReq.Status != domain.OnboardingStatusAwaitingEmailVerify {
		writeJSONError(w, http.StatusBadRequest, "application is not awaiting email verification (status: "+string(onboardingReq.Status)+")")
		return
	}

	if onboardingReq.TokenExpiresAt != nil && time.Now().UTC().After(*onboardingReq.TokenExpiresAt) {
		writeJSONError(w, http.StatusBadRequest, "email verification token has expired; please re-apply")
		return
	}

	// Move status to PENDING_SUPERADMIN_REVIEW and invalidate token
	onboardingReq.Status = domain.OnboardingStatusPendingSuperAdminReview
	onboardingReq.VerificationTokenHash = ""
	onboardingReq.TokenExpiresAt = nil

	if err := h.repo.UpdateOnboardingRequest(r.Context(), onboardingReq); err != nil {
		writeJSONError(w, http.StatusInternalServerError, "failed to update application status: "+err.Error())
		return
	}

	log.Printf("[ONBOARDING] Staff Email Verified: %s -> Advanced to PENDING_SUPERADMIN_REVIEW", onboardingReq.ApplicantEmail)

	writeJSONResponse(w, http.StatusOK, map[string]any{
		"status":            "success",
		"message":           "email verified successfully; application is now queued for Super Admin review",
		"request_id":        onboardingReq.ID,
		"applicant_email":   onboardingReq.ApplicantEmail,
		"onboarding_status": onboardingReq.Status,
	})
}

// ----------------------------------------------------------------------------
// 3. POST /api/v1/admin/staff/review (RequirePermission: staff.approve)
// ----------------------------------------------------------------------------
func (h *StaffOnboardingHandler) HandleReview(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSONError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}

	claims, ok := GetClaims(r.Context())
	if !ok {
		writeJSONError(w, http.StatusUnauthorized, "unauthorized: missing claims")
		return
	}

	var req StaffReviewRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSONError(w, http.StatusBadRequest, "invalid request payload: "+err.Error())
		return
	}

	reqID := strings.TrimSpace(req.RequestID)
	decision := strings.ToUpper(strings.TrimSpace(req.Decision))
	if reqID == "" || (decision != "APPROVE" && decision != "REJECT") {
		writeJSONError(w, http.StatusBadRequest, "valid request_id and decision ('APPROVE' or 'REJECT') are required")
		return
	}

	onboardingReq, err := h.repo.GetOnboardingRequestByID(r.Context(), reqID)
	if err != nil {
		writeJSONError(w, http.StatusNotFound, "onboarding request not found")
		return
	}

	if onboardingReq.Status != domain.OnboardingStatusPendingSuperAdminReview {
		writeJSONError(w, http.StatusBadRequest, fmt.Sprintf("cannot review request in status '%s'; must be 'PENDING_SUPERADMIN_REVIEW'", onboardingReq.Status))
		return
	}

	// =========================================================================
	// MANDATORY SECURITY GATE: PREVENT SELF-ROLE ASSIGNMENT / PRIVILEGE ESCALATION
	// A reviewer CANNOT approve or assign roles to their own email address.
	// =========================================================================
	if strings.EqualFold(onboardingReq.ApplicantEmail, claims.Email) {
		log.Printf("[SECURITY_VIOLATION] Self-Role Assignment Blocked: User %s (%s) attempted to approve own onboarding request %s",
			claims.UserID, claims.Email, reqID)
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusForbidden)
		_ = json.NewEncoder(w).Encode(map[string]any{
			"status":     "error",
			"error_code": "SELF_APPROVAL_PROHIBITED",
			"message":    "forbidden: self-role assignment and self-onboarding approval is strictly prohibited",
		})
		return
	}

	if decision == "REJECT" {
		audit := &domain.AuditLog{
			ActorUserID:  &claims.UserID,
			Action:       "STAFF_ONBOARDING_REJECTED",
			ResourceType: "staff_onboarding_request",
			ResourceID:   reqID,
			Payload: map[string]any{
				"applicant_email": onboardingReq.ApplicantEmail,
				"review_notes":    req.ReviewNotes,
			},
			IPAddress: r.RemoteAddr,
		}

		if err := h.repo.ReviewOnboardingTransaction(r.Context(), reqID, domain.OnboardingStatusRejected, nil, claims.UserID, req.ReviewNotes, "", nil, audit); err != nil {
			writeJSONError(w, http.StatusInternalServerError, "failed to record rejection: "+err.Error())
			return
		}

		writeJSONResponse(w, http.StatusOK, map[string]any{
			"status":            "success",
			"decision":          "REJECTED",
			"request_id":        reqID,
			"applicant_email":   onboardingReq.ApplicantEmail,
			"onboarding_status": domain.OnboardingStatusRejected,
		})
		return
	}

	// Decision: APPROVE
	roleSlug := strings.TrimSpace(strings.ToLower(req.AssignedRoleSlug))
	if roleSlug == "" {
		writeJSONError(w, http.StatusBadRequest, "assigned_role_slug is required when approving a staff member")
		return
	}

	role, err := h.repo.GetRoleBySlug(r.Context(), roleSlug)
	if err != nil {
		writeJSONError(w, http.StatusBadRequest, fmt.Sprintf("invalid role slug '%s': role does not exist", roleSlug))
		return
	}

	// Generate single-use activation token (32 bytes hex, 48-hour window)
	rawActivationToken := newRandomToken(32)
	actTokenHash := h.authService.HashToken(rawActivationToken)
	expiresAt := time.Now().UTC().Add(48 * time.Hour)

	audit := &domain.AuditLog{
		ActorUserID:  &claims.UserID,
		Action:       "STAFF_ONBOARDING_APPROVED",
		ResourceType: "staff_onboarding_request",
		ResourceID:   reqID,
		Payload: map[string]any{
			"applicant_email":     onboardingReq.ApplicantEmail,
			"assigned_role_slug":  role.Slug,
			"assigned_department": req.AssignedDepartment,
			"review_notes":        req.ReviewNotes,
		},
		IPAddress: r.RemoteAddr,
	}

	err = h.repo.ReviewOnboardingTransaction(
		r.Context(),
		reqID,
		domain.OnboardingStatusApprovedInvited,
		&role.ID,
		claims.UserID,
		req.ReviewNotes,
		actTokenHash,
		&expiresAt,
		audit,
	)
	if err != nil {
		writeJSONError(w, http.StatusInternalServerError, "transactional approval failed: "+err.Error())
		return
	}

	log.Printf("[ONBOARDING] Staff Application Approved by %s: %s assigned role '%s'",
		claims.Email, onboardingReq.ApplicantEmail, role.Slug)

	writeJSONResponse(w, http.StatusOK, map[string]any{
		"status":                "success",
		"decision":              "APPROVED",
		"request_id":            reqID,
		"applicant_email":       onboardingReq.ApplicantEmail,
		"assigned_role":         role.Slug,
		"onboarding_status":     domain.OnboardingStatusApprovedInvited,
		"activation_token_dev":  rawActivationToken, // Exposed for test automation & headless activation
		"token_expires_at":      expiresAt,
	})
}

// ----------------------------------------------------------------------------
// 4. POST /api/v1/admin/staff/invite (RequirePermission: staff.invite)
// ----------------------------------------------------------------------------
func (h *StaffOnboardingHandler) HandleDirectInvite(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSONError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}

	claims, ok := GetClaims(r.Context())
	if !ok {
		writeJSONError(w, http.StatusUnauthorized, "unauthorized: missing claims")
		return
	}

	var req StaffInviteRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSONError(w, http.StatusBadRequest, "invalid request payload: "+err.Error())
		return
	}

	email := strings.TrimSpace(strings.ToLower(req.Email))
	if email == "" || !strings.Contains(email, "@") {
		writeJSONError(w, http.StatusBadRequest, "a valid email is required")
		return
	}
	if strings.TrimSpace(req.FullName) == "" || strings.TrimSpace(req.Department) == "" {
		writeJSONError(w, http.StatusBadRequest, "full_name and department are required")
		return
	}

	// Verify not already registered
	if _, err := h.repo.GetUserByEmail(r.Context(), email); err == nil {
		writeJSONError(w, http.StatusConflict, "a user account with this email already exists")
		return
	}

	roleSlug := strings.TrimSpace(strings.ToLower(req.RoleSlug))
	role, err := h.repo.GetRoleBySlug(r.Context(), roleSlug)
	if err != nil {
		writeJSONError(w, http.StatusBadRequest, fmt.Sprintf("invalid role slug '%s'", roleSlug))
		return
	}

	// Generate activation token
	rawActivationToken := newRandomToken(32)
	actTokenHash := h.authService.HashToken(rawActivationToken)
	expiresAt := time.Now().UTC().Add(48 * time.Hour)

	onboardingReq := &domain.StaffOnboardingRequest{
		ApplicantEmail:      email,
		ApplicantPhone:      strings.TrimSpace(req.Phone),
		FullName:            strings.TrimSpace(req.FullName),
		RequestedDepartment: strings.TrimSpace(req.Department),
		CorenRegNumber:      strings.TrimSpace(req.CorenRegNumber),
		AssignedRegion:      strings.TrimSpace(req.AssignedRegion),
		Status:              domain.OnboardingStatusApprovedInvited,
		AssignedRoleID:      &role.ID,
		ReviewedByUserID:    &claims.UserID,
		ReviewNotes:         "Direct Super Admin Invitation",
		ActivationTokenHash: actTokenHash,
		TokenExpiresAt:      &expiresAt,
	}

	if err := h.repo.CreateOnboardingRequest(r.Context(), onboardingReq); err != nil {
		writeJSONError(w, http.StatusConflict, err.Error())
		return
	}

	audit := &domain.AuditLog{
		ActorUserID:  &claims.UserID,
		Action:       "STAFF_DIRECT_INVITATION",
		ResourceType: "staff_onboarding_request",
		ResourceID:   onboardingReq.ID,
		Payload: map[string]any{
			"invited_email": email,
			"assigned_role": role.Slug,
			"department":    req.Department,
		},
		IPAddress: r.RemoteAddr,
	}
	_ = h.repo.CreateAuditLog(r.Context(), audit)

	log.Printf("[ONBOARDING] Staff Direct Invitation Issued by %s to %s (Role: %s)",
		claims.Email, email, role.Slug)

	writeJSONResponse(w, http.StatusCreated, map[string]any{
		"status":                "success",
		"message":               "staff direct invitation created successfully",
		"request_id":            onboardingReq.ID,
		"invited_email":         email,
		"assigned_role":         role.Slug,
		"onboarding_status":     onboardingReq.Status,
		"activation_token_dev":  rawActivationToken,
		"expires_at":            expiresAt,
	})
}

// ----------------------------------------------------------------------------
// 5. POST /api/v1/auth/staff/activate (Account Creation & Role Provisioning)
// ----------------------------------------------------------------------------
func (h *StaffOnboardingHandler) HandleActivate(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSONError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}

	var req StaffActivateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSONError(w, http.StatusBadRequest, "invalid request payload: "+err.Error())
		return
	}

	email := strings.TrimSpace(strings.ToLower(req.Email))
	token := strings.TrimSpace(req.ActivationToken)
	if email == "" || token == "" {
		writeJSONError(w, http.StatusBadRequest, "both email and activation_token are required")
		return
	}

	// Validate & Hash Password (bcrypt cost 12)
	passwordHash, err := h.authService.HashPassword(req.Password)
	if err != nil {
		writeJSONError(w, http.StatusBadRequest, err.Error())
		return
	}

	tokenHash := h.authService.HashToken(token)
	onboardingReq, err := h.repo.GetOnboardingRequestByActivationTokenHash(r.Context(), tokenHash)
	if err != nil || onboardingReq.ApplicantEmail != email {
		writeJSONError(w, http.StatusBadRequest, "invalid, expired, or already-used activation token")
		return
	}

	if onboardingReq.Status != domain.OnboardingStatusApprovedInvited {
		writeJSONError(w, http.StatusBadRequest, fmt.Sprintf("cannot activate application in status '%s'", onboardingReq.Status))
		return
	}

	if onboardingReq.TokenExpiresAt != nil && time.Now().UTC().After(*onboardingReq.TokenExpiresAt) {
		writeJSONError(w, http.StatusBadRequest, "activation link has expired; request an admin re-invitation")
		return
	}

	if onboardingReq.AssignedRoleID == nil {
		writeJSONError(w, http.StatusInternalServerError, "no enterprise role assigned to this onboarding request")
		return
	}

	// Generate unique employee code: EMP-2026-XXXX
	empCode := fmt.Sprintf("EMP-2026-%s", strings.ToUpper(newRandomToken(2)))

	now := time.Now().UTC()
	newUser := &domain.User{
		Email:           email,
		Phone:           onboardingReq.ApplicantPhone,
		PasswordHash:    passwordHash,
		UserType:        domain.UserTypeStaff,
		Status:          domain.UserStatusActive,
		EmailVerifiedAt: &now,
		PhoneVerifiedAt: &now,
		MFAEnabled:      true,
		PreferredMFA:    string(domain.MFAChannelEmailAndSMS),
	}

	profile := &domain.StaffProfile{
		EmployeeCode:   empCode,
		Department:     onboardingReq.RequestedDepartment,
		CorenRegNumber: onboardingReq.CorenRegNumber,
		AssignedRegion: onboardingReq.AssignedRegion,
	}

	audit := &domain.AuditLog{
		Action:       "STAFF_ACCOUNT_ACTIVATED",
		ResourceType: "user",
		Payload: map[string]any{
			"email":         email,
			"employee_code": empCode,
			"department":    onboardingReq.RequestedDepartment,
		},
		IPAddress: r.RemoteAddr,
	}

	// Transactional Activation
	err = h.repo.ActivateStaffTransaction(
		r.Context(),
		onboardingReq.ID,
		newUser,
		profile,
		*onboardingReq.AssignedRoleID,
		audit,
	)
	if err != nil {
		writeJSONError(w, http.StatusInternalServerError, "failed to activate staff account: "+err.Error())
		return
	}

	log.Printf("[ONBOARDING] Staff Account Activated Successfully: %s (Code: %s)", email, empCode)

	writeJSONResponse(w, http.StatusOK, map[string]any{
		"status":        "success",
		"message":       "staff account activated successfully; you may now log in with your credentials",
		"user_id":       newUser.ID,
		"email":         newUser.Email,
		"employee_code": empCode,
		"department":    profile.Department,
		"user_status":   newUser.Status,
	})
}

// ----------------------------------------------------------------------------
// 6. POST /api/v1/auth/login, MFA Verification, & Password Recovery
// ----------------------------------------------------------------------------
func (h *StaffOnboardingHandler) HandleLogin(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSONError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}

	var req LoginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSONError(w, http.StatusBadRequest, "invalid request payload: "+err.Error())
		return
	}

	id := strings.TrimSpace(req.Identifier)
	if id == "" {
		id = strings.TrimSpace(req.Email)
	}
	if id == "" {
		id = strings.TrimSpace(req.Phone)
	}
	if id == "" || req.Password == "" {
		writeJSONError(w, http.StatusBadRequest, "email/phone and password are required")
		return
	}

	challenge, err := h.authService.InitiateLogin(r.Context(), id, req.Password, r.RemoteAddr, r.UserAgent())
	if err != nil {
		if err == usecases.ErrInvalidCredentials || err == usecases.ErrAccountNotActive {
			writeJSONError(w, http.StatusUnauthorized, err.Error())
			return
		}
		writeJSONError(w, http.StatusInternalServerError, err.Error())
		return
	}

	// If 2FA is required, return challenge response (status: "mfa_required")
	if challenge.Status == "mfa_required" {
		writeJSONResponse(w, http.StatusOK, challenge)
		return
	}

	// Otherwise, return direct auth response
	writeJSONResponse(w, http.StatusOK, challenge.AuthResponse)
}

func (h *StaffOnboardingHandler) HandleVerifyMFA(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSONError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}

	var req VerifyMFARequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSONError(w, http.StatusBadRequest, "invalid request payload: "+err.Error())
		return
	}

	if strings.TrimSpace(req.MFAToken) == "" || strings.TrimSpace(req.Code) == "" {
		writeJSONError(w, http.StatusBadRequest, "both mfa_token and verification code are required")
		return
	}

	authResp, err := h.authService.VerifyLoginMFA(r.Context(), req.MFAToken, req.Code, r.RemoteAddr, r.UserAgent())
	if err != nil {
		if err == usecases.ErrInvalidMFACode || err == usecases.ErrMFAMaxAttemptsExceeded {
			writeJSONError(w, http.StatusUnauthorized, err.Error())
			return
		}
		writeJSONError(w, http.StatusInternalServerError, err.Error())
		return
	}

	writeJSONResponse(w, http.StatusOK, authResp)
}

func (h *StaffOnboardingHandler) HandleResendMFA(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSONError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}

	var req ResendMFARequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSONError(w, http.StatusBadRequest, "invalid request payload: "+err.Error())
		return
	}

	if strings.TrimSpace(req.MFAToken) == "" {
		writeJSONError(w, http.StatusBadRequest, "mfa_token is required")
		return
	}

	resp, err := h.authService.ResendLoginMFA(r.Context(), req.MFAToken, req.Channel)
	if err != nil {
		writeJSONError(w, http.StatusBadRequest, err.Error())
		return
	}

	writeJSONResponse(w, http.StatusOK, resp)
}

func (h *StaffOnboardingHandler) HandleForgotPassword(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSONError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}

	var req ForgotPasswordRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSONError(w, http.StatusBadRequest, "invalid request payload: "+err.Error())
		return
	}

	id := strings.TrimSpace(req.Identifier)
	if id == "" {
		id = strings.TrimSpace(req.Email)
	}
	if id == "" {
		id = strings.TrimSpace(req.Phone)
	}
	if id == "" {
		writeJSONError(w, http.StatusBadRequest, "registered email or phone number is required")
		return
	}

	resp, err := h.authService.RequestPasswordReset(r.Context(), id)
	if err != nil {
		writeJSONError(w, http.StatusInternalServerError, err.Error())
		return
	}

	writeJSONResponse(w, http.StatusOK, resp)
}

func (h *StaffOnboardingHandler) HandleResetPassword(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSONError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}

	var req ResetPasswordRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSONError(w, http.StatusBadRequest, "invalid request payload: "+err.Error())
		return
	}

	id := strings.TrimSpace(req.Identifier)
	if id == "" {
		id = strings.TrimSpace(req.Email)
	}
	if id == "" {
		id = strings.TrimSpace(req.Phone)
	}

	if strings.TrimSpace(req.NewPassword) == "" {
		writeJSONError(w, http.StatusBadRequest, "new_password is required")
		return
	}
	reqCode := strings.TrimSpace(req.Code)
	if reqCode == "" {
		reqCode = strings.TrimSpace(req.RecoveryCode)
	}
	if reqCode == "" && strings.TrimSpace(req.ResetToken) == "" {
		writeJSONError(w, http.StatusBadRequest, "recovery code or reset_token is required")
		return
	}

	err := h.authService.ResetPassword(r.Context(), id, reqCode, req.ResetToken, req.NewPassword)
	if err != nil {
		if err == usecases.ErrInvalidResetCode || strings.Contains(err.Error(), "characters") {
			writeJSONError(w, http.StatusBadRequest, err.Error())
			return
		}
		writeJSONError(w, http.StatusInternalServerError, err.Error())
		return
	}

	writeJSONResponse(w, http.StatusOK, map[string]any{
		"status":  "success",
		"message": "Password updated successfully. You may now log in with your new credentials.",
	})
}

func (h *StaffOnboardingHandler) HandleChangePassword(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSONError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}

	var req ChangePasswordRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSONError(w, http.StatusBadRequest, "invalid request payload: "+err.Error())
		return
	}

	claims, hasClaims := GetClaims(r.Context())
	uid := strings.TrimSpace(req.UserID)
	if uid == "" && hasClaims && claims != nil {
		uid = claims.UserID
	}

	id := strings.TrimSpace(req.Identifier)
	if id == "" {
		id = strings.TrimSpace(req.Email)
	}
	if id == "" && hasClaims && claims != nil {
		id = claims.Email
	}

	currentPass := strings.TrimSpace(req.CurrentPassword)
	newPass := strings.TrimSpace(req.NewPassword)

	if (uid == "" && id == "") || currentPass == "" || newPass == "" {
		writeJSONError(w, http.StatusBadRequest, "Current password, new password, and user identity are required.")
		return
	}

	if len(newPass) < 8 {
		writeJSONError(w, http.StatusBadRequest, "New password must be at least 8 characters long.")
		return
	}

	err := h.authService.ChangePassword(r.Context(), uid, id, currentPass, newPass)
	if err != nil {
		if errors.Is(err, usecases.ErrInvalidCredentials) {
			writeJSONError(w, http.StatusUnauthorized, "Current password is incorrect.")
			return
		}
		writeJSONError(w, http.StatusBadRequest, err.Error())
		return
	}

	writeJSONResponse(w, http.StatusOK, map[string]any{
		"status":  "success",
		"message": "Password changed successfully.",
	})
}

func (h *StaffOnboardingHandler) HandleRefresh(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSONError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}

	var req RefreshRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSONError(w, http.StatusBadRequest, "invalid request payload: "+err.Error())
		return
	}

	authResp, err := h.authService.RefreshToken(r.Context(), req.RefreshToken, r.RemoteAddr, r.UserAgent())
	if err != nil {
		writeJSONError(w, http.StatusUnauthorized, err.Error())
		return
	}

	writeJSONResponse(w, http.StatusOK, authResp)
}

// ----------------------------------------------------------------------------
// 7. GET /api/v1/auth/sandbox-token (Developer Impersonation Helper)
// ----------------------------------------------------------------------------
func (h *StaffOnboardingHandler) HandleSandboxToken(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet && r.Method != http.MethodPost {
		writeJSONError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}

	roleSlug := r.URL.Query().Get("role")
	if roleSlug == "" {
		roleSlug = r.URL.Query().Get("role_slug")
	}

	if r.Method == http.MethodPost {
		var req struct {
			RoleSlug string `json:"role_slug"`
			Role     string `json:"role"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err == nil {
			if req.RoleSlug != "" {
				roleSlug = req.RoleSlug
			} else if req.Role != "" {
				roleSlug = req.Role
			}
		}
	}

	if roleSlug == "" {
		roleSlug = domain.RoleSuperAdmin
	}

	tokenStr, claims, err := h.authService.GenerateSandboxToken(roleSlug)
	if err != nil {
		if err == usecases.ErrSandboxDisabledInProd {
			writeJSONError(w, http.StatusForbidden, err.Error())
			return
		}
		writeJSONError(w, http.StatusBadRequest, err.Error())
		return
	}

	writeJSONResponse(w, http.StatusOK, map[string]any{
		"status":       "success",
		"environment":  "sandbox_impersonation",
		"access_token": tokenStr,
		"token_type":   "Bearer",
		"role_slug":    roleSlug,
		"user_id":      claims.UserID,
		"email":        claims.Email,
		"roles":        claims.Roles,
		"permissions":  claims.Permissions,
		"claims":       claims,
	})
}

// ----------------------------------------------------------------------------
// 8. GET /api/v1/auth/me (Current Authenticated Identity)
// ----------------------------------------------------------------------------
func (h *StaffOnboardingHandler) HandleMe(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeJSONError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}

	claims, ok := GetClaims(r.Context())
	if !ok {
		writeJSONError(w, http.StatusUnauthorized, "unauthorized: missing claims")
		return
	}

	writeJSONResponse(w, http.StatusOK, map[string]any{
		"status":      "success",
		"user_id":     claims.UserID,
		"email":       claims.Email,
		"user_type":   claims.UserType,
		"roles":       claims.Roles,
		"permissions": claims.Permissions,
		"customer_id": claims.CustomerID,
	})
}

// ----------------------------------------------------------------------------
// 9. GET /api/v1/auth/dev/latest-code (Developer Testing Verification Code Access)
// ----------------------------------------------------------------------------
func (h *StaffOnboardingHandler) HandleDevLatestCode(w http.ResponseWriter, r *http.Request) {
	if strings.EqualFold(h.authService.Environment(), "production") {
		writeJSONError(w, http.StatusNotFound, "developer endpoints disabled in production")
		return
	}
	id := strings.TrimSpace(r.URL.Query().Get("identifier"))
	if id == "" {
		id = strings.TrimSpace(r.URL.Query().Get("email"))
	}
	if id == "" {
		id = strings.TrimSpace(r.URL.Query().Get("phone"))
	}
	if id == "" {
		writeJSONError(w, http.StatusBadRequest, "identifier, email or phone query parameter required")
		return
	}
	record, found := h.authService.GetLatestDevCode(id)
	if !found {
		writeJSONError(w, http.StatusNotFound, "no active verification code found for identifier")
		return
	}
	writeJSONResponse(w, http.StatusOK, record)
}

// newRandomToken returns secure random hex string.
func newRandomToken(nBytes int) string {
	b := make([]byte, nBytes)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}
