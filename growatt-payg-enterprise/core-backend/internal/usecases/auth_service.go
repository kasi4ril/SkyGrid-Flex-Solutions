// Package usecases implements core application business logic.
package usecases

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"

	"github.com/SkyGrid-Flex-Solutions/growatt-payg-enterprise/core-backend/internal/adapters/repositories"
	"github.com/SkyGrid-Flex-Solutions/growatt-payg-enterprise/core-backend/internal/domain"
)

var (
	ErrInvalidCredentials     = errors.New("invalid email or password")
	ErrAccountNotActive       = errors.New("account is not active or pending approval")
	ErrUserNotFound           = errors.New("user not found")
	ErrInvalidToken           = errors.New("invalid or malformed token")
	ErrTokenExpired           = errors.New("token has expired")
	ErrSandboxDisabledInProd  = errors.New("sandbox impersonation disabled in production environment")
	ErrUnsupportedRole        = errors.New("unsupported enterprise role slug")
)

const (
	BcryptCost            = 12
	AccessTokenDuration   = 15 * time.Minute
	RefreshTokenDuration  = 7 * 24 * time.Hour
)

// AuthClaims embeds standard registered claims alongside enterprise RBAC payloads.
type AuthClaims struct {
	UserID      string   `json:"user_id"`
	Email       string   `json:"email"`
	UserType    string   `json:"user_type"`
	Roles       []string `json:"roles"`
	Permissions []string `json:"permissions"`
	CustomerID  string   `json:"customer_id,omitempty"`
	jwt.RegisteredClaims
}

// AuthResponse returns issued tokens and user identity summary.
type AuthResponse struct {
	AccessToken      string       `json:"access_token"`
	RefreshToken     string       `json:"refresh_token"`
	TokenType        string       `json:"token_type"`
	ExpiresInSeconds int64        `json:"expires_in_seconds"`
	User             *domain.User `json:"user"`
	Roles            []string     `json:"roles"`
	Permissions      []string     `json:"permissions"`
}

// AuthService orchestrates JWT token issuance, password security, and RBAC authorization.
type AuthService struct {
	repo      repositories.IAMRepository
	jwtSecret []byte
	env       string
}

// NewAuthService constructs the enterprise authentication use-case service.
func NewAuthService(repo repositories.IAMRepository, jwtSecret string, env string) *AuthService {
	if jwtSecret == "" {
		jwtSecret = "skygrid-enterprise-jwt-master-secret-key-2026-production-ready"
	}
	if env == "" {
		env = "development"
	}
	return &AuthService{
		repo:      repo,
		jwtSecret: []byte(jwtSecret),
		env:       env,
	}
}

// ----------------------------------------------------------------------------
// 1. Password Hashing (bcrypt cost 12)
// ----------------------------------------------------------------------------

// HashPassword hashes a raw password using bcrypt with cost 12.
func (s *AuthService) HashPassword(password string) (string, error) {
	if len(password) < 8 {
		return "", errors.New("password must be at least 8 characters long")
	}
	bytes, err := bcrypt.GenerateFromPassword([]byte(password), BcryptCost)
	if err != nil {
		return "", fmt.Errorf("failed to hash password: %w", err)
	}
	return string(bytes), nil
}

// CheckPasswordHash compares a plaintext password with a bcrypt hash.
func (s *AuthService) CheckPasswordHash(password, hash string) bool {
	err := bcrypt.CompareHashAndPassword([]byte(hash), []byte(password))
	return err == nil
}

// ----------------------------------------------------------------------------
// 2. JWT Issuance & Verification (HS256, 15-Minute Expiry)
// ----------------------------------------------------------------------------

// GenerateAccessToken issues an HS256-signed 15-minute access token embedding user_id, user_type, roles[], permissions[].
func (s *AuthService) GenerateAccessToken(
	user *domain.User,
	roles []string,
	permissions []string,
	customerID string,
) (string, error) {
	now := time.Now().UTC()
	claims := AuthClaims{
		UserID:      user.ID,
		Email:       user.Email,
		UserType:    string(user.UserType),
		Roles:       roles,
		Permissions: permissions,
		CustomerID:  customerID,
		RegisteredClaims: jwt.RegisteredClaims{
			Issuer:    "skygrid-payg-iam",
			Subject:   user.ID,
			Audience:  jwt.ClaimStrings{"skygrid-api"},
			IssuedAt:  jwt.NewNumericDate(now),
			NotBefore: jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(now.Add(AccessTokenDuration)),
			ID:        newRandomHex(16),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	signed, err := token.SignedString(s.jwtSecret)
	if err != nil {
		return "", fmt.Errorf("failed to sign access token: %w", err)
	}
	return signed, nil
}

// ValidateAccessToken parses and cryptographically verifies an access token.
func (s *AuthService) ValidateAccessToken(tokenStr string) (*AuthClaims, error) {
	token, err := jwt.ParseWithClaims(tokenStr, &AuthClaims{}, func(t *jwt.Token) (any, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", t.Header["alg"])
		}
		return s.jwtSecret, nil
	})
	if err != nil {
		return nil, fmt.Errorf("%w: %v", ErrInvalidToken, err)
	}

	claims, ok := token.Claims.(*AuthClaims)
	if !ok || !token.Valid {
		return nil, ErrInvalidToken
	}

	if claims.ExpiresAt != nil && time.Now().UTC().After(claims.ExpiresAt.Time) {
		return nil, ErrTokenExpired
	}

	return claims, nil
}

// ----------------------------------------------------------------------------
// 3. Refresh Token Rotation (SHA-256 Hashing Stored in Sessions)
// ----------------------------------------------------------------------------

// GenerateRefreshToken generates a secure 32-byte hex token and its SHA-256 hash.
func (s *AuthService) GenerateRefreshToken() (plainToken string, hash string, err error) {
	token := newRandomHex(32)
	hash = s.HashToken(token)
	return token, hash, nil
}

// HashToken computes the SHA-256 digest of a raw token string.
func (s *AuthService) HashToken(token string) string {
	h := sha256.Sum256([]byte(token))
	return hex.EncodeToString(h[:])
}

// Login authenticates credentials and returns a new access + refresh token pair.
func (s *AuthService) Login(
	ctx context.Context,
	email, password, ipAddress, userAgent string,
) (*AuthResponse, error) {
	cleanEmail := strings.TrimSpace(strings.ToLower(email))
	user, err := s.repo.GetUserByEmail(ctx, cleanEmail)
	if err != nil {
		return nil, ErrInvalidCredentials
	}

	if !s.CheckPasswordHash(password, user.PasswordHash) {
		return nil, ErrInvalidCredentials
	}

	if user.Status != domain.UserStatusActive {
		return nil, ErrAccountNotActive
	}

	// Fetch roles & permissions
	roles, err := s.repo.GetUserRoles(ctx, user.ID)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch user roles: %w", err)
	}
	roleSlugs := make([]string, 0, len(roles))
	for _, r := range roles {
		roleSlugs = append(roleSlugs, r.Slug)
	}

	perms, err := s.repo.GetUserPermissions(ctx, user.ID)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch user permissions: %w", err)
	}

	// Issue Access Token
	accessToken, err := s.GenerateAccessToken(user, roleSlugs, perms, "")
	if err != nil {
		return nil, err
	}

	// Issue Refresh Token & Store Session
	plainRefresh, refreshHash, err := s.GenerateRefreshToken()
	if err != nil {
		return nil, err
	}

	session := &domain.Session{
		UserID:           user.ID,
		RefreshTokenHash: refreshHash,
		IPAddress:        ipAddress,
		UserAgent:        userAgent,
		ExpiresAt:        time.Now().UTC().Add(RefreshTokenDuration),
	}
	if err := s.repo.CreateSession(ctx, session); err != nil {
		return nil, fmt.Errorf("failed to create session: %w", err)
	}

	return &AuthResponse{
		AccessToken:      accessToken,
		RefreshToken:     plainRefresh,
		TokenType:        "Bearer",
		ExpiresInSeconds: int64(AccessTokenDuration.Seconds()),
		User:             user,
		Roles:            roleSlugs,
		Permissions:      perms,
	}, nil
}

// RefreshToken implements single-use Refresh Token rotation.
func (s *AuthService) RefreshToken(
	ctx context.Context,
	rawRefreshToken, ipAddress, userAgent string,
) (*AuthResponse, error) {
	refreshHash := s.HashToken(rawRefreshToken)
	session, err := s.repo.GetSessionByRefreshHash(ctx, refreshHash)
	if err != nil {
		return nil, fmt.Errorf("invalid or expired refresh token: %w", err)
	}

	user, err := s.repo.GetUserByID(ctx, session.UserID)
	if err != nil {
		return nil, ErrUserNotFound
	}

	if user.Status != domain.UserStatusActive {
		return nil, ErrAccountNotActive
	}

	roles, err := s.repo.GetUserRoles(ctx, user.ID)
	if err != nil {
		return nil, err
	}
	roleSlugs := make([]string, 0, len(roles))
	for _, r := range roles {
		roleSlugs = append(roleSlugs, r.Slug)
	}

	perms, err := s.repo.GetUserPermissions(ctx, user.ID)
	if err != nil {
		return nil, err
	}

	// Issue new access token
	newAccessToken, err := s.GenerateAccessToken(user, roleSlugs, perms, "")
	if err != nil {
		return nil, err
	}

	// Issue new refresh token & rotate session
	newPlainRefresh, newRefreshHash, err := s.GenerateRefreshToken()
	if err != nil {
		return nil, err
	}

	newSession := &domain.Session{
		UserID:           user.ID,
		RefreshTokenHash: newRefreshHash,
		IPAddress:        ipAddress,
		UserAgent:        userAgent,
		ExpiresAt:        time.Now().UTC().Add(RefreshTokenDuration),
	}
	if err := s.repo.RotateSession(ctx, session.ID, newSession); err != nil {
		return nil, fmt.Errorf("failed to rotate session: %w", err)
	}

	return &AuthResponse{
		AccessToken:      newAccessToken,
		RefreshToken:     newPlainRefresh,
		TokenType:        "Bearer",
		ExpiresInSeconds: int64(AccessTokenDuration.Seconds()),
		User:             user,
		Roles:            roleSlugs,
		Permissions:      perms,
	}, nil
}

// Logout revokes the session matching the given refresh token.
func (s *AuthService) Logout(ctx context.Context, rawRefreshToken string) error {
	refreshHash := s.HashToken(rawRefreshToken)
	session, err := s.repo.GetSessionByRefreshHash(ctx, refreshHash)
	if err != nil {
		return nil // idempotent logout
	}
	return s.repo.RevokeSession(ctx, session.ID)
}

// ----------------------------------------------------------------------------
// 4. Sandbox Impersonate Helper (Active ONLY when ENV != "production")
// ----------------------------------------------------------------------------

// GenerateSandboxToken issues an instant developer access token for any of the 7 enterprise roles.
// Strictly disabled in production.
func (s *AuthService) GenerateSandboxToken(roleSlug string) (string, *AuthClaims, error) {
	if strings.EqualFold(s.env, "production") {
		return "", nil, ErrSandboxDisabledInProd
	}

	roleSlug = strings.TrimSpace(strings.ToLower(roleSlug))
	role, err := s.repo.GetRoleBySlug(context.Background(), roleSlug)
	if err != nil {
		return "", nil, fmt.Errorf("%w: %s", ErrUnsupportedRole, roleSlug)
	}

	perms, err := s.repo.GetRolePermissions(context.Background(), role.ID)
	if err != nil {
		return "", nil, fmt.Errorf("failed to fetch role permissions: %w", err)
	}
	permSlugs := make([]string, 0, len(perms))
	for _, p := range perms {
		permSlugs = append(permSlugs, p.Slug)
	}

	simulatedUser := &domain.User{
		ID:        fmt.Sprintf("sandbox-user-%s-001", roleSlug),
		Email:     fmt.Sprintf("sandbox.%s@skygrid.energy", roleSlug),
		UserType:  domain.UserTypeStaff,
		Status:    domain.UserStatusActive,
		CreatedAt: time.Now().UTC(),
		UpdatedAt: time.Now().UTC(),
	}
	customerID := ""
	if roleSlug == domain.RoleCustomer {
		simulatedUser.UserType = domain.UserTypeCustomer
		customerID = "CUST-NG-ABUJA-00421"
	}

	tokenStr, err := s.GenerateAccessToken(simulatedUser, []string{role.Slug}, permSlugs, customerID)
	if err != nil {
		return "", nil, err
	}

	claims, err := s.ValidateAccessToken(tokenStr)
	if err != nil {
		return "", nil, err
	}

	return tokenStr, claims, nil
}

// newRandomHex returns cryptographically secure random bytes encoded as hex string.
func newRandomHex(nBytes int) string {
	b := make([]byte, nBytes)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}
