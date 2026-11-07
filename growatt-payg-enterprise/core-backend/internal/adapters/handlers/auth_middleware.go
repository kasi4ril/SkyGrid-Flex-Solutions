// Package handlers provides HTTP transport adapters, routing, and security middleware.
package handlers

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"strings"

	"github.com/SkyGrid-Flex-Solutions/growatt-payg-enterprise/core-backend/internal/domain"
	"github.com/SkyGrid-Flex-Solutions/growatt-payg-enterprise/core-backend/internal/usecases"
)

type contextKey string

const claimsContextKey contextKey = "skygrid_auth_claims"

// WithClaims injects AuthClaims into context.
func WithClaims(ctx context.Context, claims *usecases.AuthClaims) context.Context {
	return context.WithValue(ctx, claimsContextKey, claims)
}

// GetClaims extracts AuthClaims from context.
func GetClaims(ctx context.Context) (*usecases.AuthClaims, bool) {
	claims, ok := ctx.Value(claimsContextKey).(*usecases.AuthClaims)
	return claims, ok && claims != nil
}

// AuthMiddleware encapsulates authentication, RBAC authorization, and customer isolation middleware.
type AuthMiddleware struct {
	authService *usecases.AuthService
}

// NewAuthMiddleware constructs the enterprise security middleware handler.
func NewAuthMiddleware(authService *usecases.AuthService) *AuthMiddleware {
	return &AuthMiddleware{authService: authService}
}

// AuthenticateJWT parses and validates the Authorization Bearer JWT.
// Attaches validated claims to context or returns 401 Unauthorized.
func (m *AuthMiddleware) AuthenticateJWT(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		authHeader := r.Header.Get("Authorization")
		if authHeader == "" {
			writeJSONError(w, http.StatusUnauthorized, "missing authorization header")
			return
		}

		parts := strings.SplitN(authHeader, " ", 2)
		if len(parts) != 2 || !strings.EqualFold(parts[0], "Bearer") {
			writeJSONError(w, http.StatusUnauthorized, "invalid authorization header format; expected 'Bearer <token>'")
			return
		}

		claims, err := m.authService.ValidateAccessToken(parts[1])
		if err != nil {
			log.Printf("[SECURITY] JWT Validation Failed: %v (IP: %s)", err, r.RemoteAddr)
			writeJSONError(w, http.StatusUnauthorized, "unauthorized: "+err.Error())
			return
		}

		ctx := WithClaims(r.Context(), claims)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

// AuthenticateJWTFunc is a convenience wrapper for http.HandlerFunc endpoints.
func (m *AuthMiddleware) AuthenticateJWTFunc(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		m.AuthenticateJWT(next).ServeHTTP(w, r)
	}
}

// RequirePermission enforces granular capability checks based on the user's permission set.
// Automatically allows Super Administrators.
func (m *AuthMiddleware) RequirePermission(permissionSlug string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			claims, ok := GetClaims(r.Context())
			if !ok {
				writeJSONError(w, http.StatusUnauthorized, "unauthorized: no active authentication context")
				return
			}

			// Super Admin override
			for _, role := range claims.Roles {
				if role == domain.RoleSuperAdmin {
					next.ServeHTTP(w, r)
					return
				}
			}

			// Check permission set
			hasPerm := false
			for _, perm := range claims.Permissions {
				if perm == permissionSlug {
					hasPerm = true
					break
				}
			}

			if !hasPerm {
				log.Printf("[SECURITY_AUDIT] Unauthorized Access Blocked: User %s (%s) lacks permission '%s' on %s %s (IP: %s)",
					claims.UserID, claims.Email, permissionSlug, r.Method, r.URL.Path, r.RemoteAddr)

				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusForbidden)
				_ = json.NewEncoder(w).Encode(map[string]any{
					"status":             "error",
					"error_code":         "FORBIDDEN_INSUFFICIENT_PERMISSION",
					"message":            "forbidden: missing required permission: " + permissionSlug,
					"required_permission": permissionSlug,
				})
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}

// RequirePermissionFunc wraps an http.HandlerFunc with permission validation.
func (m *AuthMiddleware) RequirePermissionFunc(permissionSlug string, next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		m.RequirePermission(permissionSlug)(next).ServeHTTP(w, r)
	}
}

// EnforceCustomerIsolation ensures PAYG customers can only access their own data.
// Staff members with 'customers.view' or 'super_admin' bypass this constraint.
func (m *AuthMiddleware) EnforceCustomerIsolation(customerIDParam string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			claims, ok := GetClaims(r.Context())
			if !ok {
				writeJSONError(w, http.StatusUnauthorized, "unauthorized: missing claims")
				return
			}

			// Super Admin or Staff with customers.view can inspect all customer assets
			isStaffWithView := false
			for _, role := range claims.Roles {
				if role == domain.RoleSuperAdmin {
					isStaffWithView = true
					break
				}
			}
			if !isStaffWithView {
				for _, perm := range claims.Permissions {
					if perm == domain.PermCustomersView {
						isStaffWithView = true
						break
					}
				}
			}

			if isStaffWithView {
				next.ServeHTTP(w, r)
				return
			}

			// For Customer users, verify requested ID matches authenticated claims
			targetID := r.URL.Query().Get(customerIDParam)
			if targetID == "" {
				// Fallback to checking URL path segments
				parts := strings.Split(strings.Trim(r.URL.Path, "/"), "/")
				if len(parts) > 0 {
					targetID = parts[len(parts)-1]
				}
			}

			if claims.CustomerID == "" || (targetID != "" && targetID != claims.CustomerID) {
				log.Printf("[SECURITY_ALERT] Cross-Tenant Customer Isolation Violation: User %s (Customer: %s) attempted to access target '%s' (IP: %s)",
					claims.UserID, claims.CustomerID, targetID, r.RemoteAddr)

				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusForbidden)
				_ = json.NewEncoder(w).Encode(map[string]any{
					"status":     "error",
					"error_code": "CUSTOMER_ISOLATION_VIOLATION",
					"message":    "forbidden: customer isolation policy violation",
				})
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}

// EnforceCustomerIsolationFunc wraps an http.HandlerFunc with customer tenant isolation.
func (m *AuthMiddleware) EnforceCustomerIsolationFunc(customerIDParam string, next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		m.EnforceCustomerIsolation(customerIDParam)(next).ServeHTTP(w, r)
	}
}
