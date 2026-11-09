// Package repositories provides PostgreSQL persistence adapters for IAM, RBAC,
// and enterprise ERP workflows with automatic in-memory fallback.
package repositories

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"strings"
	"time"

	_ "github.com/lib/pq"
	"github.com/SkyGrid-Flex-Solutions/growatt-payg-enterprise/core-backend/internal/domain"
)

// ============================================================================
// 1. POSTGRES CONNECTION MANAGER & MIGRATION RUNNER
// ============================================================================

// PostgresDB manages connection pooling and migration execution for PostgreSQL.
type PostgresDB struct {
	db *sql.DB
}

// NewPostgresDB opens a connection pool to PostgreSQL using DATABASE_URL / POSTGRES_DSN.
// Returns nil, nil if the DSN string is empty (triggering zero-config memory fallback).
func NewPostgresDB(dsn string) (*PostgresDB, error) {
	cleanDSN := strings.TrimSpace(dsn)
	if cleanDSN == "" {
		return nil, nil
	}

	db, err := sql.Open("postgres", cleanDSN)
	if err != nil {
		return nil, fmt.Errorf("failed to open postgres connection: %w", err)
	}

	// Production connection pool tuning
	db.SetMaxOpenConns(25)
	db.SetMaxIdleConns(10)
	db.SetConnMaxLifetime(5 * time.Minute)

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := db.PingContext(ctx); err != nil {
		db.Close()
		return nil, fmt.Errorf("postgres ping verification failed: %w", err)
	}

	log.Printf("[POSTGRES] Connection pool established (max_open=25, max_idle=10, max_lifetime=5m)")
	return &PostgresDB{db: db}, nil
}

// DB returns the underlying *sql.DB pool.
func (p *PostgresDB) DB() *sql.DB {
	if p == nil {
		return nil
	}
	return p.db
}

// Close gracefully terminates the connection pool.
func (p *PostgresDB) Close() error {
	if p == nil || p.db == nil {
		return nil
	}
	return p.db.Close()
}

// RunMigrations executes all SQL migrations idempotently in sequence.
func (p *PostgresDB) RunMigrations(ctx context.Context, migrationDirs ...string) error {
	if p == nil || p.db == nil {
		return nil
	}

	// 1. Initialize schema_migrations tracking table
	_, err := p.db.ExecContext(ctx, `
		CREATE TABLE IF NOT EXISTS schema_migrations (
			version VARCHAR(100) PRIMARY KEY,
			applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		);
	`)
	if err != nil {
		return fmt.Errorf("failed creating schema_migrations ledger: %w", err)
	}

	// 2. Discover migrations folder
	candidateDirs := []string{
		"migrations",
		"core-backend/migrations",
		"../migrations",
		"../../migrations",
	}
	if len(migrationDirs) > 0 && migrationDirs[0] != "" {
		candidateDirs = append([]string{migrationDirs[0]}, candidateDirs...)
	}

	var foundDir string
	for _, dir := range candidateDirs {
		if stat, err := os.Stat(dir); err == nil && stat.IsDir() {
			if _, err := os.Stat(filepath.Join(dir, "001_init_schema.sql")); err == nil {
				foundDir = dir
				break
			}
		}
	}

	if foundDir == "" {
		log.Printf("[POSTGRES-MIGRATION] Migration directory not found in candidate paths; skipping auto-migration")
		return nil
	}

	targetMigrations := []string{
		"001_init_schema.sql",
		"002_enterprise_iam_rbac_erp.sql",
		"003_enterprise_erp_workflows.sql",
		"005_analytics_storyteller_aggregation.sql",
	}

	for _, filename := range targetMigrations {
		var exists int
		err := p.db.QueryRowContext(ctx, "SELECT COUNT(*) FROM schema_migrations WHERE version = $1", filename).Scan(&exists)
		if err == nil && exists > 0 {
			continue // Migration already applied
		}

		filePath := filepath.Join(foundDir, filename)
		contentBytes, err := os.ReadFile(filePath)
		if err != nil {
			log.Printf("[POSTGRES-MIGRATION] Warning: cannot read %s: %v", filePath, err)
			continue
		}

		// Execute migration inside transactional envelope
		tx, err := p.db.BeginTx(ctx, nil)
		if err != nil {
			return fmt.Errorf("failed to begin transaction for %s: %w", filename, err)
		}

		if _, err := tx.ExecContext(ctx, string(contentBytes)); err != nil {
			tx.Rollback()
			return fmt.Errorf("failed executing migration %s: %w", filename, err)
		}

		if _, err := tx.ExecContext(ctx, `
			INSERT INTO schema_migrations (version, applied_at)
			VALUES ($1, NOW())
			ON CONFLICT (version) DO NOTHING;
		`, filename); err != nil {
			tx.Rollback()
			return fmt.Errorf("failed recording applied migration %s: %w", filename, err)
		}

		if err := tx.Commit(); err != nil {
			return fmt.Errorf("failed committing transaction for %s: %w", filename, err)
		}

		log.Printf("[POSTGRES-MIGRATION] Successfully executed migration: %s", filename)
	}

	return nil
}

// ============================================================================
// 2. POSTGRES IAM REPOSITORY
// ============================================================================

// PostgresIAMRepository handles persistent identity, roles, and onboarding in PostgreSQL.
type PostgresIAMRepository struct {
	db       *sql.DB
	fallback *MemoryIAMRepository
}

// NewPostgresIAMRepository wraps PostgreSQL persistence with an in-memory fallback.
func NewPostgresIAMRepository(db *sql.DB, fallback *MemoryIAMRepository) *PostgresIAMRepository {
	if fallback == nil {
		fallback = NewMemoryIAMRepository()
	}
	return &PostgresIAMRepository{
		db:       db,
		fallback: fallback,
	}
}

// NewIAMRepository creates an IAMRepository that uses Postgres when db != nil or memory otherwise.
func NewIAMRepository(db *sql.DB) IAMRepository {
	mem := NewMemoryIAMRepository()
	if db != nil {
		return NewPostgresIAMRepository(db, mem)
	}
	return mem
}

func (r *PostgresIAMRepository) CreateUser(ctx context.Context, u *domain.User) error {
	if r.db == nil {
		return r.fallback.CreateUser(ctx, u)
	}

	if u.ID == "" {
		u.ID = newUUID()
	}
	now := time.Now().UTC()
	if u.CreatedAt.IsZero() {
		u.CreatedAt = now
	}
	u.UpdatedAt = now

	query := `
		INSERT INTO users (id, email, phone, password_hash, user_type, status, email_verified_at, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
	`
	var phone sql.NullString
	if u.Phone != "" {
		phone = sql.NullString{String: u.Phone, Valid: true}
	}

	_, err := r.db.ExecContext(ctx, query,
		u.ID,
		u.Email,
		phone,
		u.PasswordHash,
		string(u.UserType),
		string(u.Status),
		u.EmailVerifiedAt,
		u.CreatedAt,
		u.UpdatedAt,
	)
	if err != nil {
		if strings.Contains(err.Error(), "duplicate key") || strings.Contains(err.Error(), "unique") {
			return ErrUserAlreadyExists
		}
		return err
	}

	_ = r.fallback.CreateUser(ctx, u)
	return nil
}

func (r *PostgresIAMRepository) GetUserByID(ctx context.Context, id string) (*domain.User, error) {
	if r.db == nil {
		return r.fallback.GetUserByID(ctx, id)
	}

	query := `
		SELECT id, email, phone, password_hash, user_type, status, email_verified_at, created_at, updated_at
		FROM users
		WHERE id = $1
	`
	row := r.db.QueryRowContext(ctx, query, id)

	var u domain.User
	var phone sql.NullString
	var userType, status string
	var emailVerifiedAt sql.NullTime

	err := row.Scan(
		&u.ID,
		&u.Email,
		&phone,
		&u.PasswordHash,
		&userType,
		&status,
		&emailVerifiedAt,
		&u.CreatedAt,
		&u.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return r.fallback.GetUserByID(ctx, id)
		}
		return nil, err
	}

	if phone.Valid {
		u.Phone = phone.String
	}
	u.UserType = domain.UserType(userType)
	u.Status = domain.UserStatus(status)
	if emailVerifiedAt.Valid {
		t := emailVerifiedAt.Time
		u.EmailVerifiedAt = &t
	}

	return &u, nil
}

func (r *PostgresIAMRepository) GetUserByEmail(ctx context.Context, email string) (*domain.User, error) {
	if r.db == nil {
		return r.fallback.GetUserByEmail(ctx, email)
	}

	query := `
		SELECT id, email, phone, password_hash, user_type, status, email_verified_at, created_at, updated_at
		FROM users
		WHERE LOWER(email) = LOWER($1)
	`
	row := r.db.QueryRowContext(ctx, query, strings.TrimSpace(email))

	var u domain.User
	var phone sql.NullString
	var userType, status string
	var emailVerifiedAt sql.NullTime

	err := row.Scan(
		&u.ID,
		&u.Email,
		&phone,
		&u.PasswordHash,
		&userType,
		&status,
		&emailVerifiedAt,
		&u.CreatedAt,
		&u.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return r.fallback.GetUserByEmail(ctx, email)
		}
		return nil, err
	}

	if phone.Valid {
		u.Phone = phone.String
	}
	u.UserType = domain.UserType(userType)
	u.Status = domain.UserStatus(status)
	if emailVerifiedAt.Valid {
		t := emailVerifiedAt.Time
		u.EmailVerifiedAt = &t
	}

	return &u, nil
}

func (r *PostgresIAMRepository) GetUserByPhone(ctx context.Context, phone string) (*domain.User, error) {
	if r.db == nil {
		return r.fallback.GetUserByPhone(ctx, phone)
	}

	query := `
		SELECT id, email, phone, password_hash, user_type, status, email_verified_at, created_at, updated_at
		FROM users
		WHERE phone = $1
	`
	row := r.db.QueryRowContext(ctx, query, strings.TrimSpace(phone))

	var u domain.User
	var phoneVal sql.NullString
	var userType, status string
	var emailVerifiedAt sql.NullTime

	err := row.Scan(
		&u.ID,
		&u.Email,
		&phoneVal,
		&u.PasswordHash,
		&userType,
		&status,
		&emailVerifiedAt,
		&u.CreatedAt,
		&u.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return r.fallback.GetUserByPhone(ctx, phone)
		}
		return nil, err
	}

	if phoneVal.Valid {
		u.Phone = phoneVal.String
	}
	u.UserType = domain.UserType(userType)
	u.Status = domain.UserStatus(status)
	if emailVerifiedAt.Valid {
		t := emailVerifiedAt.Time
		u.EmailVerifiedAt = &t
	}

	return &u, nil
}

func (r *PostgresIAMRepository) UpdateUserPassword(ctx context.Context, userID, newPasswordHash string) error {
	if r.db == nil {
		return r.fallback.UpdateUserPassword(ctx, userID, newPasswordHash)
	}

	query := `UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2`
	_, err := r.db.ExecContext(ctx, query, newPasswordHash, userID)
	if err != nil {
		return err
	}
	_ = r.fallback.UpdateUserPassword(ctx, userID, newPasswordHash)
	return nil
}

func (r *PostgresIAMRepository) UpdateUser(ctx context.Context, u *domain.User) error {
	if r.db == nil {
		return r.fallback.UpdateUser(ctx, u)
	}

	u.UpdatedAt = time.Now().UTC()
	query := `
		UPDATE users
		SET email = $1, phone = $2, password_hash = $3, user_type = $4, status = $5,
		    email_verified_at = $6, updated_at = $7
		WHERE id = $8
	`
	var phone sql.NullString
	if u.Phone != "" {
		phone = sql.NullString{String: u.Phone, Valid: true}
	}

	res, err := r.db.ExecContext(ctx, query,
		u.Email,
		phone,
		u.PasswordHash,
		string(u.UserType),
		string(u.Status),
		u.EmailVerifiedAt,
		u.UpdatedAt,
		u.ID,
	)
	if err != nil {
		return err
	}
	rows, _ := res.RowsAffected()
	if rows == 0 {
		return ErrUserNotFound
	}

	_ = r.fallback.UpdateUser(ctx, u)
	return nil
}

func (r *PostgresIAMRepository) GetRoleBySlug(ctx context.Context, slug string) (*domain.Role, error) {
	if r.db == nil {
		return r.fallback.GetRoleBySlug(ctx, slug)
	}

	query := `SELECT id, slug, name, description, is_system_role, created_at, updated_at FROM roles WHERE slug = $1`
	var role domain.Role
	var desc sql.NullString

	err := r.db.QueryRowContext(ctx, query, slug).Scan(
		&role.ID, &role.Slug, &role.Name, &desc, &role.IsSystemRole, &role.CreatedAt, &role.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return r.fallback.GetRoleBySlug(ctx, slug)
		}
		return nil, err
	}
	if desc.Valid {
		role.Description = desc.String
	}
	return &role, nil
}

func (r *PostgresIAMRepository) GetRoleByID(ctx context.Context, id string) (*domain.Role, error) {
	if r.db == nil {
		return r.fallback.GetRoleByID(ctx, id)
	}

	query := `SELECT id, slug, name, description, is_system_role, created_at, updated_at FROM roles WHERE id = $1`
	var role domain.Role
	var desc sql.NullString

	err := r.db.QueryRowContext(ctx, query, id).Scan(
		&role.ID, &role.Slug, &role.Name, &desc, &role.IsSystemRole, &role.CreatedAt, &role.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return r.fallback.GetRoleByID(ctx, id)
		}
		return nil, err
	}
	if desc.Valid {
		role.Description = desc.String
	}
	return &role, nil
}

func (r *PostgresIAMRepository) ListRoles(ctx context.Context) ([]domain.Role, error) {
	if r.db == nil {
		return r.fallback.ListRoles(ctx)
	}

	rows, err := r.db.QueryContext(ctx, `SELECT id, slug, name, description, is_system_role, created_at, updated_at FROM roles ORDER BY slug ASC`)
	if err != nil {
		return r.fallback.ListRoles(ctx)
	}
	defer rows.Close()

	var result []domain.Role
	for rows.Next() {
		var role domain.Role
		var desc sql.NullString
		if err := rows.Scan(&role.ID, &role.Slug, &role.Name, &desc, &role.IsSystemRole, &role.CreatedAt, &role.UpdatedAt); err == nil {
			if desc.Valid {
				role.Description = desc.String
			}
			result = append(result, role)
		}
	}
	if len(result) == 0 {
		return r.fallback.ListRoles(ctx)
	}
	return result, nil
}

func (r *PostgresIAMRepository) GetRolePermissions(ctx context.Context, roleID string) ([]domain.Permission, error) {
	if r.db == nil {
		return r.fallback.GetRolePermissions(ctx, roleID)
	}

	query := `
		SELECT p.id, p.slug, p.name, p.module, p.created_at
		FROM permissions p
		INNER JOIN role_permissions rp ON rp.permission_id = p.id
		WHERE rp.role_id = $1
		ORDER BY p.slug ASC
	`
	rows, err := r.db.QueryContext(ctx, query, roleID)
	if err != nil {
		return r.fallback.GetRolePermissions(ctx, roleID)
	}
	defer rows.Close()

	var perms []domain.Permission
	for rows.Next() {
		var p domain.Permission
		if err := rows.Scan(&p.ID, &p.Slug, &p.Name, &p.Module, &p.CreatedAt); err == nil {
			perms = append(perms, p)
		}
	}
	if len(perms) == 0 {
		return r.fallback.GetRolePermissions(ctx, roleID)
	}
	return perms, nil
}

func (r *PostgresIAMRepository) GetUserRoles(ctx context.Context, userID string) ([]domain.Role, error) {
	if r.db == nil {
		return r.fallback.GetUserRoles(ctx, userID)
	}

	query := `
		SELECT r.id, r.slug, r.name, r.description, r.is_system_role, r.created_at, r.updated_at
		FROM roles r
		INNER JOIN user_roles ur ON ur.role_id = r.id
		WHERE ur.user_id = $1
	`
	rows, err := r.db.QueryContext(ctx, query, userID)
	if err != nil {
		return r.fallback.GetUserRoles(ctx, userID)
	}
	defer rows.Close()

	var roles []domain.Role
	for rows.Next() {
		var r domain.Role
		var desc sql.NullString
		if err := rows.Scan(&r.ID, &r.Slug, &r.Name, &desc, &r.IsSystemRole, &r.CreatedAt, &r.UpdatedAt); err == nil {
			if desc.Valid {
				r.Description = desc.String
			}
			roles = append(roles, r)
		}
	}
	if len(roles) == 0 {
		return r.fallback.GetUserRoles(ctx, userID)
	}
	return roles, nil
}

func (r *PostgresIAMRepository) GetUserPermissions(ctx context.Context, userID string) ([]string, error) {
	if r.db == nil {
		return r.fallback.GetUserPermissions(ctx, userID)
	}

	query := `
		SELECT DISTINCT p.slug
		FROM permissions p
		INNER JOIN role_permissions rp ON rp.permission_id = p.id
		INNER JOIN user_roles ur ON ur.role_id = rp.role_id
		WHERE ur.user_id = $1
		ORDER BY p.slug ASC
	`
	rows, err := r.db.QueryContext(ctx, query, userID)
	if err != nil {
		return r.fallback.GetUserPermissions(ctx, userID)
	}
	defer rows.Close()

	var perms []string
	for rows.Next() {
		var slug string
		if err := rows.Scan(&slug); err == nil {
			perms = append(perms, slug)
		}
	}
	if len(perms) == 0 {
		return r.fallback.GetUserPermissions(ctx, userID)
	}
	return perms, nil
}

func (r *PostgresIAMRepository) AssignRoleToUser(ctx context.Context, userID, roleID string, assignedByUserID *string) error {
	if r.db == nil {
		return r.fallback.AssignRoleToUser(ctx, userID, roleID, assignedByUserID)
	}

	query := `
		INSERT INTO user_roles (user_id, role_id, assigned_at, assigned_by_user_id)
		VALUES ($1, $2, NOW(), $3)
		ON CONFLICT (user_id, role_id) DO UPDATE SET assigned_at = NOW(), assigned_by_user_id = EXCLUDED.assigned_by_user_id
	`
	_, err := r.db.ExecContext(ctx, query, userID, roleID, assignedByUserID)
	if err != nil {
		return err
	}
	_ = r.fallback.AssignRoleToUser(ctx, userID, roleID, assignedByUserID)
	return nil
}

func (r *PostgresIAMRepository) CreateStaffProfile(ctx context.Context, p *domain.StaffProfile) error {
	if r.db == nil {
		return r.fallback.CreateStaffProfile(ctx, p)
	}

	now := time.Now().UTC()
	if p.CreatedAt.IsZero() {
		p.CreatedAt = now
	}
	p.UpdatedAt = now

	query := `
		INSERT INTO staff_profiles (user_id, employee_code, department, coren_reg_number, assigned_region, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		ON CONFLICT (user_id) DO UPDATE SET
			department = EXCLUDED.department,
			coren_reg_number = EXCLUDED.coren_reg_number,
			assigned_region = EXCLUDED.assigned_region,
			updated_at = NOW()
	`
	var coren sql.NullString
	if p.CorenRegNumber != "" {
		coren = sql.NullString{String: p.CorenRegNumber, Valid: true}
	}

	_, err := r.db.ExecContext(ctx, query, p.UserID, p.EmployeeCode, p.Department, coren, p.AssignedRegion, p.CreatedAt, p.UpdatedAt)
	if err != nil {
		return err
	}
	_ = r.fallback.CreateStaffProfile(ctx, p)
	return nil
}

func (r *PostgresIAMRepository) GetStaffProfile(ctx context.Context, userID string) (*domain.StaffProfile, error) {
	if r.db == nil {
		return r.fallback.GetStaffProfile(ctx, userID)
	}

	query := `SELECT user_id, employee_code, department, coren_reg_number, assigned_region, created_at, updated_at FROM staff_profiles WHERE user_id = $1`
	var p domain.StaffProfile
	var coren sql.NullString

	err := r.db.QueryRowContext(ctx, query, userID).Scan(
		&p.UserID, &p.EmployeeCode, &p.Department, &coren, &p.AssignedRegion, &p.CreatedAt, &p.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return r.fallback.GetStaffProfile(ctx, userID)
		}
		return nil, err
	}
	if coren.Valid {
		p.CorenRegNumber = coren.String
	}
	return &p, nil
}

func (r *PostgresIAMRepository) CreateOnboardingRequest(ctx context.Context, req *domain.StaffOnboardingRequest) error {
	if r.db == nil {
		return r.fallback.CreateOnboardingRequest(ctx, req)
	}

	if req.ID == "" {
		req.ID = newUUID()
	}
	now := time.Now().UTC()
	if req.CreatedAt.IsZero() {
		req.CreatedAt = now
	}
	req.UpdatedAt = now

	query := `
		INSERT INTO staff_onboarding_requests (
			id, applicant_email, applicant_phone, full_name, requested_department,
			coren_reg_number, assigned_region, verification_token_hash, status,
			assigned_role_id, reviewed_by_user_id, review_notes, activation_token_hash,
			token_expires_at, created_at, updated_at
		) VALUES (
			$1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16
		)
	`
	_, err := r.db.ExecContext(ctx, query,
		req.ID, req.ApplicantEmail, req.ApplicantPhone, req.FullName, req.RequestedDepartment,
		req.CorenRegNumber, req.AssignedRegion, req.VerificationTokenHash, string(req.Status),
		req.AssignedRoleID, req.ReviewedByUserID, req.ReviewNotes, req.ActivationTokenHash,
		req.TokenExpiresAt, req.CreatedAt, req.UpdatedAt,
	)
	if err != nil {
		return err
	}
	_ = r.fallback.CreateOnboardingRequest(ctx, req)
	return nil
}

func (r *PostgresIAMRepository) scanOnboarding(row *sql.Row) (*domain.StaffOnboardingRequest, error) {
	var req domain.StaffOnboardingRequest
	var phone, coren, region, vHash, roleID, reviewerID, notes, aHash sql.NullString
	var status string
	var expiresAt sql.NullTime

	err := row.Scan(
		&req.ID, &req.ApplicantEmail, &phone, &req.FullName, &req.RequestedDepartment,
		&coren, &region, &vHash, &status, &roleID, &reviewerID, &notes, &aHash,
		&expiresAt, &req.CreatedAt, &req.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}

	if phone.Valid {
		req.ApplicantPhone = phone.String
	}
	if coren.Valid {
		req.CorenRegNumber = coren.String
	}
	if region.Valid {
		req.AssignedRegion = region.String
	}
	if vHash.Valid {
		req.VerificationTokenHash = vHash.String
	}
	req.Status = domain.OnboardingStatus(status)
	if roleID.Valid {
		s := roleID.String
		req.AssignedRoleID = &s
	}
	if reviewerID.Valid {
		s := reviewerID.String
		req.ReviewedByUserID = &s
	}
	if notes.Valid {
		req.ReviewNotes = notes.String
	}
	if aHash.Valid {
		req.ActivationTokenHash = aHash.String
	}
	if expiresAt.Valid {
		t := expiresAt.Time
		req.TokenExpiresAt = &t
	}
	return &req, nil
}

func (r *PostgresIAMRepository) GetOnboardingRequestByID(ctx context.Context, id string) (*domain.StaffOnboardingRequest, error) {
	if r.db == nil {
		return r.fallback.GetOnboardingRequestByID(ctx, id)
	}

	query := `
		SELECT id, applicant_email, applicant_phone, full_name, requested_department,
		       coren_reg_number, assigned_region, verification_token_hash, status,
		       assigned_role_id, reviewed_by_user_id, review_notes, activation_token_hash,
		       token_expires_at, created_at, updated_at
		FROM staff_onboarding_requests WHERE id = $1
	`
	req, err := r.scanOnboarding(r.db.QueryRowContext(ctx, query, id))
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return r.fallback.GetOnboardingRequestByID(ctx, id)
		}
		return nil, err
	}
	return req, nil
}

func (r *PostgresIAMRepository) GetOnboardingRequestByEmail(ctx context.Context, email string) (*domain.StaffOnboardingRequest, error) {
	if r.db == nil {
		return r.fallback.GetOnboardingRequestByEmail(ctx, email)
	}

	query := `
		SELECT id, applicant_email, applicant_phone, full_name, requested_department,
		       coren_reg_number, assigned_region, verification_token_hash, status,
		       assigned_role_id, reviewed_by_user_id, review_notes, activation_token_hash,
		       token_expires_at, created_at, updated_at
		FROM staff_onboarding_requests WHERE LOWER(applicant_email) = LOWER($1)
	`
	req, err := r.scanOnboarding(r.db.QueryRowContext(ctx, query, strings.TrimSpace(email)))
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return r.fallback.GetOnboardingRequestByEmail(ctx, email)
		}
		return nil, err
	}
	return req, nil
}

func (r *PostgresIAMRepository) GetOnboardingRequestByVerifyTokenHash(ctx context.Context, hash string) (*domain.StaffOnboardingRequest, error) {
	if r.db == nil {
		return r.fallback.GetOnboardingRequestByVerifyTokenHash(ctx, hash)
	}

	query := `
		SELECT id, applicant_email, applicant_phone, full_name, requested_department,
		       coren_reg_number, assigned_region, verification_token_hash, status,
		       assigned_role_id, reviewed_by_user_id, review_notes, activation_token_hash,
		       token_expires_at, created_at, updated_at
		FROM staff_onboarding_requests WHERE verification_token_hash = $1
	`
	req, err := r.scanOnboarding(r.db.QueryRowContext(ctx, query, hash))
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return r.fallback.GetOnboardingRequestByVerifyTokenHash(ctx, hash)
		}
		return nil, err
	}
	return req, nil
}

func (r *PostgresIAMRepository) GetOnboardingRequestByActivationTokenHash(ctx context.Context, hash string) (*domain.StaffOnboardingRequest, error) {
	if r.db == nil {
		return r.fallback.GetOnboardingRequestByActivationTokenHash(ctx, hash)
	}

	query := `
		SELECT id, applicant_email, applicant_phone, full_name, requested_department,
		       coren_reg_number, assigned_region, verification_token_hash, status,
		       assigned_role_id, reviewed_by_user_id, review_notes, activation_token_hash,
		       token_expires_at, created_at, updated_at
		FROM staff_onboarding_requests WHERE activation_token_hash = $1
	`
	req, err := r.scanOnboarding(r.db.QueryRowContext(ctx, query, hash))
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return r.fallback.GetOnboardingRequestByActivationTokenHash(ctx, hash)
		}
		return nil, err
	}
	return req, nil
}

func (r *PostgresIAMRepository) UpdateOnboardingRequest(ctx context.Context, req *domain.StaffOnboardingRequest) error {
	if r.db == nil {
		return r.fallback.UpdateOnboardingRequest(ctx, req)
	}

	req.UpdatedAt = time.Now().UTC()
	query := `
		UPDATE staff_onboarding_requests
		SET applicant_phone = $1, full_name = $2, requested_department = $3,
		    coren_reg_number = $4, assigned_region = $5, verification_token_hash = $6,
		    status = $7, assigned_role_id = $8, reviewed_by_user_id = $9, review_notes = $10,
		    activation_token_hash = $11, token_expires_at = $12, updated_at = $13
		WHERE id = $14
	`
	_, err := r.db.ExecContext(ctx, query,
		req.ApplicantPhone, req.FullName, req.RequestedDepartment, req.CorenRegNumber,
		req.AssignedRegion, req.VerificationTokenHash, string(req.Status), req.AssignedRoleID,
		req.ReviewedByUserID, req.ReviewNotes, req.ActivationTokenHash, req.TokenExpiresAt,
		req.UpdatedAt, req.ID,
	)
	if err != nil {
		return err
	}
	_ = r.fallback.UpdateOnboardingRequest(ctx, req)
	return nil
}

func (r *PostgresIAMRepository) ReviewOnboardingTransaction(
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
	if r.db == nil {
		return r.fallback.ReviewOnboardingTransaction(ctx, reqID, status, roleID, reviewerID, notes, actTokenHash, expiresAt, audit)
	}

	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	query := `
		UPDATE staff_onboarding_requests
		SET status = $1, assigned_role_id = $2, reviewed_by_user_id = $3, review_notes = $4,
		    activation_token_hash = $5, token_expires_at = $6, updated_at = NOW()
		WHERE id = $7
	`
	res, err := tx.ExecContext(ctx, query, string(status), roleID, reviewerID, notes, actTokenHash, expiresAt, reqID)
	if err != nil {
		return err
	}
	if rows, _ := res.RowsAffected(); rows == 0 {
		return ErrOnboardingNotFound
	}

	if audit != nil {
		payloadBytes, _ := json.Marshal(audit.Payload)
		auditQuery := `
			INSERT INTO audit_logs (id, actor_user_id, action, resource_type, resource_id, payload, ip_address, created_at)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		`
		if audit.ID == "" {
			audit.ID = newUUID()
		}
		if audit.CreatedAt.IsZero() {
			audit.CreatedAt = time.Now().UTC()
		}
		if _, err := tx.ExecContext(ctx, auditQuery,
			audit.ID, audit.ActorUserID, audit.Action, audit.ResourceType, audit.ResourceID,
			string(payloadBytes), audit.IPAddress, audit.CreatedAt,
		); err != nil {
			return err
		}
	}

	if err := tx.Commit(); err != nil {
		return err
	}

	_ = r.fallback.ReviewOnboardingTransaction(ctx, reqID, status, roleID, reviewerID, notes, actTokenHash, expiresAt, audit)
	return nil
}

func (r *PostgresIAMRepository) ActivateStaffTransaction(
	ctx context.Context,
	reqID string,
	u *domain.User,
	p *domain.StaffProfile,
	roleID string,
	audit *domain.AuditLog,
) error {
	if r.db == nil {
		return r.fallback.ActivateStaffTransaction(ctx, reqID, u, p, roleID, audit)
	}

	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	// 1. Mark onboarding request ACTIVATED
	if _, err := tx.ExecContext(ctx, `
		UPDATE staff_onboarding_requests
		SET status = 'ACTIVATED', updated_at = NOW()
		WHERE id = $1
	`, reqID); err != nil {
		return err
	}

	// 2. Insert User
	if u.ID == "" {
		u.ID = newUUID()
	}
	now := time.Now().UTC()
	u.CreatedAt = now
	u.UpdatedAt = now
	var phone sql.NullString
	if u.Phone != "" {
		phone = sql.NullString{String: u.Phone, Valid: true}
	}
	if _, err := tx.ExecContext(ctx, `
		INSERT INTO users (id, email, phone, password_hash, user_type, status, email_verified_at, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
	`, u.ID, u.Email, phone, u.PasswordHash, string(u.UserType), string(u.Status), u.EmailVerifiedAt, u.CreatedAt, u.UpdatedAt); err != nil {
		return err
	}

	// 3. Insert Staff Profile
	p.UserID = u.ID
	p.CreatedAt = now
	p.UpdatedAt = now
	var coren sql.NullString
	if p.CorenRegNumber != "" {
		coren = sql.NullString{String: p.CorenRegNumber, Valid: true}
	}
	if _, err := tx.ExecContext(ctx, `
		INSERT INTO staff_profiles (user_id, employee_code, department, coren_reg_number, assigned_region, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
	`, p.UserID, p.EmployeeCode, p.Department, coren, p.AssignedRegion, p.CreatedAt, p.UpdatedAt); err != nil {
		return err
	}

	// 4. Assign Role
	if roleID != "" {
		if _, err := tx.ExecContext(ctx, `
			INSERT INTO user_roles (user_id, role_id, assigned_at)
			VALUES ($1, $2, NOW())
			ON CONFLICT (user_id, role_id) DO NOTHING
		`, u.ID, roleID); err != nil {
			return err
		}
	}

	// 5. Audit Log
	if audit != nil {
		payloadBytes, _ := json.Marshal(audit.Payload)
		if audit.ID == "" {
			audit.ID = newUUID()
		}
		if audit.CreatedAt.IsZero() {
			audit.CreatedAt = now
		}
		if _, err := tx.ExecContext(ctx, `
			INSERT INTO audit_logs (id, actor_user_id, action, resource_type, resource_id, payload, ip_address, created_at)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		`, audit.ID, audit.ActorUserID, audit.Action, audit.ResourceType, audit.ResourceID, string(payloadBytes), audit.IPAddress, audit.CreatedAt); err != nil {
			return err
		}
	}

	if err := tx.Commit(); err != nil {
		return err
	}

	_ = r.fallback.ActivateStaffTransaction(ctx, reqID, u, p, roleID, audit)
	return nil
}

func (r *PostgresIAMRepository) CreateSession(ctx context.Context, s *domain.Session) error {
	if r.db == nil {
		return r.fallback.CreateSession(ctx, s)
	}

	if s.ID == "" {
		s.ID = newUUID()
	}
	now := time.Now().UTC()
	if s.CreatedAt.IsZero() {
		s.CreatedAt = now
	}
	s.UpdatedAt = now

	query := `
		INSERT INTO sessions (id, user_id, refresh_token_hash, ip_address, user_agent, expires_at, revoked_at, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
	`
	_, err := r.db.ExecContext(ctx, query,
		s.ID, s.UserID, s.RefreshTokenHash, s.IPAddress, s.UserAgent, s.ExpiresAt, s.RevokedAt, s.CreatedAt, s.UpdatedAt,
	)
	if err != nil {
		return err
	}
	_ = r.fallback.CreateSession(ctx, s)
	return nil
}

func (r *PostgresIAMRepository) GetSessionByRefreshHash(ctx context.Context, hash string) (*domain.Session, error) {
	if r.db == nil {
		return r.fallback.GetSessionByRefreshHash(ctx, hash)
	}

	query := `
		SELECT id, user_id, refresh_token_hash, ip_address, user_agent, expires_at, revoked_at, created_at, updated_at
		FROM sessions WHERE refresh_token_hash = $1
	`
	var s domain.Session
	var ip, ua sql.NullString
	var revoked sql.NullTime

	err := r.db.QueryRowContext(ctx, query, hash).Scan(
		&s.ID, &s.UserID, &s.RefreshTokenHash, &ip, &ua, &s.ExpiresAt, &revoked, &s.CreatedAt, &s.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return r.fallback.GetSessionByRefreshHash(ctx, hash)
		}
		return nil, err
	}
	if ip.Valid {
		s.IPAddress = ip.String
	}
	if ua.Valid {
		s.UserAgent = ua.String
	}
	if revoked.Valid {
		t := revoked.Time
		s.RevokedAt = &t
	}
	return &s, nil
}

func (r *PostgresIAMRepository) RevokeSession(ctx context.Context, id string) error {
	if r.db == nil {
		return r.fallback.RevokeSession(ctx, id)
	}

	_, err := r.db.ExecContext(ctx, `UPDATE sessions SET revoked_at = NOW(), updated_at = NOW() WHERE id = $1`, id)
	if err != nil {
		return err
	}
	_ = r.fallback.RevokeSession(ctx, id)
	return nil
}

func (r *PostgresIAMRepository) RotateSession(ctx context.Context, oldSessionID string, newSession *domain.Session) error {
	if r.db == nil {
		return r.fallback.RotateSession(ctx, oldSessionID, newSession)
	}

	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	if _, err := tx.ExecContext(ctx, `UPDATE sessions SET revoked_at = NOW(), updated_at = NOW() WHERE id = $1`, oldSessionID); err != nil {
		return err
	}

	if newSession.ID == "" {
		newSession.ID = newUUID()
	}
	now := time.Now().UTC()
	if newSession.CreatedAt.IsZero() {
		newSession.CreatedAt = now
	}
	newSession.UpdatedAt = now

	if _, err := tx.ExecContext(ctx, `
		INSERT INTO sessions (id, user_id, refresh_token_hash, ip_address, user_agent, expires_at, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
	`, newSession.ID, newSession.UserID, newSession.RefreshTokenHash, newSession.IPAddress, newSession.UserAgent, newSession.ExpiresAt, newSession.CreatedAt, newSession.UpdatedAt); err != nil {
		return err
	}

	if err := tx.Commit(); err != nil {
		return err
	}

	_ = r.fallback.RotateSession(ctx, oldSessionID, newSession)
	return nil
}

func (r *PostgresIAMRepository) CreateAuditLog(ctx context.Context, log *domain.AuditLog) error {
	if r.db == nil {
		return r.fallback.CreateAuditLog(ctx, log)
	}

	if log.ID == "" {
		log.ID = newUUID()
	}
	if log.CreatedAt.IsZero() {
		log.CreatedAt = time.Now().UTC()
	}
	payloadBytes, _ := json.Marshal(log.Payload)

	query := `
		INSERT INTO audit_logs (id, actor_user_id, action, resource_type, resource_id, payload, ip_address, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
	`
	_, err := r.db.ExecContext(ctx, query,
		log.ID, log.ActorUserID, log.Action, log.ResourceType, log.ResourceID, string(payloadBytes), log.IPAddress, log.CreatedAt,
	)
	if err != nil {
		return err
	}
	_ = r.fallback.CreateAuditLog(ctx, log)
	return nil
}

func (r *PostgresIAMRepository) RevokeAllUserSessions(ctx context.Context, userID string) error {
	if r.db == nil {
		return r.fallback.RevokeAllUserSessions(ctx, userID)
	}

	query := `UPDATE sessions SET revoked_at = NOW(), updated_at = NOW() WHERE user_id = $1 AND revoked_at IS NULL`
	_, err := r.db.ExecContext(ctx, query, userID)
	if err != nil {
		return err
	}
	_ = r.fallback.RevokeAllUserSessions(ctx, userID)
	return nil
}

// MFA methods
func (r *PostgresIAMRepository) CreateMFAChallenge(ctx context.Context, challenge *domain.MFAChallenge) error {
	if r.db == nil {
		return r.fallback.CreateMFAChallenge(ctx, challenge)
	}

	if challenge.ID == "" {
		challenge.ID = newUUID()
	}
	if challenge.CreatedAt.IsZero() {
		challenge.CreatedAt = time.Now().UTC()
	}

	query := `
		INSERT INTO mfa_challenges (id, user_id, mfa_token_hash, code_hash, channel, recipient_email, recipient_phone, attempts, max_attempts, expires_at, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
	`
	_, err := r.db.ExecContext(ctx, query,
		challenge.ID, challenge.UserID, challenge.MFATokenHash, challenge.CodeHash, string(challenge.Channel),
		challenge.RecipientEmail, challenge.RecipientPhone, challenge.Attempts, challenge.MaxAttempts, challenge.ExpiresAt, challenge.CreatedAt,
	)
	if err != nil {
		return r.fallback.CreateMFAChallenge(ctx, challenge)
	}
	_ = r.fallback.CreateMFAChallenge(ctx, challenge)
	return nil
}

func (r *PostgresIAMRepository) GetMFAChallengeByTokenHash(ctx context.Context, hash string) (*domain.MFAChallenge, error) {
	if r.db == nil {
		return r.fallback.GetMFAChallengeByTokenHash(ctx, hash)
	}

	query := `
		SELECT id, user_id, mfa_token_hash, code_hash, channel, recipient_email, recipient_phone, attempts, max_attempts, expires_at, created_at
		FROM mfa_challenges
		WHERE mfa_token_hash = $1 AND expires_at > NOW()
	`
	row := r.db.QueryRowContext(ctx, query, hash)
	var c domain.MFAChallenge
	var emailVal, phoneVal sql.NullString
	var channelVal string

	err := row.Scan(
		&c.ID, &c.UserID, &c.MFATokenHash, &c.CodeHash, &channelVal,
		&emailVal, &phoneVal, &c.Attempts, &c.MaxAttempts, &c.ExpiresAt, &c.CreatedAt,
	)
	if err != nil {
		return r.fallback.GetMFAChallengeByTokenHash(ctx, hash)
	}
	c.Channel = domain.MFAChannel(channelVal)
	if emailVal.Valid {
		c.RecipientEmail = emailVal.String
	}
	if phoneVal.Valid {
		c.RecipientPhone = phoneVal.String
	}
	return &c, nil
}

func (r *PostgresIAMRepository) UpdateMFAChallenge(ctx context.Context, challenge *domain.MFAChallenge) error {
	if r.db == nil {
		return r.fallback.UpdateMFAChallenge(ctx, challenge)
	}

	query := `
		UPDATE mfa_challenges
		SET attempts = $1, expires_at = $2, code_hash = $3
		WHERE id = $4
	`
	_, _ = r.db.ExecContext(ctx, query, challenge.Attempts, challenge.ExpiresAt, challenge.CodeHash, challenge.ID)
	_ = r.fallback.UpdateMFAChallenge(ctx, challenge)
	return nil
}

func (r *PostgresIAMRepository) DeleteMFAChallenge(ctx context.Context, id string) error {
	if r.db == nil {
		return r.fallback.DeleteMFAChallenge(ctx, id)
	}

	_, _ = r.db.ExecContext(ctx, `DELETE FROM mfa_challenges WHERE id = $1`, id)
	_ = r.fallback.DeleteMFAChallenge(ctx, id)
	return nil
}

// Password Reset methods
func (r *PostgresIAMRepository) CreatePasswordResetToken(ctx context.Context, token *domain.PasswordResetToken) error {
	if r.db == nil {
		return r.fallback.CreatePasswordResetToken(ctx, token)
	}

	if token.ID == "" {
		token.ID = newUUID()
	}
	if token.CreatedAt.IsZero() {
		token.CreatedAt = time.Now().UTC()
	}

	query := `
		INSERT INTO password_reset_tokens (id, user_id, token_hash, code_hash, expires_at, created_at)
		VALUES ($1, $2, $3, $4, $5, $6)
	`
	_, err := r.db.ExecContext(ctx, query, token.ID, token.UserID, token.TokenHash, token.CodeHash, token.ExpiresAt, token.CreatedAt)
	if err != nil {
		return r.fallback.CreatePasswordResetToken(ctx, token)
	}
	_ = r.fallback.CreatePasswordResetToken(ctx, token)
	return nil
}

func (r *PostgresIAMRepository) GetPasswordResetByCodeHash(ctx context.Context, userID, codeHash string) (*domain.PasswordResetToken, error) {
	if r.db == nil {
		return r.fallback.GetPasswordResetByCodeHash(ctx, userID, codeHash)
	}

	query := `
		SELECT id, user_id, token_hash, code_hash, expires_at, used_at, created_at
		FROM password_reset_tokens
		WHERE code_hash = $1 AND used_at IS NULL AND expires_at > NOW()
	`
	args := []any{codeHash}
	if userID != "" {
		query += ` AND user_id = $2`
		args = append(args, userID)
	}

	row := r.db.QueryRowContext(ctx, query, args...)
	var t domain.PasswordResetToken
	var usedAt sql.NullTime

	err := row.Scan(&t.ID, &t.UserID, &t.TokenHash, &t.CodeHash, &t.ExpiresAt, &usedAt, &t.CreatedAt)
	if err != nil {
		return r.fallback.GetPasswordResetByCodeHash(ctx, userID, codeHash)
	}
	if usedAt.Valid {
		tm := usedAt.Time
		t.UsedAt = &tm
	}
	return &t, nil
}

func (r *PostgresIAMRepository) GetPasswordResetByTokenHash(ctx context.Context, hash string) (*domain.PasswordResetToken, error) {
	if r.db == nil {
		return r.fallback.GetPasswordResetByTokenHash(ctx, hash)
	}

	query := `
		SELECT id, user_id, token_hash, code_hash, expires_at, used_at, created_at
		FROM password_reset_tokens
		WHERE token_hash = $1 AND used_at IS NULL AND expires_at > NOW()
	`
	row := r.db.QueryRowContext(ctx, query, hash)
	var t domain.PasswordResetToken
	var usedAt sql.NullTime

	err := row.Scan(&t.ID, &t.UserID, &t.TokenHash, &t.CodeHash, &t.ExpiresAt, &usedAt, &t.CreatedAt)
	if err != nil {
		return r.fallback.GetPasswordResetByTokenHash(ctx, hash)
	}
	if usedAt.Valid {
		tm := usedAt.Time
		t.UsedAt = &tm
	}
	return &t, nil
}

func (r *PostgresIAMRepository) MarkPasswordResetUsed(ctx context.Context, id string) error {
	if r.db == nil {
		return r.fallback.MarkPasswordResetUsed(ctx, id)
	}

	_, _ = r.db.ExecContext(ctx, `UPDATE password_reset_tokens SET used_at = NOW() WHERE id = $1`, id)
	_ = r.fallback.MarkPasswordResetUsed(ctx, id)
	return nil
}

// ============================================================================
// 3. POSTGRES ERP REPOSITORY (Installations, Maintenance, Invoices, Payments)
// ============================================================================

// PostgresERPRepository implements ERPRepository against PostgreSQL with in-memory fallback.
type PostgresERPRepository struct {
	db       *sql.DB
	fallback *MemoryERPRepository
}

// NewPostgresERPRepository creates an ERPRepository connected to PostgreSQL.
func NewPostgresERPRepository(db *sql.DB, fallback *MemoryERPRepository) *PostgresERPRepository {
	if fallback == nil {
		fallback = NewMemoryERPRepository()
	}
	return &PostgresERPRepository{
		db:       db,
		fallback: fallback,
	}
}

// NewERPRepository returns a PostgresERPRepository if db != nil, otherwise MemoryERPRepository.
func NewERPRepository(db *sql.DB) ERPRepository {
	mem := NewMemoryERPRepository()
	if db != nil {
		return NewPostgresERPRepository(db, mem)
	}
	return mem
}

// --- Installations ---

func (r *PostgresERPRepository) CreateInstallation(ctx context.Context, order *domain.InstallationWorkOrder) error {
	if r.db == nil {
		return r.fallback.CreateInstallation(ctx, order)
	}

	if order.ID == "" {
		order.ID = newUUID()
	}
	now := time.Now().UTC()
	if order.CreatedAt.IsZero() {
		order.CreatedAt = now
	}
	order.UpdatedAt = now

	bomJSON, _ := json.Marshal(order.BOMItems)
	photosJSON, _ := json.Marshal(order.Photos)

	query := `
		INSERT INTO installation_work_orders (
			id, work_order_number, customer_id, customer_name, customer_phone, customer_email,
			site_address, gps_lat, gps_lng, state_region, status, inverter_sku,
			pv_kwp_planned, battery_kwh_planned, total_amount_kobo, assigned_engineer_id,
			assigned_engineer_name, scheduled_date, bom_items, photos, earthing_resistance_ohms,
			coren_inspector_id, coren_certificate_no, handover_signature, handover_signed_at,
			device_id, growatt_serial, battery_serial, notes, created_at, updated_at
		) VALUES (
			$1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16,
			$17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31
		)
	`
	_, err := r.db.ExecContext(ctx, query,
		order.ID, order.WorkOrderNumber, order.CustomerID, order.CustomerName, order.CustomerPhone, order.CustomerEmail,
		order.SiteAddress, order.GPSLat, order.GPSLng, order.StateRegion, string(order.Status), order.InverterSKU,
		order.PVKWpPlanned, order.BatteryKWhPlanned, order.TotalAmountKobo, order.AssignedEngineerID,
		order.AssignedEngineerName, order.ScheduledDate, string(bomJSON), string(photosJSON), order.EarthingResistanceOhms,
		order.CORENInspectorID, order.CORENCertificateNo, order.HandoverSignature, order.HandoverSignedAt,
		order.DeviceID, order.GrowattSerial, order.BatterySerial, order.Notes, order.CreatedAt, order.UpdatedAt,
	)
	if err != nil {
		return err
	}
	_ = r.fallback.CreateInstallation(ctx, order)
	return nil
}

func (r *PostgresERPRepository) GetInstallationByID(ctx context.Context, id string) (*domain.InstallationWorkOrder, error) {
	if r.db == nil {
		return r.fallback.GetInstallationByID(ctx, id)
	}

	query := `SELECT id, work_order_number, customer_id, customer_name, customer_phone, customer_email,
	                 site_address, gps_lat, gps_lng, state_region, status, inverter_sku,
	                 pv_kwp_planned, battery_kwh_planned, total_amount_kobo, assigned_engineer_id,
	                 assigned_engineer_name, scheduled_date, bom_items, photos, earthing_resistance_ohms,
	                 coren_inspector_id, coren_certificate_no, handover_signature, handover_signed_at,
	                 device_id, growatt_serial, battery_serial, notes, created_at, updated_at
	          FROM installation_work_orders WHERE id = $1`
	var o domain.InstallationWorkOrder
	var custID, phone, email, engID, engName, bomRaw, photosRaw, inspectorID, certNo, sig, devID, gSerial, bSerial, notes sql.NullString
	var schedDate, signedAt sql.NullTime
	var earthing sql.NullFloat64
	var status string

	err := r.db.QueryRowContext(ctx, query, id).Scan(
		&o.ID, &o.WorkOrderNumber, &custID, &o.CustomerName, &phone, &email,
		&o.SiteAddress, &o.GPSLat, &o.GPSLng, &o.StateRegion, &status, &o.InverterSKU,
		&o.PVKWpPlanned, &o.BatteryKWhPlanned, &o.TotalAmountKobo, &engID,
		&engName, &schedDate, &bomRaw, &photosRaw, &earthing,
		&inspectorID, &certNo, &sig, &signedAt,
		&devID, &gSerial, &bSerial, &notes, &o.CreatedAt, &o.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return r.fallback.GetInstallationByID(ctx, id)
		}
		return nil, err
	}
	o.Status = domain.InstallationStatus(status)
	if custID.Valid { o.CustomerID = custID.String }
	if phone.Valid { o.CustomerPhone = phone.String }
	if email.Valid { o.CustomerEmail = email.String }
	if engID.Valid { o.AssignedEngineerID = engID.String }
	if engName.Valid { o.AssignedEngineerName = engName.String }
	if schedDate.Valid { t := schedDate.Time; o.ScheduledDate = &t }
	if earthing.Valid { f := earthing.Float64; o.EarthingResistanceOhms = &f }
	if inspectorID.Valid { o.CORENInspectorID = inspectorID.String }
	if certNo.Valid { o.CORENCertificateNo = certNo.String }
	if sig.Valid { o.HandoverSignature = sig.String }
	if signedAt.Valid { t := signedAt.Time; o.HandoverSignedAt = &t }
	if devID.Valid { o.DeviceID = devID.String }
	if gSerial.Valid { o.GrowattSerial = gSerial.String }
	if bSerial.Valid { o.BatterySerial = bSerial.String }
	if notes.Valid { o.Notes = notes.String }
	if bomRaw.Valid { _ = json.Unmarshal([]byte(bomRaw.String), &o.BOMItems) }
	if photosRaw.Valid { _ = json.Unmarshal([]byte(photosRaw.String), &o.Photos) }

	return &o, nil
}

func (r *PostgresERPRepository) GetInstallationByNumber(ctx context.Context, number string) (*domain.InstallationWorkOrder, error) {
	if r.db == nil {
		return r.fallback.GetInstallationByNumber(ctx, number)
	}

	query := `SELECT id FROM installation_work_orders WHERE work_order_number = $1`
	var id string
	if err := r.db.QueryRowContext(ctx, query, number).Scan(&id); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return r.fallback.GetInstallationByNumber(ctx, number)
		}
		return nil, err
	}
	return r.GetInstallationByID(ctx, id)
}

func (r *PostgresERPRepository) UpdateInstallation(ctx context.Context, order *domain.InstallationWorkOrder) error {
	if r.db == nil {
		return r.fallback.UpdateInstallation(ctx, order)
	}

	order.UpdatedAt = time.Now().UTC()
	bomJSON, _ := json.Marshal(order.BOMItems)
	photosJSON, _ := json.Marshal(order.Photos)

	query := `
		UPDATE installation_work_orders
		SET customer_id = $1, customer_name = $2, customer_phone = $3, customer_email = $4,
		    site_address = $5, gps_lat = $6, gps_lng = $7, state_region = $8, status = $9,
		    inverter_sku = $10, pv_kwp_planned = $11, battery_kwh_planned = $12, total_amount_kobo = $13,
		    assigned_engineer_id = $14, assigned_engineer_name = $15, scheduled_date = $16,
		    bom_items = $17, photos = $18, earthing_resistance_ohms = $19, coren_inspector_id = $20,
		    coren_certificate_no = $21, handover_signature = $22, handover_signed_at = $23,
		    device_id = $24, growatt_serial = $25, battery_serial = $26, notes = $27, updated_at = $28
		WHERE id = $29
	`
	_, err := r.db.ExecContext(ctx, query,
		order.CustomerID, order.CustomerName, order.CustomerPhone, order.CustomerEmail,
		order.SiteAddress, order.GPSLat, order.GPSLng, order.StateRegion, string(order.Status),
		order.InverterSKU, order.PVKWpPlanned, order.BatteryKWhPlanned, order.TotalAmountKobo,
		order.AssignedEngineerID, order.AssignedEngineerName, order.ScheduledDate,
		string(bomJSON), string(photosJSON), order.EarthingResistanceOhms, order.CORENInspectorID,
		order.CORENCertificateNo, order.HandoverSignature, order.HandoverSignedAt,
		order.DeviceID, order.GrowattSerial, order.BatterySerial, order.Notes, order.UpdatedAt,
		order.ID,
	)
	if err != nil {
		return err
	}
	_ = r.fallback.UpdateInstallation(ctx, order)
	return nil
}

func (r *PostgresERPRepository) ListInstallations(ctx context.Context, status string, customerID string, engineerID string) ([]domain.InstallationWorkOrder, error) {
	if r.db == nil {
		return r.fallback.ListInstallations(ctx, status, customerID, engineerID)
	}

	query := `SELECT id FROM installation_work_orders WHERE 1=1`
	var args []any
	argIdx := 1
	if status != "" {
		query += fmt.Sprintf(` AND status = $%d`, argIdx)
		args = append(args, status)
		argIdx++
	}
	if customerID != "" {
		query += fmt.Sprintf(` AND customer_id = $%d`, argIdx)
		args = append(args, customerID)
		argIdx++
	}
	if engineerID != "" {
		query += fmt.Sprintf(` AND assigned_engineer_id = $%d`, argIdx)
		args = append(args, engineerID)
		argIdx++
	}
	query += ` ORDER BY created_at DESC`

	rows, err := r.db.QueryContext(ctx, query, args...)
	if err != nil {
		return r.fallback.ListInstallations(ctx, status, customerID, engineerID)
	}
	defer rows.Close()

	var ids []string
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err == nil {
			ids = append(ids, id)
		}
	}

	var results []domain.InstallationWorkOrder
	for _, id := range ids {
		if item, err := r.GetInstallationByID(ctx, id); err == nil && item != nil {
			results = append(results, *item)
		}
	}
	if len(results) == 0 {
		return r.fallback.ListInstallations(ctx, status, customerID, engineerID)
	}
	return results, nil
}

// --- Maintenance Tickets ---

func (r *PostgresERPRepository) CreateMaintenanceTicket(ctx context.Context, ticket *domain.MaintenanceTicket) error {
	if r.db == nil {
		return r.fallback.CreateMaintenanceTicket(ctx, ticket)
	}

	if ticket.ID == "" {
		ticket.ID = newUUID()
	}
	now := time.Now().UTC()
	if ticket.CreatedAt.IsZero() {
		ticket.CreatedAt = now
	}
	ticket.UpdatedAt = now

	sparePartsJSON, _ := json.Marshal(ticket.SpareParts)

	query := `
		INSERT INTO maintenance_tickets (
			id, ticket_number, customer_id, customer_name, device_id, inverter_serial,
			fault_code, fault_description, severity, status, assigned_technician_id,
			assigned_technician_name, diagnosis_notes, spare_parts_json, labour_cost_kobo,
			parts_cost_kobo, total_cost_kobo, supervisor_user_id, supervisor_notes,
			supervisor_verified_at, customer_notified_at, closed_at, created_at, updated_at
		) VALUES (
			$1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24
		)
	`
	_, err := r.db.ExecContext(ctx, query,
		ticket.ID, ticket.TicketNumber, ticket.CustomerID, ticket.CustomerName, ticket.DeviceID, ticket.InverterSerial,
		ticket.FaultCode, ticket.FaultDescription, string(ticket.Severity), string(ticket.Status), ticket.AssignedTechnicianID,
		ticket.AssignedTechnicianName, ticket.DiagnosisNotes, string(sparePartsJSON), ticket.LabourCostKobo,
		ticket.PartsCostKobo, ticket.TotalCostKobo, ticket.SupervisorUserID, ticket.SupervisorNotes,
		ticket.SupervisorVerifiedAt, ticket.CustomerNotifiedAt, ticket.ClosedAt, ticket.CreatedAt, ticket.UpdatedAt,
	)
	if err != nil {
		return err
	}
	_ = r.fallback.CreateMaintenanceTicket(ctx, ticket)
	return nil
}

func (r *PostgresERPRepository) GetMaintenanceTicketByID(ctx context.Context, id string) (*domain.MaintenanceTicket, error) {
	if r.db == nil {
		return r.fallback.GetMaintenanceTicketByID(ctx, id)
	}

	query := `
		SELECT id, ticket_number, customer_id, customer_name, device_id, inverter_serial,
		       fault_code, fault_description, severity, status, assigned_technician_id,
		       assigned_technician_name, diagnosis_notes, spare_parts_json, labour_cost_kobo,
		       parts_cost_kobo, total_cost_kobo, supervisor_user_id, supervisor_notes,
		       supervisor_verified_at, customer_notified_at, closed_at, created_at, updated_at
		FROM maintenance_tickets WHERE id = $1
	`
	var t domain.MaintenanceTicket
	var custID, serial, techID, techName, diag, partsRaw, supID, supNotes sql.NullString
	var supAt, notifAt, closedAt sql.NullTime
	var sev, status string

	err := r.db.QueryRowContext(ctx, query, id).Scan(
		&t.ID, &t.TicketNumber, &custID, &t.CustomerName, &t.DeviceID, &serial,
		&t.FaultCode, &t.FaultDescription, &sev, &status, &techID,
		&techName, &diag, &partsRaw, &t.LabourCostKobo,
		&t.PartsCostKobo, &t.TotalCostKobo, &supID, &supNotes,
		&supAt, &notifAt, &closedAt, &t.CreatedAt, &t.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return r.fallback.GetMaintenanceTicketByID(ctx, id)
		}
		return nil, err
	}
	t.Severity = sev
	t.Status = domain.MaintenanceStatus(status)
	if custID.Valid { t.CustomerID = custID.String }
	if serial.Valid { t.InverterSerial = serial.String }
	if techID.Valid { t.AssignedTechnicianID = techID.String }
	if techName.Valid { t.AssignedTechnicianName = techName.String }
	if diag.Valid { t.DiagnosisNotes = diag.String }
	if supID.Valid { t.SupervisorUserID = supID.String }
	if supNotes.Valid { t.SupervisorNotes = supNotes.String }
	if supAt.Valid { tm := supAt.Time; t.SupervisorVerifiedAt = &tm }
	if notifAt.Valid { tm := notifAt.Time; t.CustomerNotifiedAt = &tm }
	if closedAt.Valid { tm := closedAt.Time; t.ClosedAt = &tm }
	if partsRaw.Valid { _ = json.Unmarshal([]byte(partsRaw.String), &t.SpareParts) }

	return &t, nil
}

func (r *PostgresERPRepository) GetMaintenanceTicketByNumber(ctx context.Context, number string) (*domain.MaintenanceTicket, error) {
	if r.db == nil {
		return r.fallback.GetMaintenanceTicketByNumber(ctx, number)
	}

	var id string
	if err := r.db.QueryRowContext(ctx, `SELECT id FROM maintenance_tickets WHERE ticket_number = $1`, number).Scan(&id); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return r.fallback.GetMaintenanceTicketByNumber(ctx, number)
		}
		return nil, err
	}
	return r.GetMaintenanceTicketByID(ctx, id)
}

func (r *PostgresERPRepository) UpdateMaintenanceTicket(ctx context.Context, ticket *domain.MaintenanceTicket) error {
	if r.db == nil {
		return r.fallback.UpdateMaintenanceTicket(ctx, ticket)
	}

	ticket.UpdatedAt = time.Now().UTC()
	partsJSON, _ := json.Marshal(ticket.SpareParts)

	query := `
		UPDATE maintenance_tickets
		SET customer_id = $1, customer_name = $2, device_id = $3, inverter_serial = $4,
		    fault_code = $5, fault_description = $6, severity = $7, status = $8,
		    assigned_technician_id = $9, assigned_technician_name = $10, diagnosis_notes = $11,
		    spare_parts_json = $12, labour_cost_kobo = $13, parts_cost_kobo = $14,
		    total_cost_kobo = $15, supervisor_user_id = $16, supervisor_notes = $17,
		    supervisor_verified_at = $18, customer_notified_at = $19, closed_at = $20, updated_at = $21
		WHERE id = $22
	`
	_, err := r.db.ExecContext(ctx, query,
		ticket.CustomerID, ticket.CustomerName, ticket.DeviceID, ticket.InverterSerial,
		ticket.FaultCode, ticket.FaultDescription, string(ticket.Severity), string(ticket.Status),
		ticket.AssignedTechnicianID, ticket.AssignedTechnicianName, ticket.DiagnosisNotes,
		string(partsJSON), ticket.LabourCostKobo, ticket.PartsCostKobo, ticket.TotalCostKobo,
		ticket.SupervisorUserID, ticket.SupervisorNotes, ticket.SupervisorVerifiedAt,
		ticket.CustomerNotifiedAt, ticket.ClosedAt, ticket.UpdatedAt, ticket.ID,
	)
	if err != nil {
		return err
	}
	_ = r.fallback.UpdateMaintenanceTicket(ctx, ticket)
	return nil
}

func (r *PostgresERPRepository) ListMaintenanceTickets(ctx context.Context, status string, deviceID string, technicianID string) ([]domain.MaintenanceTicket, error) {
	if r.db == nil {
		return r.fallback.ListMaintenanceTickets(ctx, status, deviceID, technicianID)
	}

	query := `SELECT id FROM maintenance_tickets WHERE 1=1`
	var args []any
	argIdx := 1
	if status != "" {
		query += fmt.Sprintf(` AND status = $%d`, argIdx)
		args = append(args, status)
		argIdx++
	}
	if deviceID != "" {
		query += fmt.Sprintf(` AND device_id = $%d`, argIdx)
		args = append(args, deviceID)
		argIdx++
	}
	if technicianID != "" {
		query += fmt.Sprintf(` AND assigned_technician_id = $%d`, argIdx)
		args = append(args, technicianID)
		argIdx++
	}
	query += ` ORDER BY created_at DESC`

	rows, err := r.db.QueryContext(ctx, query, args...)
	if err != nil {
		return r.fallback.ListMaintenanceTickets(ctx, status, deviceID, technicianID)
	}
	defer rows.Close()

	var ids []string
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err == nil {
			ids = append(ids, id)
		}
	}

	var results []domain.MaintenanceTicket
	for _, id := range ids {
		if t, err := r.GetMaintenanceTicketByID(ctx, id); err == nil && t != nil {
			results = append(results, *t)
		}
	}
	if len(results) == 0 {
		return r.fallback.ListMaintenanceTickets(ctx, status, deviceID, technicianID)
	}
	return results, nil
}

// --- Invoices ---

func (r *PostgresERPRepository) CreateInvoice(ctx context.Context, inv *domain.Invoice) error {
	if r.db == nil {
		return r.fallback.CreateInvoice(ctx, inv)
	}

	if inv.ID == "" {
		inv.ID = newUUID()
	}
	now := time.Now().UTC()
	if inv.CreatedAt.IsZero() {
		inv.CreatedAt = now
	}
	inv.UpdatedAt = now

	query := `
		INSERT INTO invoices (
			id, invoice_number, customer_id, customer_name, customer_email,
			related_type, related_id, amount_kobo, paid_amount_kobo, status,
			due_date, created_at, updated_at
		) VALUES (
			$1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13
		)
	`
	_, err := r.db.ExecContext(ctx, query,
		inv.ID, inv.InvoiceNumber, inv.CustomerID, inv.CustomerName, inv.CustomerEmail,
		string(inv.RelatedType), inv.RelatedID, inv.AmountKobo, inv.PaidAmountKobo, string(inv.Status),
		inv.DueDate, inv.CreatedAt, inv.UpdatedAt,
	)
	if err != nil {
		return err
	}
	_ = r.fallback.CreateInvoice(ctx, inv)
	return nil
}

func (r *PostgresERPRepository) GetInvoiceByID(ctx context.Context, id string) (*domain.Invoice, error) {
	if r.db == nil {
		return r.fallback.GetInvoiceByID(ctx, id)
	}

	query := `
		SELECT id, invoice_number, customer_id, customer_name, customer_email,
		       related_type, related_id, amount_kobo, paid_amount_kobo, status,
		       due_date, created_at, updated_at
		FROM invoices WHERE id = $1
	`
	var inv domain.Invoice
	var custID, email sql.NullString
	var relType, status string

	err := r.db.QueryRowContext(ctx, query, id).Scan(
		&inv.ID, &inv.InvoiceNumber, &custID, &inv.CustomerName, &email,
		&relType, &inv.RelatedID, &inv.AmountKobo, &inv.PaidAmountKobo, &status,
		&inv.DueDate, &inv.CreatedAt, &inv.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return r.fallback.GetInvoiceByID(ctx, id)
		}
		return nil, err
	}
	inv.RelatedType = relType
	inv.Status = domain.InvoiceStatus(status)
	if custID.Valid { inv.CustomerID = custID.String }
	if email.Valid { inv.CustomerEmail = email.String }

	return &inv, nil
}

func (r *PostgresERPRepository) GetInvoiceByNumber(ctx context.Context, number string) (*domain.Invoice, error) {
	if r.db == nil {
		return r.fallback.GetInvoiceByNumber(ctx, number)
	}

	var id string
	if err := r.db.QueryRowContext(ctx, `SELECT id FROM invoices WHERE invoice_number = $1`, number).Scan(&id); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return r.fallback.GetInvoiceByNumber(ctx, number)
		}
		return nil, err
	}
	return r.GetInvoiceByID(ctx, id)
}

func (r *PostgresERPRepository) UpdateInvoice(ctx context.Context, inv *domain.Invoice) error {
	if r.db == nil {
		return r.fallback.UpdateInvoice(ctx, inv)
	}

	inv.UpdatedAt = time.Now().UTC()
	query := `
		UPDATE invoices
		SET customer_id = $1, customer_name = $2, customer_email = $3,
		    related_type = $4, related_id = $5, amount_kobo = $6, paid_amount_kobo = $7,
		    status = $8, due_date = $9, updated_at = $10
		WHERE id = $11
	`
	_, err := r.db.ExecContext(ctx, query,
		inv.CustomerID, inv.CustomerName, inv.CustomerEmail,
		string(inv.RelatedType), inv.RelatedID, inv.AmountKobo, inv.PaidAmountKobo,
		string(inv.Status), inv.DueDate, inv.UpdatedAt, inv.ID,
	)
	if err != nil {
		return err
	}
	_ = r.fallback.UpdateInvoice(ctx, inv)
	return nil
}

func (r *PostgresERPRepository) ListInvoices(ctx context.Context, status string, customerID string) ([]domain.Invoice, error) {
	if r.db == nil {
		return r.fallback.ListInvoices(ctx, status, customerID)
	}

	query := `SELECT id FROM invoices WHERE 1=1`
	var args []any
	argIdx := 1
	if status != "" {
		query += fmt.Sprintf(` AND status = $%d`, argIdx)
		args = append(args, status)
		argIdx++
	}
	if customerID != "" {
		query += fmt.Sprintf(` AND customer_id = $%d`, argIdx)
		args = append(args, customerID)
		argIdx++
	}
	query += ` ORDER BY created_at DESC`

	rows, err := r.db.QueryContext(ctx, query, args...)
	if err != nil {
		return r.fallback.ListInvoices(ctx, status, customerID)
	}
	defer rows.Close()

	var ids []string
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err == nil {
			ids = append(ids, id)
		}
	}

	var results []domain.Invoice
	for _, id := range ids {
		if inv, err := r.GetInvoiceByID(ctx, id); err == nil && inv != nil {
			results = append(results, *inv)
		}
	}
	if len(results) == 0 {
		return r.fallback.ListInvoices(ctx, status, customerID)
	}
	return results, nil
}

// --- Payments ---

func (r *PostgresERPRepository) CreateFinancePayment(ctx context.Context, p *domain.FinancePayment) error {
	if r.db == nil {
		return r.fallback.CreateFinancePayment(ctx, p)
	}

	if p.ID == "" {
		p.ID = newUUID()
	}
	now := time.Now().UTC()
	if p.CreatedAt.IsZero() {
		p.CreatedAt = now
	}
	p.UpdatedAt = now

	query := `
		INSERT INTO finance_payments (
			id, payment_reference, customer_id, invoice_id, amount_kobo, payment_method,
			bank_teller_ref, bank_name, status, verified_by_user_id, verified_at,
			sts_token_issued, credit_days_extended, rejection_reason, created_at, updated_at
		) VALUES (
			$1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16
		)
	`
	_, err := r.db.ExecContext(ctx, query,
		p.ID, p.PaymentReference, p.CustomerID, p.InvoiceID, p.AmountKobo, p.PaymentMethod,
		p.BankTellerReference, p.BankName, string(p.Status), p.VerifiedByUserID, p.VerifiedAt,
		p.STSTokenIssued, p.CreditDaysExtended, p.RejectionReason, p.CreatedAt, p.UpdatedAt,
	)
	if err != nil {
		return err
	}
	_ = r.fallback.CreateFinancePayment(ctx, p)
	return nil
}

func (r *PostgresERPRepository) GetFinancePaymentByID(ctx context.Context, id string) (*domain.FinancePayment, error) {
	if r.db == nil {
		return r.fallback.GetFinancePaymentByID(ctx, id)
	}

	query := `
		SELECT id, payment_reference, customer_id, invoice_id, amount_kobo, payment_method,
		       bank_teller_ref, bank_name, status, verified_by_user_id, verified_at,
		       sts_token_issued, credit_days_extended, rejection_reason, created_at, updated_at
		FROM finance_payments WHERE id = $1
	`
	var p domain.FinancePayment
	var custID, invID, teller, bank, verifierID, sts, rej sql.NullString
	var verAt sql.NullTime
	var method, status string

	err := r.db.QueryRowContext(ctx, query, id).Scan(
		&p.ID, &p.PaymentReference, &custID, &invID, &p.AmountKobo, &method,
		&teller, &bank, &status, &verifierID, &verAt,
		&sts, &p.CreditDaysExtended, &rej, &p.CreatedAt, &p.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return r.fallback.GetFinancePaymentByID(ctx, id)
		}
		return nil, err
	}
	p.PaymentMethod = method
	p.Status = domain.PaymentStatus(status)
	if custID.Valid { p.CustomerID = custID.String }
	if invID.Valid { p.InvoiceID = invID.String }
	if teller.Valid { p.BankTellerReference = teller.String }
	if bank.Valid { p.BankName = bank.String }
	if verifierID.Valid { p.VerifiedByUserID = verifierID.String }
	if verAt.Valid { t := verAt.Time; p.VerifiedAt = &t }
	if sts.Valid { p.STSTokenIssued = sts.String }
	if rej.Valid { p.RejectionReason = rej.String }

	return &p, nil
}

func (r *PostgresERPRepository) GetFinancePaymentByReference(ctx context.Context, ref string) (*domain.FinancePayment, error) {
	if r.db == nil {
		return r.fallback.GetFinancePaymentByReference(ctx, ref)
	}

	var id string
	if err := r.db.QueryRowContext(ctx, `SELECT id FROM finance_payments WHERE payment_reference = $1`, ref).Scan(&id); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return r.fallback.GetFinancePaymentByReference(ctx, ref)
		}
		return nil, err
	}
	return r.GetFinancePaymentByID(ctx, id)
}

func (r *PostgresERPRepository) UpdateFinancePayment(ctx context.Context, payment *domain.FinancePayment) error {
	if r.db == nil {
		return r.fallback.UpdateFinancePayment(ctx, payment)
	}

	payment.UpdatedAt = time.Now().UTC()
	query := `
		UPDATE finance_payments
		SET customer_id = $1, invoice_id = $2, amount_kobo = $3, payment_method = $4,
		    bank_teller_ref = $5, bank_name = $6, status = $7, verified_by_user_id = $8,
		    verified_at = $9, sts_token_issued = $10, credit_days_extended = $11,
		    rejection_reason = $12, updated_at = $13
		WHERE id = $14
	`
	_, err := r.db.ExecContext(ctx, query,
		payment.CustomerID, payment.InvoiceID, payment.AmountKobo, payment.PaymentMethod,
		payment.BankTellerReference, payment.BankName, string(payment.Status), payment.VerifiedByUserID,
		payment.VerifiedAt, payment.STSTokenIssued, payment.CreditDaysExtended,
		payment.RejectionReason, payment.UpdatedAt, payment.ID,
	)
	if err != nil {
		return err
	}
	_ = r.fallback.UpdateFinancePayment(ctx, payment)
	return nil
}

func (r *PostgresERPRepository) ListFinancePayments(ctx context.Context, status string, customerID string) ([]domain.FinancePayment, error) {
	if r.db == nil {
		return r.fallback.ListFinancePayments(ctx, status, customerID)
	}

	query := `SELECT id FROM finance_payments WHERE 1=1`
	var args []any
	argIdx := 1
	if status != "" {
		query += fmt.Sprintf(` AND status = $%d`, argIdx)
		args = append(args, status)
		argIdx++
	}
	if customerID != "" {
		query += fmt.Sprintf(` AND customer_id = $%d`, argIdx)
		args = append(args, customerID)
		argIdx++
	}
	query += ` ORDER BY created_at DESC`

	rows, err := r.db.QueryContext(ctx, query, args...)
	if err != nil {
		return r.fallback.ListFinancePayments(ctx, status, customerID)
	}
	defer rows.Close()

	var ids []string
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err == nil {
			ids = append(ids, id)
		}
	}

	var results []domain.FinancePayment
	for _, id := range ids {
		if p, err := r.GetFinancePaymentByID(ctx, id); err == nil && p != nil {
			results = append(results, *p)
		}
	}
	if len(results) == 0 {
		return r.fallback.ListFinancePayments(ctx, status, customerID)
	}
	return results, nil
}
