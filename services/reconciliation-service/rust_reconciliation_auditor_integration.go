package main

import (
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"time"
)

type RustReconciliationAuditorInput struct {
	ReconciliationID string  `json:"reconciliation_id"`
	AccountID        string  `json:"account_id"`
	TenantID         string  `json:"tenant_id"`
	TigerBeetleValue float64 `json:"tigerbeetle_value"`
	PostgresValue    float64 `json:"postgres_value"`
	ToleranceAmount  float64 `json:"tolerance_amount"`
	OccurredAt       string  `json:"occurred_at"`
}

type RustReconciliationAuditorOutput struct {
	Classification string   `json:"classification"`
	Severity       string   `json:"severity"`
	AutoResolvable bool     `json:"auto_resolvable"`
	WithinTolerance bool    `json:"within_tolerance"`
	Reasons        []string `json:"reasons"`
}

func reconciliationAuditorWorkDir() string {
	return filepath.Join(".", "rust-reconciliation-auditor")
}

func runRustReconciliationAuditor(input RustReconciliationAuditorInput) (*RustReconciliationAuditorOutput, error) {
	inputFile, err := os.CreateTemp(os.TempDir(), "reconciliation-auditor-*.json")
	if err != nil {
		return nil, fmt.Errorf("create reconciliation auditor input: %w", err)
	}
	defer os.Remove(inputFile.Name())
	defer inputFile.Close()

	enc := json.NewEncoder(inputFile)
	enc.SetIndent("", "  ")
	if err := enc.Encode(input); err != nil {
		return nil, fmt.Errorf("encode reconciliation auditor input: %w", err)
	}

	cmd := exec.Command("cargo", "run", "--quiet", "--", "--input", inputFile.Name())
	cmd.Dir = reconciliationAuditorWorkDir()
	stdout, err := cmd.Output()
	if err != nil {
		if exitErr, ok := err.(*exec.ExitError); ok {
			return nil, fmt.Errorf("reconciliation auditor failed: %s", string(exitErr.Stderr))
		}
		return nil, fmt.Errorf("execute reconciliation auditor: %w", err)
	}

	var out RustReconciliationAuditorOutput
	if err := json.Unmarshal(stdout, &out); err != nil {
		return nil, fmt.Errorf("decode reconciliation auditor output: %w", err)
	}
	return &out, nil
}

func buildReconciliationAuditorInput(runID string, account AccountInfo, tbValue, pgValue, tolerance float64) RustReconciliationAuditorInput {
	return RustReconciliationAuditorInput{
		ReconciliationID: runID,
		AccountID:        account.AccountID,
		TenantID:         account.TenantID,
		TigerBeetleValue: tbValue,
		PostgresValue:    pgValue,
		ToleranceAmount:  tolerance,
		OccurredAt:       time.Now().UTC().Format(time.RFC3339),
	}
}
