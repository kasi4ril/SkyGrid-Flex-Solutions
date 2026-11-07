package handlers_test

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/SkyGrid-Flex-Solutions/growatt-payg-enterprise/core-backend/internal/adapters/handlers"
	"github.com/SkyGrid-Flex-Solutions/growatt-payg-enterprise/core-backend/internal/adapters/repositories"
	"github.com/SkyGrid-Flex-Solutions/growatt-payg-enterprise/core-backend/internal/domain"
	"github.com/SkyGrid-Flex-Solutions/growatt-payg-enterprise/core-backend/internal/usecases"
)

type testHarness struct {
	repo              repositories.IAMRepository
	authService       *usecases.AuthService
	authMiddleware    *handlers.AuthMiddleware
	onboardingHandler *handlers.StaffOnboardingHandler
	superAdminToken   string
	supportToken      string
	customerToken     string
}

func setupTestHarness(t *testing.T) *testHarness {
	repo := repositories.NewMemoryIAMRepository()
	authService := usecases.NewAuthService(repo, "test-master-secret-key-32bytes!", "development")
	authMiddleware := handlers.NewAuthMiddleware(authService)
	onboardingHandler := handlers.NewStaffOnboardingHandler(repo, authService)

	// Generate test tokens via sandbox helper
	saToken, _, err := authService.GenerateSandboxToken(domain.RoleSuperAdmin)
	if err != nil {
		t.Fatalf("failed to create super_admin token: %v", err)
	}

	csToken, _, err := authService.GenerateSandboxToken(domain.RoleCustomerSupport)
	if err != nil {
		t.Fatalf("failed to create customer_support token: %v", err)
	}

	custToken, _, err := authService.GenerateSandboxToken(domain.RoleCustomer)
	if err != nil {
		t.Fatalf("failed to create customer token: %v", err)
	}

	return &testHarness{
		repo:              repo,
		authService:       authService,
		authMiddleware:    authMiddleware,
		onboardingHandler: onboardingHandler,
		superAdminToken:   saToken,
		supportToken:      csToken,
		customerToken:     custToken,
	}
}

// ----------------------------------------------------------------------------
// Test 1: Full 5-Stage Onboarding Lifecycle (Apply -> Verify -> Review -> Activate -> Login -> Me)
// ----------------------------------------------------------------------------
func TestStaffOnboarding_FullLifecycle(t *testing.T) {
	h := setupTestHarness(t)
	applicantEmail := "emeka.okonkwo@skygrid.ng"

	// --- Stage 1: Public Staff Application ---
	applyPayload := map[string]any{
		"applicant_email":      applicantEmail,
		"applicant_phone":      "08031234567",
		"full_name":            "Emeka Okonkwo",
		"requested_department": "Engineering & Operations",
		"coren_reg_number":     "COREN-R-44219",
		"assigned_region":      "Abuja FCT & North-Central",
	}
	body, _ := json.Marshal(applyPayload)
	req := httptest.NewRequest(http.MethodPost, "/api/v1/auth/staff/apply", bytes.NewReader(body))
	w := httptest.NewRecorder()
	h.onboardingHandler.HandleApply(w, req)

	if w.Code != http.StatusCreated {
		t.Fatalf("Stage 1 Apply failed: expected 201 Created, got %d: %s", w.Code, w.Body.String())
	}

	var applyResp map[string]any
	_ = json.NewDecoder(w.Body).Decode(&applyResp)
	requestID := applyResp["request_id"].(string)
	verifyTokenDev := applyResp["verification_token_dev"].(string)
	if verifyTokenDev == "" || requestID == "" {
		t.Fatalf("expected request_id and verification_token_dev in response")
	}

	// --- Stage 2: Tokenized Email Verification ---
	verifyPayload := map[string]any{
		"email":              applicantEmail,
		"verification_token": verifyTokenDev,
	}
	body, _ = json.Marshal(verifyPayload)
	req = httptest.NewRequest(http.MethodPost, "/api/v1/auth/staff/verify-email", bytes.NewReader(body))
	w = httptest.NewRecorder()
	h.onboardingHandler.HandleVerifyEmail(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("Stage 2 Verify Email failed: expected 200 OK, got %d: %s", w.Code, w.Body.String())
	}

	var verifyResp map[string]any
	_ = json.NewDecoder(w.Body).Decode(&verifyResp)
	if verifyResp["onboarding_status"] != string(domain.OnboardingStatusPendingSuperAdminReview) {
		t.Errorf("expected status 'PENDING_SUPERADMIN_REVIEW', got %v", verifyResp["onboarding_status"])
	}

	// --- Stage 3: Super Admin Review & Role Assignment ---
	reviewPayload := map[string]any{
		"request_id":          requestID,
		"decision":            "APPROVE",
		"assigned_role_slug":  domain.RoleOperationsManager,
		"assigned_department": "Engineering & Field Operations",
		"assigned_region":     "Abuja FCT",
		"review_notes":        "COREN certification verified against database; approved for Operations Manager.",
	}
	body, _ = json.Marshal(reviewPayload)
	req = httptest.NewRequest(http.MethodPost, "/api/v1/admin/staff/review", bytes.NewReader(body))
	req.Header.Set("Authorization", "Bearer "+h.superAdminToken)
	w = httptest.NewRecorder()

	reviewHandler := h.authMiddleware.AuthenticateJWTFunc(
		h.authMiddleware.RequirePermissionFunc(domain.PermStaffApprove, h.onboardingHandler.HandleReview),
	)
	reviewHandler.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("Stage 3 Review failed: expected 200 OK, got %d: %s", w.Code, w.Body.String())
	}

	var reviewResp map[string]any
	_ = json.NewDecoder(w.Body).Decode(&reviewResp)
	if reviewResp["onboarding_status"] != string(domain.OnboardingStatusApprovedInvited) {
		t.Errorf("expected status 'APPROVED_INVITED', got %v", reviewResp["onboarding_status"])
	}
	activationTokenDev := reviewResp["activation_token_dev"].(string)
	if activationTokenDev == "" {
		t.Fatal("expected activation_token_dev in review response")
	}

	// --- Stage 4: Staff Account Activation ---
	staffPassword := "P@sswordEnterprise2026!"
	activatePayload := map[string]any{
		"email":            applicantEmail,
		"activation_token": activationTokenDev,
		"password":         staffPassword,
	}
	body, _ = json.Marshal(activatePayload)
	req = httptest.NewRequest(http.MethodPost, "/api/v1/auth/staff/activate", bytes.NewReader(body))
	w = httptest.NewRecorder()
	h.onboardingHandler.HandleActivate(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("Stage 4 Activate failed: expected 200 OK, got %d: %s", w.Code, w.Body.String())
	}

	var activateResp map[string]any
	_ = json.NewDecoder(w.Body).Decode(&activateResp)
	if activateResp["status"] != "success" {
		t.Errorf("expected status success, got %v", activateResp["status"])
	}
	empCode, ok := activateResp["employee_code"].(string)
	if !ok || len(empCode) < 8 {
		t.Errorf("expected valid employee code (EMP-2026-XXXX), got %v", empCode)
	}

	// Re-activating with same token MUST fail (single-use token protection)
	body, _ = json.Marshal(activatePayload)
	req = httptest.NewRequest(http.MethodPost, "/api/v1/auth/staff/activate", bytes.NewReader(body))
	w = httptest.NewRecorder()
	h.onboardingHandler.HandleActivate(w, req)
	if w.Code != http.StatusBadRequest {
		t.Errorf("expected 400 Bad Request on re-activation attempt, got %d", w.Code)
	}

	// --- Stage 5: Staff Login ---
	loginPayload := map[string]any{
		"email":    applicantEmail,
		"password": staffPassword,
	}
	body, _ = json.Marshal(loginPayload)
	req = httptest.NewRequest(http.MethodPost, "/api/v1/auth/login", bytes.NewReader(body))
	w = httptest.NewRecorder()
	h.onboardingHandler.HandleLogin(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("Stage 5 Login failed: expected 200 OK, got %d: %s", w.Code, w.Body.String())
	}

	var loginResp map[string]any
	_ = json.NewDecoder(w.Body).Decode(&loginResp)
	accessToken := loginResp["access_token"].(string)
	refreshToken := loginResp["refresh_token"].(string)
	if accessToken == "" || refreshToken == "" {
		t.Fatal("expected valid access_token and refresh_token from login")
	}

	// --- Stage 6: Authenticated Identity Profile (/api/v1/auth/me) ---
	req = httptest.NewRequest(http.MethodGet, "/api/v1/auth/me", nil)
	req.Header.Set("Authorization", "Bearer "+accessToken)
	w = httptest.NewRecorder()
	meHandler := h.authMiddleware.AuthenticateJWTFunc(h.onboardingHandler.HandleMe)
	meHandler.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("Stage 6 /me failed: expected 200 OK, got %d: %s", w.Code, w.Body.String())
	}

	var meResp map[string]any
	_ = json.NewDecoder(w.Body).Decode(&meResp)
	if meResp["email"] != applicantEmail {
		t.Errorf("expected email %s, got %v", applicantEmail, meResp["email"])
	}
	roles := meResp["roles"].([]any)
	if len(roles) != 1 || roles[0] != domain.RoleOperationsManager {
		t.Errorf("expected role operations_manager, got %v", roles)
	}
}

// ----------------------------------------------------------------------------
// Test 2: Direct Super Admin Invitation Flow
// ----------------------------------------------------------------------------
func TestStaffOnboarding_DirectInviteFlow(t *testing.T) {
	h := setupTestHarness(t)
	inviteEmail := "field.kalu@skygrid.ng"

	invitePayload := map[string]any{
		"email":            inviteEmail,
		"phone":            "08059876543",
		"full_name":        "Kalu Nnamdi",
		"department":       "Field Services",
		"role_slug":        domain.RoleFieldEngineer,
		"coren_reg_number": "COREN-ENG-2026-99",
		"assigned_region":  "Lagos Mainland & Island",
	}
	body, _ := json.Marshal(invitePayload)
	req := httptest.NewRequest(http.MethodPost, "/api/v1/admin/staff/invite", bytes.NewReader(body))
	req.Header.Set("Authorization", "Bearer "+h.superAdminToken)
	w := httptest.NewRecorder()

	inviteHandler := h.authMiddleware.AuthenticateJWTFunc(
		h.authMiddleware.RequirePermissionFunc(domain.PermStaffInvite, h.onboardingHandler.HandleDirectInvite),
	)
	inviteHandler.ServeHTTP(w, req)

	if w.Code != http.StatusCreated {
		t.Fatalf("Direct invite failed: expected 201 Created, got %d: %s", w.Code, w.Body.String())
	}

	var resp map[string]any
	_ = json.NewDecoder(w.Body).Decode(&resp)
	if resp["onboarding_status"] != string(domain.OnboardingStatusApprovedInvited) {
		t.Errorf("expected status 'APPROVED_INVITED', got %v", resp["onboarding_status"])
	}
	activationToken := resp["activation_token_dev"].(string)

	// Activate directly
	actPayload := map[string]any{
		"email":            inviteEmail,
		"activation_token": activationToken,
		"password":         "FieldEngP@ss2026",
	}
	body, _ = json.Marshal(actPayload)
	req = httptest.NewRequest(http.MethodPost, "/api/v1/auth/staff/activate", bytes.NewReader(body))
	w = httptest.NewRecorder()
	h.onboardingHandler.HandleActivate(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("Activation of directly invited staff failed: expected 200 OK, got %d: %s", w.Code, w.Body.String())
	}

	// Login
	loginPayload := map[string]any{
		"email":    inviteEmail,
		"password": "FieldEngP@ss2026",
	}
	body, _ = json.Marshal(loginPayload)
	req = httptest.NewRequest(http.MethodPost, "/api/v1/auth/login", bytes.NewReader(body))
	w = httptest.NewRecorder()
	h.onboardingHandler.HandleLogin(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("Login for directly invited staff failed: expected 200 OK, got %d: %s", w.Code, w.Body.String())
	}
}

// ----------------------------------------------------------------------------
// Test 3: Rejection Flow
// ----------------------------------------------------------------------------
func TestStaffOnboarding_RejectionFlow(t *testing.T) {
	h := setupTestHarness(t)
	candidateEmail := "rejected.applicant@example.com"

	// Apply
	applyPayload := map[string]any{
		"applicant_email":      candidateEmail,
		"full_name":            "Incomplete Candidate",
		"requested_department": "Finance",
	}
	body, _ := json.Marshal(applyPayload)
	req := httptest.NewRequest(http.MethodPost, "/api/v1/auth/staff/apply", bytes.NewReader(body))
	w := httptest.NewRecorder()
	h.onboardingHandler.HandleApply(w, req)
	var applyResp map[string]any
	_ = json.NewDecoder(w.Body).Decode(&applyResp)
	reqID := applyResp["request_id"].(string)
	vToken := applyResp["verification_token_dev"].(string)

	// Verify email
	verifyPayload := map[string]any{
		"email":              candidateEmail,
		"verification_token": vToken,
	}
	body, _ = json.Marshal(verifyPayload)
	req = httptest.NewRequest(http.MethodPost, "/api/v1/auth/staff/verify-email", bytes.NewReader(body))
	w = httptest.NewRecorder()
	h.onboardingHandler.HandleVerifyEmail(w, req)

	// Super Admin Rejects
	reviewPayload := map[string]any{
		"request_id":   reqID,
		"decision":     "REJECT",
		"review_notes": "Candidate failed background credit check and credentials verification.",
	}
	body, _ = json.Marshal(reviewPayload)
	req = httptest.NewRequest(http.MethodPost, "/api/v1/admin/staff/review", bytes.NewReader(body))
	req.Header.Set("Authorization", "Bearer "+h.superAdminToken)
	w = httptest.NewRecorder()

	reviewHandler := h.authMiddleware.AuthenticateJWTFunc(
		h.authMiddleware.RequirePermissionFunc(domain.PermStaffApprove, h.onboardingHandler.HandleReview),
	)
	reviewHandler.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("Expected 200 OK for rejection, got %d", w.Code)
	}

	var reviewResp map[string]any
	_ = json.NewDecoder(w.Body).Decode(&reviewResp)
	if reviewResp["onboarding_status"] != string(domain.OnboardingStatusRejected) {
		t.Errorf("expected status 'REJECTED', got %v", reviewResp["onboarding_status"])
	}
}

// ----------------------------------------------------------------------------
// Test 4: MANDATORY SECURITY GATE — Prevention of Self-Role Assignment
// ----------------------------------------------------------------------------
func TestStaffOnboarding_PreventSelfRoleAssignment(t *testing.T) {
	h := setupTestHarness(t)

	// Create a user who is a reviewer
	adminEmail := "superadmin.reviewer@skygrid.energy"
	adminUser := &domain.User{
		ID:       "usr-sa-reviewer-001",
		Email:    adminEmail,
		UserType: domain.UserTypeStaff,
		Status:   domain.UserStatusActive,
	}
	_ = h.repo.CreateUser(context.Background(), adminUser)

	adminToken, err := h.authService.GenerateAccessToken(adminUser, []string{domain.RoleSuperAdmin}, []string{domain.PermStaffApprove}, "")
	if err != nil {
		t.Fatalf("failed to generate admin access token: %v", err)
	}

	// Create an onboarding request with the SAME email as the reviewer
	onboardingReq := &domain.StaffOnboardingRequest{
		ApplicantEmail:      adminEmail,
		FullName:            "Reviewer Self Applicant",
		RequestedDepartment: "Executive",
		Status:              domain.OnboardingStatusPendingSuperAdminReview,
	}
	_ = h.repo.CreateOnboardingRequest(context.Background(), onboardingReq)

	// Attempt self-approval
	reviewPayload := map[string]any{
		"request_id":         onboardingReq.ID,
		"decision":           "APPROVE",
		"assigned_role_slug": domain.RoleSuperAdmin,
		"review_notes":       "Self-assigning super_admin role",
	}
	body, _ := json.Marshal(reviewPayload)
	req := httptest.NewRequest(http.MethodPost, "/api/v1/admin/staff/review", bytes.NewReader(body))
	req.Header.Set("Authorization", "Bearer "+adminToken)
	w := httptest.NewRecorder()

	reviewHandler := h.authMiddleware.AuthenticateJWTFunc(
		h.authMiddleware.RequirePermissionFunc(domain.PermStaffApprove, h.onboardingHandler.HandleReview),
	)
	reviewHandler.ServeHTTP(w, req)

	// MUST strictly return HTTP 403 Forbidden
	if w.Code != http.StatusForbidden {
		t.Fatalf("SECURITY VIOLATION: expected HTTP 403 Forbidden for self-role assignment, got %d: %s", w.Code, w.Body.String())
	}

	var errResp map[string]any
	_ = json.NewDecoder(w.Body).Decode(&errResp)
	if errResp["error_code"] != "SELF_APPROVAL_PROHIBITED" {
		t.Errorf("expected error_code 'SELF_APPROVAL_PROHIBITED', got %v", errResp["error_code"])
	}
}

// ----------------------------------------------------------------------------
// Test 5: Granular RBAC Permission Middleware (401, 403 Forbidden Checks)
// ----------------------------------------------------------------------------
func TestAuthMiddleware_RBACPermissionEnforcement(t *testing.T) {
	h := setupTestHarness(t)

	// Target endpoint requiring 'staff.approve'
	reviewHandler := h.authMiddleware.AuthenticateJWTFunc(
		h.authMiddleware.RequirePermissionFunc(domain.PermStaffApprove, h.onboardingHandler.HandleReview),
	)

	// Case 1: Unauthenticated request without Authorization header -> 401 Unauthorized
	req := httptest.NewRequest(http.MethodPost, "/api/v1/admin/staff/review", nil)
	w := httptest.NewRecorder()
	reviewHandler.ServeHTTP(w, req)
	if w.Code != http.StatusUnauthorized {
		t.Errorf("expected 401 Unauthorized for missing token, got %d", w.Code)
	}

	// Case 2: Customer Support token (lacks 'staff.approve') -> 403 Forbidden
	body, _ := json.Marshal(map[string]any{"request_id": "any", "decision": "APPROVE", "assigned_role_slug": "field_engineer"})
	req = httptest.NewRequest(http.MethodPost, "/api/v1/admin/staff/review", bytes.NewReader(body))
	req.Header.Set("Authorization", "Bearer "+h.supportToken)
	w = httptest.NewRecorder()
	reviewHandler.ServeHTTP(w, req)

	if w.Code != http.StatusForbidden {
		t.Errorf("expected 403 Forbidden when lacking permission 'staff.approve', got %d: %s", w.Code, w.Body.String())
	}
	var errResp map[string]any
	_ = json.NewDecoder(w.Body).Decode(&errResp)
	if errResp["error_code"] != "FORBIDDEN_INSUFFICIENT_PERMISSION" {
		t.Errorf("expected error_code 'FORBIDDEN_INSUFFICIENT_PERMISSION', got %v", errResp["error_code"])
	}

	// Case 3: Customer role token attempts direct staff invite (lacks 'staff.invite') -> 403 Forbidden
	inviteHandler := h.authMiddleware.AuthenticateJWTFunc(
		h.authMiddleware.RequirePermissionFunc(domain.PermStaffInvite, h.onboardingHandler.HandleDirectInvite),
	)
	req = httptest.NewRequest(http.MethodPost, "/api/v1/admin/staff/invite", bytes.NewReader(body))
	req.Header.Set("Authorization", "Bearer "+h.customerToken)
	w = httptest.NewRecorder()
	inviteHandler.ServeHTTP(w, req)

	if w.Code != http.StatusForbidden {
		t.Errorf("expected 403 Forbidden for customer role calling admin endpoint, got %d", w.Code)
	}
}

// ----------------------------------------------------------------------------
// Test 6: Customer Tenant Isolation Middleware
// ----------------------------------------------------------------------------
func TestAuthMiddleware_CustomerTenantIsolation(t *testing.T) {
	h := setupTestHarness(t)

	// Mock customer endpoint handler
	dummyCustomerHandler := func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"status":"success","data":"isolated_customer_record"}`))
	}

	isolatedRoute := h.authMiddleware.AuthenticateJWTFunc(
		h.authMiddleware.EnforceCustomerIsolationFunc("customer_id", dummyCustomerHandler),
	)

	// Issue token specifically for customer CUST-AAA-111
	custUser := &domain.User{
		ID:       "usr-cust-111",
		Email:    "customer.aaa@gmail.com",
		UserType: domain.UserTypeCustomer,
		Status:   domain.UserStatusActive,
	}
	custTokenAAA, err := h.authService.GenerateAccessToken(custUser, []string{domain.RoleCustomer}, []string{}, "CUST-AAA-111")
	if err != nil {
		t.Fatalf("failed to generate customer token: %v", err)
	}

	// Sub-test A: Customer accesses own customer_id -> 200 OK
	req := httptest.NewRequest(http.MethodGet, "/api/v1/customer/dashboard?customer_id=CUST-AAA-111", nil)
	req.Header.Set("Authorization", "Bearer "+custTokenAAA)
	w := httptest.NewRecorder()
	isolatedRoute.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("expected 200 OK when customer accesses own record, got %d: %s", w.Code, w.Body.String())
	}

	// Sub-test B: Customer attempts to access another customer's ID -> 403 Forbidden
	req = httptest.NewRequest(http.MethodGet, "/api/v1/customer/dashboard?customer_id=CUST-BBB-999", nil)
	req.Header.Set("Authorization", "Bearer "+custTokenAAA)
	w = httptest.NewRecorder()
	isolatedRoute.ServeHTTP(w, req)

	if w.Code != http.StatusForbidden {
		t.Errorf("expected 403 Forbidden when customer accesses another tenant, got %d: %s", w.Code, w.Body.String())
	}
	var errResp map[string]any
	_ = json.NewDecoder(w.Body).Decode(&errResp)
	if errResp["error_code"] != "CUSTOMER_ISOLATION_VIOLATION" {
		t.Errorf("expected error_code 'CUSTOMER_ISOLATION_VIOLATION', got %v", errResp["error_code"])
	}

	// Sub-test C: Super Admin accesses customer data -> 200 OK (bypass)
	req = httptest.NewRequest(http.MethodGet, "/api/v1/customer/dashboard?customer_id=CUST-BBB-999", nil)
	req.Header.Set("Authorization", "Bearer "+h.superAdminToken)
	w = httptest.NewRecorder()
	isolatedRoute.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("expected 200 OK for Super Admin accessing customer data, got %d: %s", w.Code, w.Body.String())
	}
}

// ----------------------------------------------------------------------------
// Test 7: Refresh Token API Route Handling
// ----------------------------------------------------------------------------
func TestStaffOnboarding_RefreshEndpoint(t *testing.T) {
	h := setupTestHarness(t)

	// Step 1: Create active user and login to obtain refresh token
	rawPass := "SecurePass1234@"
	hash, _ := h.authService.HashPassword(rawPass)
	user := &domain.User{
		Email:        "auditor.amina@skygrid.ng",
		PasswordHash: hash,
		UserType:     domain.UserTypeStaff,
		Status:       domain.UserStatusActive,
	}
	_ = h.repo.CreateUser(context.Background(), user)
	role, _ := h.repo.GetRoleBySlug(context.Background(), domain.RoleComplianceAuditor)
	_ = h.repo.AssignRoleToUser(context.Background(), user.ID, role.ID, nil)

	loginPayload := map[string]any{
		"email":    user.Email,
		"password": rawPass,
	}
	body, _ := json.Marshal(loginPayload)
	req := httptest.NewRequest(http.MethodPost, "/api/v1/auth/login", bytes.NewReader(body))
	w := httptest.NewRecorder()
	h.onboardingHandler.HandleLogin(w, req)

	var loginResp map[string]any
	_ = json.NewDecoder(w.Body).Decode(&loginResp)
	rToken := loginResp["refresh_token"].(string)

	// Step 2: Refresh token
	refreshPayload := map[string]any{
		"refresh_token": rToken,
	}
	body, _ = json.Marshal(refreshPayload)
	req = httptest.NewRequest(http.MethodPost, "/api/v1/auth/refresh", bytes.NewReader(body))
	w = httptest.NewRecorder()
	h.onboardingHandler.HandleRefresh(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200 OK from /refresh, got %d: %s", w.Code, w.Body.String())
	}

	var refreshResp map[string]any
	_ = json.NewDecoder(w.Body).Decode(&refreshResp)
	newRToken := refreshResp["refresh_token"].(string)
	if newRToken == "" || newRToken == rToken {
		t.Errorf("expected new rotated refresh token")
	}

	// Step 3: Replaying old refresh token MUST return 401 Unauthorized
	body, _ = json.Marshal(refreshPayload)
	req = httptest.NewRequest(http.MethodPost, "/api/v1/auth/refresh", bytes.NewReader(body))
	w = httptest.NewRecorder()
	h.onboardingHandler.HandleRefresh(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Errorf("expected 401 Unauthorized for replayed refresh token, got %d", w.Code)
	}
}

func TestDeveloperTestAccounts_Login(t *testing.T) {
	h := setupTestHarness(t)

	testCases := []struct {
		email        string
		password     string
		expectedRole string
	}{
		{"admin@skytron.ng", "Admin@SkyTron2026!", "super_admin"},
		{"ops@skytron.ng", "Ops@SkyTron2026!", "operations_manager"},
		{"finance@skytron.ng", "Finance@SkyTron2026!", "finance_officer"},
		{"tech@skytron.ng", "Tech@SkyTron2026!", "field_engineer"},
		{"customer@skytron.ng", "Customer@SkyTron2026!", "customer"},
	}

	for _, tc := range testCases {
		t.Run(tc.email, func(t *testing.T) {
			payload := map[string]any{
				"email":    tc.email,
				"password": tc.password,
			}
			body, _ := json.Marshal(payload)
			req := httptest.NewRequest(http.MethodPost, "/api/v1/auth/login", bytes.NewReader(body))
			w := httptest.NewRecorder()
			h.onboardingHandler.HandleLogin(w, req)

			if w.Code != http.StatusOK {
				t.Fatalf("expected 200 OK for %s, got %d: %s", tc.email, w.Code, w.Body.String())
			}

			var resp struct {
				AccessToken string   `json:"access_token"`
				Roles       []string `json:"roles"`
				User        struct {
					Email string `json:"email"`
				} `json:"user"`
			}
			if err := json.NewDecoder(w.Body).Decode(&resp); err != nil {
				t.Fatalf("failed to decode login response: %v", err)
			}

			if resp.AccessToken == "" {
				t.Errorf("expected non-empty access token for %s", tc.email)
			}

			hasRole := false
			for _, r := range resp.Roles {
				if r == tc.expectedRole || (tc.expectedRole == "field_engineer" && r == "technician") {
					hasRole = true
					break
				}
			}
			if !hasRole {
				t.Errorf("expected role %s in roles %v for %s", tc.expectedRole, resp.Roles, tc.email)
			}
		})
	}
}
