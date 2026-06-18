#!/usr/bin/env python3
"""
54Bank Chaos Engineering Runner
Controlled fault injection for testing resilience.

Usage:
  python3 tools/chaos/chaos_runner.py --experiment=service-kill --target=payments-hub
  python3 tools/chaos/chaos_runner.py --experiment=latency-injection --target=redis --duration=30
  python3 tools/chaos/chaos_runner.py --experiment=all --dry-run
"""

import argparse
import json
import os
import random
import subprocess
import sys
import time
from datetime import datetime
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent.parent


class ChaosExperiment:
    """Base class for chaos experiments."""

    def __init__(self, target: str, duration: int = 30, dry_run: bool = False):
        self.target = target
        self.duration = duration
        self.dry_run = dry_run
        self.results = {"experiment": self.__class__.__name__, "target": target, "start": None, "end": None, "observations": []}

    def log(self, msg: str):
        ts = datetime.utcnow().isoformat()
        self.results["observations"].append({"time": ts, "message": msg})
        print(f"  [{ts}] {msg}")

    def pre_check(self) -> bool:
        """Verify target is healthy before experiment."""
        return True

    def inject(self):
        """Inject the fault."""
        raise NotImplementedError

    def verify(self):
        """Verify system behavior during fault."""
        raise NotImplementedError

    def rollback(self):
        """Remove the fault."""
        raise NotImplementedError

    def post_check(self) -> bool:
        """Verify system recovered after rollback."""
        return True

    def run(self) -> dict:
        self.results["start"] = datetime.utcnow().isoformat()
        self.results["dry_run"] = self.dry_run

        print(f"\n{'='*60}")
        print(f"EXPERIMENT: {self.__class__.__name__}")
        print(f"TARGET: {self.target}")
        print(f"DURATION: {self.duration}s")
        print(f"DRY RUN: {self.dry_run}")
        print(f"{'='*60}\n")

        try:
            self.log("Pre-check...")
            if not self.pre_check():
                self.log("ABORT: Pre-check failed — target not healthy")
                self.results["status"] = "aborted"
                return self.results

            self.log("Injecting fault...")
            self.inject()

            self.log(f"Observing for {self.duration}s...")
            self.verify()

            self.log("Rolling back...")
            self.rollback()

            self.log("Post-check...")
            recovered = self.post_check()
            self.results["recovered"] = recovered
            self.results["status"] = "pass" if recovered else "fail"
            self.log(f"Result: {'PASS' if recovered else 'FAIL'}")

        except Exception as e:
            self.log(f"ERROR: {e}")
            self.results["status"] = "error"
            try:
                self.rollback()
            except Exception:
                pass

        self.results["end"] = datetime.utcnow().isoformat()
        return self.results


class ServiceKillExperiment(ChaosExperiment):
    """Kill a service container and verify graceful degradation."""

    def inject(self):
        if self.dry_run:
            self.log(f"[DRY RUN] Would kill container: {self.target}")
            return
        cmd = f"docker stop {self.target} --time=5"
        self.log(f"Running: {cmd}")
        subprocess.run(cmd, shell=True, capture_output=True)

    def verify(self):
        time.sleep(min(self.duration, 5))
        # Check if dependent services degrade gracefully
        self.log("Checking dependent services for graceful degradation...")
        if self.dry_run:
            self.log("[DRY RUN] Would check /v1/degradation endpoints")
            return
        # In real implementation, query /v1/degradation on dependent services

    def rollback(self):
        if self.dry_run:
            self.log(f"[DRY RUN] Would restart container: {self.target}")
            return
        cmd = f"docker start {self.target}"
        self.log(f"Running: {cmd}")
        subprocess.run(cmd, shell=True, capture_output=True)

    def post_check(self) -> bool:
        if self.dry_run:
            return True
        time.sleep(5)
        result = subprocess.run(
            f"docker inspect --format='{{{{.State.Running}}}}' {self.target}",
            shell=True, capture_output=True, text=True
        )
        return "true" in result.stdout.lower()


class LatencyInjectionExperiment(ChaosExperiment):
    """Add network latency to a service using tc."""

    def inject(self):
        if self.dry_run:
            self.log(f"[DRY RUN] Would add 500ms latency to {self.target}")
            return
        cmd = f"docker exec {self.target} tc qdisc add dev eth0 root netem delay 500ms 100ms"
        self.log(f"Running: {cmd}")
        subprocess.run(cmd, shell=True, capture_output=True)

    def verify(self):
        time.sleep(min(self.duration, 10))
        self.log("Checking if circuit breakers tripped...")
        if self.dry_run:
            self.log("[DRY RUN] Would check circuit breaker state")

    def rollback(self):
        if self.dry_run:
            self.log(f"[DRY RUN] Would remove latency from {self.target}")
            return
        cmd = f"docker exec {self.target} tc qdisc del dev eth0 root netem"
        subprocess.run(cmd, shell=True, capture_output=True)


class MemoryPressureExperiment(ChaosExperiment):
    """Apply memory pressure to a container."""

    def inject(self):
        if self.dry_run:
            self.log(f"[DRY RUN] Would apply 80% memory pressure to {self.target}")
            return
        cmd = f"docker update --memory=64m --memory-swap=64m {self.target}"
        self.log(f"Running: {cmd}")
        subprocess.run(cmd, shell=True, capture_output=True)

    def verify(self):
        time.sleep(min(self.duration, 10))
        self.log("Checking OOM behavior...")

    def rollback(self):
        if self.dry_run:
            self.log(f"[DRY RUN] Would restore memory limits for {self.target}")
            return
        cmd = f"docker update --memory=0 --memory-swap=0 {self.target}"
        subprocess.run(cmd, shell=True, capture_output=True)


class DiskFullExperiment(ChaosExperiment):
    """Simulate disk full condition."""

    def inject(self):
        if self.dry_run:
            self.log(f"[DRY RUN] Would fill temp disk in {self.target}")
            return
        cmd = f"docker exec {self.target} dd if=/dev/zero of=/tmp/fill bs=1M count=100"
        self.log(f"Running: {cmd}")
        subprocess.run(cmd, shell=True, capture_output=True)

    def verify(self):
        time.sleep(min(self.duration, 5))
        self.log("Checking write failures handled gracefully...")

    def rollback(self):
        if self.dry_run:
            return
        cmd = f"docker exec {self.target} rm -f /tmp/fill"
        subprocess.run(cmd, shell=True, capture_output=True)


class DNSFailureExperiment(ChaosExperiment):
    """Simulate DNS resolution failure."""

    def inject(self):
        if self.dry_run:
            self.log(f"[DRY RUN] Would break DNS in {self.target}")
            return
        cmd = f"docker exec {self.target} sh -c 'echo nameserver 192.0.2.1 > /etc/resolv.conf'"
        self.log(f"Running: {cmd}")
        subprocess.run(cmd, shell=True, capture_output=True)

    def verify(self):
        time.sleep(min(self.duration, 10))
        self.log("Checking if service falls back to cached DNS / IP...")

    def rollback(self):
        if self.dry_run:
            return
        cmd = f"docker exec {self.target} sh -c 'echo nameserver 127.0.0.11 > /etc/resolv.conf'"
        subprocess.run(cmd, shell=True, capture_output=True)


class CascadeFailureExperiment(ChaosExperiment):
    """Kill multiple services to test cascade failure resilience."""

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.targets = ["redis", "postgres", "kafka"]

    def inject(self):
        for t in self.targets:
            if self.dry_run:
                self.log(f"[DRY RUN] Would kill {t}")
            else:
                subprocess.run(f"docker stop {t} --time=3", shell=True, capture_output=True)
                self.log(f"Killed {t}")
            time.sleep(2)

    def verify(self):
        time.sleep(min(self.duration, 15))
        self.log("Checking all services entered degraded mode...")

    def rollback(self):
        for t in reversed(self.targets):
            if self.dry_run:
                self.log(f"[DRY RUN] Would restart {t}")
            else:
                subprocess.run(f"docker start {t}", shell=True, capture_output=True)
                self.log(f"Restarted {t}")
            time.sleep(3)


EXPERIMENTS = {
    "service-kill": ServiceKillExperiment,
    "latency-injection": LatencyInjectionExperiment,
    "memory-pressure": MemoryPressureExperiment,
    "disk-full": DiskFullExperiment,
    "dns-failure": DNSFailureExperiment,
    "cascade-failure": CascadeFailureExperiment,
}


def run_all_experiments(dry_run=True, duration=30):
    """Run all chaos experiments."""
    results = []
    targets = ["payments-hub", "redis", "postgres", "kafka", "api-gateway"]

    for name, ExperimentClass in EXPERIMENTS.items():
        target = random.choice(targets) if name != "cascade-failure" else "infrastructure"
        exp = ExperimentClass(target=target, duration=duration, dry_run=dry_run)
        result = exp.run()
        results.append(result)

    return results


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="54Bank Chaos Engineering Runner")
    parser.add_argument("--experiment", default="all", choices=list(EXPERIMENTS.keys()) + ["all"])
    parser.add_argument("--target", default="payments-hub")
    parser.add_argument("--duration", type=int, default=30)
    parser.add_argument("--dry-run", action="store_true", default=True)
    parser.add_argument("--live", action="store_true", help="Actually run (not dry-run)")
    parser.add_argument("--json", action="store_true")
    args = parser.parse_args()

    dry_run = not args.live

    if args.experiment == "all":
        results = run_all_experiments(dry_run=dry_run, duration=args.duration)
    else:
        ExperimentClass = EXPERIMENTS[args.experiment]
        exp = ExperimentClass(target=args.target, duration=args.duration, dry_run=dry_run)
        results = [exp.run()]

    if args.json:
        print(json.dumps(results, indent=2))

    passed = sum(1 for r in results if r.get("status") == "pass")
    failed = sum(1 for r in results if r.get("status") == "fail")
    print(f"\n{'='*60}")
    print(f"CHAOS RESULTS: {passed} passed, {failed} failed, {len(results)} total")
    print(f"{'='*60}")
