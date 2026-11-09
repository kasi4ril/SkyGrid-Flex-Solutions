package handlers_test

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/SkyGrid-Flex-Solutions/growatt-payg-enterprise/core-backend/internal/adapters/handlers"
	"github.com/SkyGrid-Flex-Solutions/growatt-payg-enterprise/core-backend/internal/domain"
	"github.com/SkyGrid-Flex-Solutions/growatt-payg-enterprise/core-backend/internal/usecases"
)

func TestAuth_MFA_And_ResendFlow(t *testing.T) {
	h := setupTestHarness(t)

	// Pre-seeded customer account in dev: customer@skytron.ng / +2348044567890
	// Password is "Password@2026!" (matches bcrypt hash in seed) or let's create a fresh user
	userPassword := "SecurePassword2026!"
	hash, _ := h.authService.HashPassword(userPassword)
	user := &domain.User{
		Email:        "chinedu.solar@skygrid.ng",
		Phone:        "+2348011223344",
		PasswordHash: hash,
		UserType:     domain.UserTypeStaff,
		Status:       domain.UserStatusActive,
		MFAEnabled:   true,
		PreferredMFA: string(domain.MFAChannelEmailAndSMS),
	}
	_ = h.repo.CreateUser(t.Context(), user)

	// Step 1: Initiate Login -> Must receive mfa_required
	loginBody, _ := json.Marshal(map[string]any{
		"email":    user.Email,
		"password": userPassword,
	})
	req := httptest.NewRequest(http.MethodPost, "/api/v1/auth/login", bytes.NewReader(loginBody))
	w := httptest.NewRecorder()
	h.onboardingHandler.HandleLogin(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200 OK, got %d: %s", w.Code, w.Body.String())
	}

	var challengeResp map[string]any
	_ = json.NewDecoder(w.Body).Decode(&challengeResp)
	if challengeResp["status"] != "mfa_required" {
		t.Fatalf("expected status 'mfa_required', got %v", challengeResp["status"])
	}
	mfaToken := challengeResp["mfa_token"].(string)
	devCode := challengeResp["dev_code"].(string)

	if challengeResp["masked_email"] == "" || challengeResp["masked_phone"] == "" {
		t.Errorf("expected masked email and phone in challenge response: %v", challengeResp)
	}

	// Step 2: Test Invalid Code Failure
	badPayload, _ := json.Marshal(map[string]any{
		"mfa_token": mfaToken,
		"code":      "000000",
	})
	req = httptest.NewRequest(http.MethodPost, "/api/v1/auth/verify-mfa", bytes.NewReader(badPayload))
	w = httptest.NewRecorder()
	h.onboardingHandler.HandleVerifyMFA(w, req)
	if w.Code != http.StatusUnauthorized {
		t.Errorf("expected 401 Unauthorized for incorrect code, got %d", w.Code)
	}

	// Step 3: Test Resend OTP Code
	resendPayload, _ := json.Marshal(map[string]any{
		"mfa_token": mfaToken,
		"channel":   "SMS",
	})
	req = httptest.NewRequest(http.MethodPost, "/api/v1/auth/resend-mfa-otp", bytes.NewReader(resendPayload))
	w = httptest.NewRecorder()
	h.onboardingHandler.HandleResendMFA(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200 OK on resend, got %d: %s", w.Code, w.Body.String())
	}
	var resendResp map[string]any
	_ = json.NewDecoder(w.Body).Decode(&resendResp)
	newDevCode := resendResp["dev_code"].(string)
	if newDevCode == "" {
		t.Fatal("expected new dev code on resend")
	}

	// Old code should fail after resend
	oldCodePayload, _ := json.Marshal(map[string]any{
		"mfa_token": mfaToken,
		"code":      devCode,
	})
	req = httptest.NewRequest(http.MethodPost, "/api/v1/auth/verify-mfa", bytes.NewReader(oldCodePayload))
	w = httptest.NewRecorder()
	h.onboardingHandler.HandleVerifyMFA(w, req)
	if w.Code != http.StatusUnauthorized {
		t.Errorf("expected 401 for superseded code, got %d", w.Code)
	}

	// Step 4: Verify with New Code -> Succeeded
	validPayload, _ := json.Marshal(map[string]any{
		"mfa_token": mfaToken,
		"code":      newDevCode,
	})
	req = httptest.NewRequest(http.MethodPost, "/api/v1/auth/verify-mfa", bytes.NewReader(validPayload))
	w = httptest.NewRecorder()
	h.onboardingHandler.HandleVerifyMFA(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200 OK on valid verification, got %d: %s", w.Code, w.Body.String())
	}
	var authResp map[string]any
	_ = json.NewDecoder(w.Body).Decode(&authResp)
	if authResp["access_token"] == nil || authResp["refresh_token"] == nil {
		t.Errorf("expected access and refresh tokens, got: %v", authResp)
	}
}

func TestAuth_ForgotPassword_And_Reset(t *testing.T) {
	h := setupTestHarness(t)

	oldPassword := "OldP@ssword2026!"
	newPassword := "NewBrandP@ssword2026!"
	hash, _ := h.authService.HashPassword(oldPassword)

	user := &domain.User{
		Email:        "grace.danladi@skygrid.ng",
		Phone:        "+2348055443322",
		PasswordHash: hash,
		UserType:     domain.UserTypeStaff,
		Status:       domain.UserStatusActive,
		MFAEnabled:   true,
	}
	_ = h.repo.CreateUser(t.Context(), user)

	// Step 1: Request Password Reset via Email
	forgotPayload, _ := json.Marshal(map[string]any{
		"email": user.Email,
	})
	req := httptest.NewRequest(http.MethodPost, "/api/v1/auth/forgot-password", bytes.NewReader(forgotPayload))
	w := httptest.NewRecorder()
	h.onboardingHandler.HandleForgotPassword(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200 OK on forgot password, got %d: %s", w.Code, w.Body.String())
	}

	var forgotResp map[string]any
	_ = json.NewDecoder(w.Body).Decode(&forgotResp)
	resetCode := forgotResp["dev_reset_code"].(string)
	resetToken := forgotResp["reset_token"].(string)
	if resetCode == "" || resetToken == "" {
		t.Fatalf("expected resetCode and resetToken, got %v", forgotResp)
	}

	// Step 2: Reset Password with recovery code
	resetPayload, _ := json.Marshal(map[string]any{
		"email":        user.Email,
		"code":         resetCode,
		"new_password": newPassword,
	})
	req = httptest.NewRequest(http.MethodPost, "/api/v1/auth/reset-password", bytes.NewReader(resetPayload))
	w = httptest.NewRecorder()
	h.onboardingHandler.HandleResetPassword(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200 OK on reset password, got %d: %s", w.Code, w.Body.String())
	}

	// Step 3: Old password must now fail
	oldLoginPayload, _ := json.Marshal(map[string]any{
		"email":    user.Email,
		"password": oldPassword,
	})
	req = httptest.NewRequest(http.MethodPost, "/api/v1/auth/login", bytes.NewReader(oldLoginPayload))
	w = httptest.NewRecorder()
	h.onboardingHandler.HandleLogin(w, req)
	if w.Code != http.StatusUnauthorized {
		t.Errorf("expected 401 Unauthorized with old password, got %d", w.Code)
	}

	// Step 4: New password succeeds and challenges MFA
	newLoginPayload, _ := json.Marshal(map[string]any{
		"email":    user.Email,
		"password": newPassword,
	})
	req = httptest.NewRequest(http.MethodPost, "/api/v1/auth/login", bytes.NewReader(newLoginPayload))
	w = httptest.NewRecorder()
	h.onboardingHandler.HandleLogin(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200 OK with new password, got %d: %s", w.Code, w.Body.String())
	}
	var newLoginResp map[string]any
	_ = json.NewDecoder(w.Body).Decode(&newLoginResp)
	if newLoginResp["status"] != "mfa_required" {
		t.Errorf("expected mfa_required, got %v", newLoginResp["status"])
	}
}

func TestCustomer_Registration_And_MFALogin(t *testing.T) {
	h := setupTestHarness(t)
	calculator := usecases.NewSizingCalculatorService()
	showroomHandler := handlers.NewPublicShowroomHandler(calculator, h.repo, h.authService)

	custEmail := "fatima.solar@gmail.com"
	custPassword := "FatimaSolar2026!"
	custPhone := "+2348039988776"

	regPayload := map[string]any{
		"nin":                 "11223344556",
		"first_name":          "Fatima",
		"last_name":           "Aliyu",
		"email":               custEmail,
		"phone":               custPhone,
		"password":            custPassword,
		"state_region":        "Abuja FCT",
		"street_address":      "Plot 123 Maitama District",
		"package_code":        "PKG-RES-5KVA",
		"package_name":        "Urban Elite 5kVA / 10kWh",
		"down_payment_ngn":    "450000",
		"monthly_installment": "95000",
		"total_asset_cost":    "3870000",
	}
	body, _ := json.Marshal(regPayload)
	req := httptest.NewRequest(http.MethodPost, "/api/v1/public/register-customer", bytes.NewReader(body))
	w := httptest.NewRecorder()
	showroomHandler.HandleRegisterCustomer(w, req)

	if w.Code != http.StatusCreated {
		t.Fatalf("expected 201 Created on register customer, got %d: %s", w.Code, w.Body.String())
	}

	// Verify customer was persisted in repository
	createdUser, err := h.repo.GetUserByEmail(t.Context(), custEmail)
	if err != nil || createdUser == nil {
		t.Fatalf("customer was not saved in IAM repository: %v", err)
	}
	if createdUser.UserType != domain.UserTypeCustomer {
		t.Errorf("expected UserTypeCustomer, got %v", createdUser.UserType)
	}

	// Verify newly registered customer can initiate 2FA login
	loginPayload, _ := json.Marshal(map[string]any{
		"email":    custEmail,
		"password": custPassword,
	})
	req = httptest.NewRequest(http.MethodPost, "/api/v1/auth/login", bytes.NewReader(loginPayload))
	w = httptest.NewRecorder()
	h.onboardingHandler.HandleLogin(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200 OK on customer login, got %d: %s", w.Code, w.Body.String())
	}

	var challengeResp map[string]any
	_ = json.NewDecoder(w.Body).Decode(&challengeResp)
	if challengeResp["status"] != "mfa_required" {
		t.Fatalf("expected mfa_required, got %v", challengeResp["status"])
	}

	// Verify MFA
	mfaPayload, _ := json.Marshal(map[string]any{
		"mfa_token": challengeResp["mfa_token"],
		"code":      challengeResp["dev_code"],
	})
	req = httptest.NewRequest(http.MethodPost, "/api/v1/auth/verify-mfa", bytes.NewReader(mfaPayload))
	w = httptest.NewRecorder()
	h.onboardingHandler.HandleVerifyMFA(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200 OK on customer MFA verify, got %d: %s", w.Code, w.Body.String())
	}

	var authResp map[string]any
	_ = json.NewDecoder(w.Body).Decode(&authResp)
	if authResp["access_token"] == nil {
		t.Errorf("expected access_token for customer login: %v", authResp)
	}
}

func TestAuth_ChangePassword(t *testing.T) {
	h := setupTestHarness(t)

	initialPassword := "OriginalPass2026!"
	hash, _ := h.authService.HashPassword(initialPassword)
	user := &domain.User{
		Email:        "engineer.danjuma@skygrid.ng",
		Phone:        "+2348099887766",
		PasswordHash: hash,
		UserType:     domain.UserTypeStaff,
		Status:       domain.UserStatusActive,
		MFAEnabled:   true,
		PreferredMFA: string(domain.MFAChannelEmailAndSMS),
	}
	_ = h.repo.CreateUser(t.Context(), user)

	// 1. Wrong current password -> 401
	badCurrent, _ := json.Marshal(map[string]any{
		"email":            user.Email,
		"current_password": "WrongPassword!",
		"new_password":     "BrandNewPass2026!",
	})
	req := httptest.NewRequest(http.MethodPost, "/api/v1/auth/change-password", bytes.NewReader(badCurrent))
	w := httptest.NewRecorder()
	h.onboardingHandler.HandleChangePassword(w, req)
	if w.Code != http.StatusUnauthorized {
		t.Errorf("expected 401 for incorrect current password, got %d", w.Code)
	}

	// 2. Short new password (<8 chars) -> 400
	shortPass, _ := json.Marshal(map[string]any{
		"email":            user.Email,
		"current_password": initialPassword,
		"new_password":     "short",
	})
	req = httptest.NewRequest(http.MethodPost, "/api/v1/auth/change-password", bytes.NewReader(shortPass))
	w = httptest.NewRecorder()
	h.onboardingHandler.HandleChangePassword(w, req)
	if w.Code != http.StatusBadRequest {
		t.Errorf("expected 400 for short new password, got %d", w.Code)
	}

	// 3. Successful change password
	newPassword := "NewSuperSecurePass2026!"
	validChange, _ := json.Marshal(map[string]any{
		"email":            user.Email,
		"current_password": initialPassword,
		"new_password":     newPassword,
	})
	req = httptest.NewRequest(http.MethodPost, "/api/v1/auth/change-password", bytes.NewReader(validChange))
	w = httptest.NewRecorder()
	h.onboardingHandler.HandleChangePassword(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200 OK for successful password change, got %d: %s", w.Code, w.Body.String())
	}

	// 4. Old password can no longer log in
	oldLogin, _ := json.Marshal(map[string]any{
		"email":    user.Email,
		"password": initialPassword,
	})
	req = httptest.NewRequest(http.MethodPost, "/api/v1/auth/login", bytes.NewReader(oldLogin))
	w = httptest.NewRecorder()
	h.onboardingHandler.HandleLogin(w, req)
	if w.Code != http.StatusUnauthorized {
		t.Errorf("expected 401 logging in with old password, got %d", w.Code)
	}

	// 5. New password logs in successfully (returns mfa_required)
	newLogin, _ := json.Marshal(map[string]any{
		"email":    user.Email,
		"password": newPassword,
	})
	req = httptest.NewRequest(http.MethodPost, "/api/v1/auth/login", bytes.NewReader(newLogin))
	w = httptest.NewRecorder()
	h.onboardingHandler.HandleLogin(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200 OK logging in with new password, got %d: %s", w.Code, w.Body.String())
	}

	var mfaResp map[string]any
	_ = json.NewDecoder(w.Body).Decode(&mfaResp)
	if mfaResp["status"] != "mfa_required" {
		t.Errorf("expected mfa_required with new password login, got %v", mfaResp["status"])
	}
}
