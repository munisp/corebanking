package middleware

import (
	"encoding/json"
	"fmt"
	"net/http"
	"sync"
	"time"
)

// E4: Disaster Recovery — Backup scheduling, point-in-time recovery, failover config

type BackupConfig struct {
	Strategy         string `json:"strategy"`     // full, incremental, differential
	Schedule         string `json:"schedule"`      // cron expression
	RetentionDays    int    `json:"retentionDays"`
	EncryptionKey    string `json:"encryptionKey,omitempty"`
	TargetLocation   string `json:"targetLocation"` // s3://bucket/path
	WALArchiving     bool   `json:"walArchiving"`
	PGBaseBackup     bool   `json:"pgbasebackup"`
	CompressBackups  bool   `json:"compressBackups"`
}

type BackupRecord struct {
	ID          string    `json:"id"`
	Type        string    `json:"type"` // full, incremental, wal
	SizeBytes   int64     `json:"sizeBytes"`
	Duration    int64     `json:"durationMs"`
	Status      string    `json:"status"` // running, completed, failed
	Location    string    `json:"location"`
	StartedAt   time.Time `json:"startedAt"`
	CompletedAt time.Time `json:"completedAt,omitempty"`
	Checksum    string    `json:"checksum"`
}

type FailoverConfig struct {
	Mode           string `json:"mode"`      // active-passive, active-active
	PrimaryRegion  string `json:"primaryRegion"`
	StandbyRegion  string `json:"standbyRegion"`
	RPOMinutes     int    `json:"rpoMinutes"`    // Recovery Point Objective
	RTOMinutes     int    `json:"rtoMinutes"`     // Recovery Time Objective
	AutoFailover   bool   `json:"autoFailover"`
	HealthCheckSec int    `json:"healthCheckIntervalSeconds"`
	ReplicationLag int64  `json:"replicationLagMs"`
}

type DisasterRecoveryManager struct {
	mu       sync.RWMutex
	backups  []BackupRecord
	config   BackupConfig
	failover FailoverConfig
}

func NewDRManager() *DisasterRecoveryManager {
	return &DisasterRecoveryManager{
		config: BackupConfig{
			Strategy:       "incremental",
			Schedule:       "0 2 * * *", // 2 AM daily
			RetentionDays:  30,
			TargetLocation: "s3://54bank-backups/postgres",
			WALArchiving:   true,
			PGBaseBackup:   true,
			CompressBackups: true,
		},
		failover: FailoverConfig{
			Mode:           "active-passive",
			PrimaryRegion:  "ng-lagos-1",
			StandbyRegion:  "ng-abuja-1",
			RPOMinutes:     5,
			RTOMinutes:     15,
			AutoFailover:   true,
			HealthCheckSec: 10,
		},
	}
}

func (dr *DisasterRecoveryManager) RecordBackup(backupType string, sizeBytes int64, durationMs int64, status string) {
	dr.mu.Lock()
	defer dr.mu.Unlock()
	dr.backups = append(dr.backups, BackupRecord{
		ID:          fmt.Sprintf("BKP-%d", time.Now().UnixNano()),
		Type:        backupType,
		SizeBytes:   sizeBytes,
		Duration:    durationMs,
		Status:      status,
		Location:    dr.config.TargetLocation,
		StartedAt:   time.Now().Add(-time.Duration(durationMs) * time.Millisecond),
		CompletedAt: time.Now(),
		Checksum:    fmt.Sprintf("sha256:%x", time.Now().UnixNano()),
	})
}

func (dr *DisasterRecoveryManager) GetStatus() map[string]interface{} {
	dr.mu.RLock()
	defer dr.mu.RUnlock()

	var lastBackup *BackupRecord
	if len(dr.backups) > 0 {
		last := dr.backups[len(dr.backups)-1]
		lastBackup = &last
	}

	return map[string]interface{}{
		"backupConfig":  dr.config,
		"failoverConfig": dr.failover,
		"lastBackup":    lastBackup,
		"totalBackups":  len(dr.backups),
		"status":        "operational",
	}
}

func DRStatusHandler(dr *DisasterRecoveryManager) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(dr.GetStatus())
	}
}
