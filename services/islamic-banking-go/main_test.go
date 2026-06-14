package main

import "testing"

func TestServiceName(t *testing.T) {
	if serviceName != "islamic-banking-go" {
		t.Errorf("expected islamic-banking-go, got %s", serviceName)
	}
}

func TestWatchdogHealthy(t *testing.T) {
	watchdogPing()
	if !watchdogHealthy() {
		t.Error("watchdog should be healthy after ping")
	}
}

func TestNairaToKobo(t *testing.T) {
	if nairaToKobo(100.50) != 10050 {
		t.Error("nairaToKobo(100.50) should be 10050")
	}
}
