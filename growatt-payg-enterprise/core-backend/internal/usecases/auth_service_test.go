package usecases_test

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/SkyGrid-Flex-Solutions/growatt-payg-enterprise/core-backend/internal/adapters/repositories"
	"github.com/SkyGrid-Flex-Solutions/growatt-payg-enterprise/core-backend/internal/domain"
	"github.com/SkyGrid-Flex-Solutions/growatt-payg-enterprise/core-backend/internal/usecases"
	"golang.org/x/crypto/bcrypt"
)

func TestAuthService_PasswordHashing(t *testing.T) {
	repo := repositories.NewMemoryIAMRepository()
	authService := usecases.NewAuthService(repo, "test-secret-key-2026", "development")

	// Valid password
	pwd := "SecurePassword#2026"
	hash, err := authService.HashPassword(pwd)
	if err != nil {
		t.Fatalf("unexpected error hashing password: %v", err)
	}

	// Verify Bcrypt Cost 12
	cost, err := bcrypt.Cost([]byte(hash))
	if err != nil {
		t.Fatalf("failed to retrieve bcrypt cost: %v", err)
	}
	if cost != usecases.BcryptCost {
		t.Errorf("expected bcrypt cost %d, got %d", usecases.BcryptCost, cost)
	}

	// Password check passes
	if !authService.CheckPasswordHash(pwd, hash) {
		t.Errorf("expected CheckPasswordHash to succeed for correct password")
	}

	// Password check fails for wrong password
	if authService.CheckPasswordHash("WrongPassword#999", hash) {
		t.Errorf("expected CheckPasswordHash to fail for wrong password")
	}

	// Password shorter than 8 chars must fail
	if _, err := authService.HashPassword("short"); err == nil {
		t.Errorf("expected error for password < 8 chars, got nil")
	}
}

func TestAuthService_JWT_IssuanceAndValidation(t *testing.T) {
	repo := repositories.NewMemoryIAMRepository()
	authService := usecases.NewAuthService(repo, "enterprise-master-jwt-secret-key-32b", "development")

	user := &domain.User{
		ID:       "usr-f001-test",
		Email:    "eng.adebayo@skygrid.ng",
		UserType: domain.UserTypeStaff,
		Status:   domain.UserStatusActive,
	}

	roles := []string{domain.RoleFieldEngineer}
	perms := []string{domain.PermInstallationsUpdate, domain.PermMaintenanceUpdateStatus}

	// Issue token
	tokenStr, err := authService.GenerateAccessToken(user, roles, perms, "")
	if err != nil {
		t.Fatalf("failed to generate access token: %v", err)
	}
	if tokenStr == "" {
		t.Fatal("expected non-empty access token string")
	}

	// Validate token
	claims, err := authService.ValidateAccessToken(tokenStr)
	if err != nil {
		t.Fatalf("failed to validate access token: %v", err)
	}

	if claims.UserID != user.ID {
		t.Errorf("expected user ID %s, got %s", user.ID, claims.UserID)
	}
	if claims.Email != user.Email {
		t.Errorf("expected email %s, got %s", user.Email, claims.Email)
	}
	if claims.UserType != string(domain.UserTypeStaff) {
		t.Errorf("expected user type %s, got %s", domain.UserTypeStaff, claims.UserType)
	}
	if len(claims.Roles) != 1 || claims.Roles[0] != domain.RoleFieldEngineer {
		t.Errorf("expected roles [%s], got %v", domain.RoleFieldEngineer, claims.Roles)
	}
	if len(claims.Permissions) != 2 {
		t.Errorf("expected 2 permissions, got %d", len(claims.Permissions))
	}

	// Verify 15-minute token lifetime (with slight margin)
	issuedAt := claims.IssuedAt.Time
	expiresAt := claims.ExpiresAt.Time
	duration := expiresAt.Sub(issuedAt)
	if duration < 14*time.Minute || duration > 16*time.Minute {
		t.Errorf("expected token lifetime around %v, got %v", usecases.AccessTokenDuration, duration)
	}

	// Validate tampered token rejected
	tamperedToken := tokenStr + "tampered"
	if _, err := authService.ValidateAccessToken(tamperedToken); err == nil {
		t.Errorf("expected validation to fail for tampered token")
	}

	// Validate completely invalid string
	if _, err := authService.ValidateAccessToken("invalid.bearer.token"); err == nil {
		t.Errorf("expected validation to fail for malformed token string")
	}
}

func TestAuthService_RefreshTokenRotation(t *testing.T) {
	ctx := context.Background()
	repo := repositories.NewMemoryIAMRepository()
	authService := usecases.NewAuthService(repo, "secret-2026", "development")

	// Create test active staff user
	rawPass := "TestPass1234!"
	hash, _ := authService.HashPassword(rawPass)
	user := &domain.User{
		Email:        "ops.chinedu@skygrid.ng",
		PasswordHash: hash,
		UserType:     domain.UserTypeStaff,
		Status:       domain.UserStatusActive,
	}
	if err := repo.CreateUser(ctx, user); err != nil {
		t.Fatalf("failed to create user: %v", err)
	}

	role, _ := repo.GetRoleBySlug(ctx, domain.RoleOperationsManager)
	if err := repo.AssignRoleToUser(ctx, user.ID, role.ID, nil); err != nil {
		t.Fatalf("failed to assign role: %v", err)
	}

	// Login generates initial access and refresh tokens
	loginResp, err := authService.Login(ctx, user.Email, rawPass, "127.0.0.1", "Go-TestClient/1.0")
	if err != nil {
		t.Fatalf("login failed: %v", err)
	}

	rawRefresh1 := loginResp.RefreshToken
	hash1 := authService.HashToken(rawRefresh1)
	session1, err := repo.GetSessionByRefreshHash(ctx, hash1)
	if err != nil {
		t.Fatalf("expected session to exist for hash %s: %v", hash1, err)
	}
	if session1.UserID != user.ID {
		t.Errorf("expected session user %s, got %s", user.ID, session1.UserID)
	}

	// Rotate token
	authResp, err := authService.RefreshToken(ctx, rawRefresh1, "127.0.0.1", "Go-TestClient/1.0")
	if err != nil {
		t.Fatalf("expected successful refresh rotation: %v", err)
	}

	if authResp.AccessToken == "" || authResp.RefreshToken == "" {
		t.Fatalf("expected non-empty tokens in auth response")
	}

	// Verify old session is rejected upon lookup because it was rotated/revoked
	if _, err := repo.GetSessionByRefreshHash(ctx, hash1); err == nil {
		t.Errorf("expected old session lookup to fail after rotation")
	}

	// Reusing the old refresh token MUST fail
	if _, err := authService.RefreshToken(ctx, rawRefresh1, "127.0.0.1", "Go-TestClient/1.0"); err == nil {
		t.Errorf("expected reuse of old refresh token to fail")
	}

	// Refreshing with the new rotated token succeeds
	authResp2, err := authService.RefreshToken(ctx, authResp.RefreshToken, "127.0.0.1", "Go-TestClient/1.0")
	if err != nil {
		t.Fatalf("expected rotation of new refresh token to succeed: %v", err)
	}
	if authResp2.AccessToken == "" {
		t.Errorf("expected valid access token from second rotation")
	}
}

func TestAuthService_SandboxToken_AllRoles(t *testing.T) {
	repo := repositories.NewMemoryIAMRepository()
	authServiceDev := usecases.NewAuthService(repo, "sandbox-secret-2026", "development")

	rolesToTest := []struct {
		slug            string
		expectedPermMin int
	}{
		{domain.RoleSuperAdmin, 17},
		{domain.RoleOperationsManager, 8},
		{domain.RoleFieldEngineer, 4},
		{domain.RoleFinanceOfficer, 4},
		{domain.RoleCustomerSupport, 4},
		{domain.RoleComplianceAuditor, 3},
		{domain.RoleCustomer, 0},
	}

	for _, tc := range rolesToTest {
		t.Run(tc.slug, func(t *testing.T) {
			tokenStr, claims, err := authServiceDev.GenerateSandboxToken(tc.slug)
			if err != nil {
				t.Fatalf("failed to generate sandbox token for role %s: %v", tc.slug, err)
			}
			if tokenStr == "" {
				t.Fatalf("expected non-empty token string for role %s", tc.slug)
			}
			if len(claims.Roles) != 1 || claims.Roles[0] != tc.slug {
				t.Errorf("expected role [%s], got %v", tc.slug, claims.Roles)
			}
			if len(claims.Permissions) < tc.expectedPermMin {
				t.Errorf("expected at least %d permissions for role %s, got %d", tc.expectedPermMin, tc.slug, len(claims.Permissions))
			}

			// Validate token cryptographically
			parsedClaims, err := authServiceDev.ValidateAccessToken(tokenStr)
			if err != nil {
				t.Fatalf("failed to validate generated sandbox token: %v", err)
			}
			if parsedClaims.UserID != claims.UserID {
				t.Errorf("claims user ID mismatch: %s != %s", parsedClaims.UserID, claims.UserID)
			}
		})
	}

	// Test unsupported role
	if _, _, err := authServiceDev.GenerateSandboxToken("non_existent_role"); !errors.Is(err, usecases.ErrUnsupportedRole) {
		t.Errorf("expected ErrUnsupportedRole, got %v", err)
	}

	// Test sandbox token blocked in production environment
	authServiceProd := usecases.NewAuthService(repo, "prod-secret-2026", "production")
	if _, _, err := authServiceProd.GenerateSandboxToken(domain.RoleSuperAdmin); err != usecases.ErrSandboxDisabledInProd {
		t.Errorf("expected ErrSandboxDisabledInProd in production, got %v", err)
	}

	// Test uppercase production string also blocks
	authServiceProdUpper := usecases.NewAuthService(repo, "prod-secret-2026", "PRODUCTION")
	if _, _, err := authServiceProdUpper.GenerateSandboxToken(domain.RoleSuperAdmin); err != usecases.ErrSandboxDisabledInProd {
		t.Errorf("expected ErrSandboxDisabledInProd in PRODUCTION, got %v", err)
	}
}
