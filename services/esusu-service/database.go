package main

import (
	"encoding/json"
	"fmt"
	"log"
	"os"
	"time"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

// ============================================
// DATABASE MODELS (GORM)
// ============================================

// DBEsusuGroup represents the esusu group table
type DBEsusuGroup struct {
	ID                 string    `gorm:"primaryKey;type:varchar(36)"`
	TenantID           string    `gorm:"type:varchar(50);index"`
	Name               string    `gorm:"type:varchar(255);not null"`
	Description        string    `gorm:"type:text"`
	CreatedBy          string    `gorm:"type:varchar(36)"`
	AdminID            string    `gorm:"type:varchar(36)"`
	ContributionAmount float64   `gorm:"type:decimal(15,2);not null"`
	Currency           string    `gorm:"type:varchar(10);default:'NGN'"`
	Frequency          string    `gorm:"type:varchar(20)"`
	MaxMembers         int       `gorm:"not null"`
	CurrentCycle       int       `gorm:"default:0"`
	TotalCycles        int       `gorm:"not null"`
	Status             string    `gorm:"type:varchar(20);index"`
	StartDate          time.Time `gorm:"not null"`
	NextPayoutDate     time.Time
	PayoutOrder        string    `gorm:"type:jsonb"` // Stored as JSON array
	Rules              string    `gorm:"type:jsonb"` // Stored as JSON object
	AIMetrics          string    `gorm:"type:jsonb"` // Stored as JSON object
	CreatedAt          time.Time `gorm:"autoCreateTime"`
	UpdatedAt          time.Time `gorm:"autoUpdateTime"`
}

func (DBEsusuGroup) TableName() string {
	return "esusu_groups"
}

// DBEsusuMember represents the esusu member table
type DBEsusuMember struct {
	ID                  string    `gorm:"primaryKey;type:varchar(36)"`
	TenantID            string    `gorm:"type:varchar(50);index"`
	UserID              string    `gorm:"type:varchar(36);index"`
	GroupID             string    `gorm:"type:varchar(36);index;not null"`
	Name                string    `gorm:"type:varchar(255);not null"`
	Phone               string    `gorm:"type:varchar(20)"`
	Email               string    `gorm:"type:varchar(255)"`
	Role                string    `gorm:"type:varchar(20)"`
	JoinedAt            time.Time `gorm:"not null"`
	Position            int       `gorm:"not null"`
	HasReceivedPayout   bool      `gorm:"default:false"`
	PayoutReceivedDate  *time.Time
	TotalContributed    float64   `gorm:"type:decimal(15,2);default:0"`
	MissedContributions int       `gorm:"default:0"`
	LateContributions   int       `gorm:"default:0"`
	Status              string    `gorm:"type:varchar(20);index"`
	RiskScore           float64   `gorm:"type:decimal(5,2);default:0"`
	CreditScore         float64   `gorm:"type:decimal(5,2);default:0"`
	AIProfile           string    `gorm:"type:jsonb"` // Stored as JSON object
	CreatedAt           time.Time `gorm:"autoCreateTime"`
	UpdatedAt           time.Time `gorm:"autoUpdateTime"`
}

func (DBEsusuMember) TableName() string {
	return "esusu_members"
}

// DBContribution represents the contribution table
type DBContribution struct {
	ID            string    `gorm:"primaryKey;type:varchar(36)"`
	GroupID       string    `gorm:"type:varchar(36);index;not null"`
	MemberID      string    `gorm:"type:varchar(36);index;not null"`
	CycleNumber   int       `gorm:"not null;index"`
	Amount        float64   `gorm:"type:decimal(15,2);not null"`
	ExpectedDate  time.Time `gorm:"not null"`
	ActualDate    *time.Time
	Status        string    `gorm:"type:varchar(20);index"`
	PaymentMethod string    `gorm:"type:varchar(50)"`
	Reference     string    `gorm:"type:varchar(255)"`
	IsLate        bool      `gorm:"default:false"`
	DaysLate      int       `gorm:"default:0"`
	CreatedAt     time.Time `gorm:"autoCreateTime"`
	UpdatedAt     time.Time `gorm:"autoUpdateTime"`
}

func (DBContribution) TableName() string {
	return "esusu_contributions"
}

// DBPayout represents the payout table
type DBPayout struct {
	ID           string    `gorm:"primaryKey;type:varchar(36)"`
	GroupID      string    `gorm:"type:varchar(36);index;not null"`
	RecipientID  string    `gorm:"type:varchar(36);index;not null"`
	CycleNumber  int       `gorm:"not null;index"`
	Amount       float64   `gorm:"type:decimal(15,2);not null"`
	Status       string    `gorm:"type:varchar(20);index"`
	ScheduledFor time.Time `gorm:"not null"`
	ProcessedAt  *time.Time
	Reference    string    `gorm:"type:varchar(255)"`
	CreatedAt    time.Time `gorm:"autoCreateTime"`
	UpdatedAt    time.Time `gorm:"autoUpdateTime"`
}

func (DBPayout) TableName() string {
	return "esusu_payouts"
}

// ============================================
// DATABASE CONNECTION
// ============================================

// InitDatabase initializes the database connection and runs migrations
func InitDatabase() (*gorm.DB, error) {
	databaseURL := os.Getenv("DATABASE_URL")
	if databaseURL == "" {
		return nil, fmt.Errorf("DATABASE_URL environment variable is not set")
	}

	// Configure GORM logger
	gormLogger := logger.New(
		log.New(os.Stdout, "\r\n", log.LstdFlags),
		logger.Config{
			SlowThreshold:             time.Second,
			LogLevel:                  logger.Info,
			IgnoreRecordNotFoundError: true,
			Colorful:                  false,
		},
	)

	db, err := gorm.Open(postgres.Open(databaseURL), &gorm.Config{
		Logger: gormLogger,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to connect to database: %w", err)
	}

	// Configure connection pool
	sqlDB, err := db.DB()
	if err != nil {
		return nil, fmt.Errorf("failed to get database instance: %w", err)
	}

	sqlDB.SetMaxIdleConns(10)
	sqlDB.SetMaxOpenConns(100)
	sqlDB.SetConnMaxLifetime(time.Hour)

	log.Println("✅ Connected to PostgreSQL database")

	// Auto-migrate schemas
	if err := AutoMigrate(db); err != nil {
		return nil, fmt.Errorf("failed to migrate database: %w", err)
	}

	return db, nil
}

// AutoMigrate runs database migrations
func AutoMigrate(db *gorm.DB) error {
	log.Println("Running database migrations...")

	err := db.AutoMigrate(
		&DBEsusuGroup{},
		&DBEsusuMember{},
		&DBContribution{},
		&DBPayout{},
		&DBEsusuMeeting{},
		&DBEsusuPenalty{},
		&DBEsusuManagementRecord{},
		&DBEsusuRotation{},
	)
	if err != nil {
		return err
	}

	log.Println("✅ Database migrations completed")
	return nil
}

// ============================================
// CONVERSION HELPERS
// ============================================

// ToDBGroup converts domain model to database model
func ToDBGroup(group *EsusuGroup, tenantID string) (*DBEsusuGroup, error) {
	payoutOrderJSON, _ := json.Marshal(group.PayoutOrder)
	rulesJSON, _ := json.Marshal(group.Rules)
	metricsJSON, _ := json.Marshal(group.AIMetrics)

	return &DBEsusuGroup{
		ID:                 group.ID,
		TenantID:           tenantID,
		Name:               group.Name,
		Description:        group.Description,
		CreatedBy:          group.CreatedBy,
		AdminID:            group.AdminID,
		ContributionAmount: group.ContributionAmount,
		Currency:           group.Currency,
		Frequency:          string(group.Frequency),
		MaxMembers:         group.MaxMembers,
		CurrentCycle:       group.CurrentCycle,
		TotalCycles:        group.TotalCycles,
		Status:             string(group.Status),
		StartDate:          group.StartDate,
		NextPayoutDate:     group.NextPayoutDate,
		PayoutOrder:        string(payoutOrderJSON),
		Rules:              string(rulesJSON),
		AIMetrics:          string(metricsJSON),
		CreatedAt:          group.CreatedAt,
		UpdatedAt:          group.UpdatedAt,
	}, nil
}

// FromDBGroup converts database model to domain model
func FromDBGroup(dbGroup *DBEsusuGroup, members []EsusuMember) (*EsusuGroup, error) {
	var payoutOrder []string
	var rules GroupRules
	var metrics GroupAIMetrics

	json.Unmarshal([]byte(dbGroup.PayoutOrder), &payoutOrder)
	json.Unmarshal([]byte(dbGroup.Rules), &rules)
	json.Unmarshal([]byte(dbGroup.AIMetrics), &metrics)

	return &EsusuGroup{
		ID:                 dbGroup.ID,
		Name:               dbGroup.Name,
		Description:        dbGroup.Description,
		CreatedBy:          dbGroup.CreatedBy,
		AdminID:            dbGroup.AdminID,
		ContributionAmount: dbGroup.ContributionAmount,
		Currency:           dbGroup.Currency,
		Frequency:          ContributionFreq(dbGroup.Frequency),
		MaxMembers:         dbGroup.MaxMembers,
		CurrentCycle:       dbGroup.CurrentCycle,
		TotalCycles:        dbGroup.TotalCycles,
		Status:             GroupStatus(dbGroup.Status),
		StartDate:          dbGroup.StartDate,
		NextPayoutDate:     dbGroup.NextPayoutDate,
		Members:            members,
		PayoutOrder:        payoutOrder,
		Rules:              rules,
		AIMetrics:          metrics,
		CreatedAt:          dbGroup.CreatedAt,
		UpdatedAt:          dbGroup.UpdatedAt,
	}, nil
}

// ToDBMember converts domain member to database model
func ToDBMember(member *EsusuMember, tenantID string) (*DBEsusuMember, error) {
	profileJSON, _ := json.Marshal(member.AIProfile)

	return &DBEsusuMember{
		ID:                  member.ID,
		TenantID:            tenantID,
		UserID:              member.UserID,
		GroupID:             member.GroupID,
		Name:                member.Name,
		Phone:               member.Phone,
		Email:               member.Email,
		Role:                string(member.Role),
		JoinedAt:            member.JoinedAt,
		Position:            member.Position,
		HasReceivedPayout:   member.HasReceivedPayout,
		PayoutReceivedDate:  member.PayoutReceivedDate,
		TotalContributed:    member.TotalContributed,
		MissedContributions: member.MissedContributions,
		LateContributions:   member.LateContributions,
		Status:              string(member.Status),
		RiskScore:           member.RiskScore,
		CreditScore:         member.CreditScore,
		AIProfile:           string(profileJSON),
	}, nil
}

// FromDBMember converts database model to domain member
func FromDBMember(dbMember *DBEsusuMember) (*EsusuMember, error) {
	var profile MemberAIProfile
	json.Unmarshal([]byte(dbMember.AIProfile), &profile)

	return &EsusuMember{
		ID:                  dbMember.ID,
		UserID:              dbMember.UserID,
		GroupID:             dbMember.GroupID,
		Name:                dbMember.Name,
		Phone:               dbMember.Phone,
		Email:               dbMember.Email,
		Role:                MemberRole(dbMember.Role),
		JoinedAt:            dbMember.JoinedAt,
		Position:            dbMember.Position,
		HasReceivedPayout:   dbMember.HasReceivedPayout,
		PayoutReceivedDate:  dbMember.PayoutReceivedDate,
		TotalContributed:    dbMember.TotalContributed,
		MissedContributions: dbMember.MissedContributions,
		LateContributions:   dbMember.LateContributions,
		Status:              MemberStatus(dbMember.Status),
		RiskScore:           dbMember.RiskScore,
		CreditScore:         dbMember.CreditScore,
		AIProfile:           profile,
	}, nil
}

// ToDBContribution converts domain contribution to database model
func ToDBContribution(contrib *Contribution) *DBContribution {
	return &DBContribution{
		ID:            contrib.ID,
		GroupID:       contrib.GroupID,
		MemberID:      contrib.MemberID,
		CycleNumber:   contrib.CycleNumber,
		Amount:        contrib.Amount,
		ExpectedDate:  contrib.ExpectedDate,
		ActualDate:    contrib.ActualDate,
		Status:        string(contrib.Status),
		PaymentMethod: contrib.PaymentMethod,
		Reference:     contrib.Reference,
		IsLate:        contrib.IsLate,
		DaysLate:      contrib.DaysLate,
		CreatedAt:     contrib.CreatedAt,
	}
}

// FromDBContribution converts database model to domain contribution
func FromDBContribution(dbContrib *DBContribution) *Contribution {
	return &Contribution{
		ID:            dbContrib.ID,
		GroupID:       dbContrib.GroupID,
		MemberID:      dbContrib.MemberID,
		CycleNumber:   dbContrib.CycleNumber,
		Amount:        dbContrib.Amount,
		ExpectedDate:  dbContrib.ExpectedDate,
		ActualDate:    dbContrib.ActualDate,
		Status:        ContributionStatus(dbContrib.Status),
		PaymentMethod: dbContrib.PaymentMethod,
		Reference:     dbContrib.Reference,
		IsLate:        dbContrib.IsLate,
		DaysLate:      dbContrib.DaysLate,
		CreatedAt:     dbContrib.CreatedAt,
	}
}

// ToDBPayout converts domain payout to database model
func ToDBPayout(payout *Payout) *DBPayout {
	return &DBPayout{
		ID:           payout.ID,
		GroupID:      payout.GroupID,
		RecipientID:  payout.RecipientID,
		CycleNumber:  payout.CycleNumber,
		Amount:       payout.Amount,
		Status:       string(payout.Status),
		ScheduledFor: payout.ScheduledFor,
		ProcessedAt:  payout.ProcessedAt,
		Reference:    payout.Reference,
	}
}

// FromDBPayout converts database model to domain payout
func FromDBPayout(dbPayout *DBPayout) *Payout {
	return &Payout{
		ID:           dbPayout.ID,
		GroupID:      dbPayout.GroupID,
		RecipientID:  dbPayout.RecipientID,
		CycleNumber:  dbPayout.CycleNumber,
		Amount:       dbPayout.Amount,
		Status:       PayoutStatus(dbPayout.Status),
		ScheduledFor: dbPayout.ScheduledFor,
		ProcessedAt:  dbPayout.ProcessedAt,
		Reference:    dbPayout.Reference,
	}
}
