#!/usr/bin/env python3
"""54Bank Capacity Planning Tool
Analyzes resource usage trends and forecasts capacity needs.
"""
import json, math
from datetime import datetime, timedelta

# Nigerian banking transaction patterns
PEAK_PATTERNS = {
    "salary_days": [25, 26, 27, 28],  # End of month salary credits
    "peak_hours": list(range(9, 17)),   # 9 AM - 5 PM WAT
    "peak_days": [0, 1, 2, 3, 4],      # Monday-Friday
    "festive_multiplier": 2.5,          # Eid, Christmas, Independence Day
}

class CapacityPlanner:
    def __init__(self):
        self.services = {}
    
    def analyze_service(self, name, current_cpu_pct, current_memory_mb, current_rps, max_rps_tested):
        headroom_cpu = 100 - current_cpu_pct
        headroom_rps = max_rps_tested - current_rps
        
        # Predict peak load (salary day + peak hour)
        peak_rps = current_rps * 3.5  # 3.5x peak multiplier for Nigerian banking
        peak_cpu = current_cpu_pct * (peak_rps / current_rps) if current_rps > 0 else 0
        
        # Calculate required replicas for peak
        target_cpu_util = 70  # Target 70% CPU at peak
        required_replicas = math.ceil(peak_cpu / target_cpu_util) if peak_cpu > 0 else 1
        
        return {
            "service": name,
            "current": {
                "cpu_pct": current_cpu_pct,
                "memory_mb": current_memory_mb,
                "rps": current_rps,
            },
            "peak_forecast": {
                "estimated_peak_rps": round(peak_rps),
                "estimated_peak_cpu_pct": round(peak_cpu, 1),
                "required_replicas": max(2, required_replicas),
                "peak_trigger": "Salary day + peak hours",
            },
            "recommendations": {
                "min_replicas": max(2, required_replicas // 2),
                "max_replicas": max(4, required_replicas * 2),
                "hpa_cpu_target": target_cpu_util,
                "memory_limit_mb": int(current_memory_mb * 1.5),
            },
            "cost_estimate": {
                "monthly_compute_usd": round(required_replicas * 45, 2),  # ~$45/replica/month
                "monthly_storage_usd": round(current_memory_mb / 1024 * 10, 2),
            }
        }

    def generate_report(self, services_data):
        total_cost = sum(s.get("cost_estimate", {}).get("monthly_compute_usd", 0) for s in services_data)
        return {
            "report_date": datetime.utcnow().isoformat(),
            "services": services_data,
            "total_services": len(services_data),
            "total_monthly_cost_usd": round(total_cost, 2),
            "peak_patterns": PEAK_PATTERNS,
            "recommendations": [
                "Enable HPA on all services with min_replicas >= 2",
                "Pre-scale 2x on salary days (25th-28th)",
                "Set PDB (Pod Disruption Budget) to maxUnavailable: 1",
                "Reserve 30% headroom for unexpected traffic spikes",
                "Use spot/preemptible instances for non-critical services (analytics, batch)",
            ]
        }

if __name__ == "__main__":
    planner = CapacityPlanner()
    sample_services = [
        planner.analyze_service("payments-hub-go", 45, 256, 1200, 5000),
        planner.analyze_service("account-opening-go", 25, 128, 300, 2000),
        planner.analyze_service("kyc-aml-screening-py", 55, 512, 500, 1500),
        planner.analyze_service("fraud-detection-ml", 70, 1024, 800, 2000),
        planner.analyze_service("realtime-gateway-go", 30, 128, 2000, 10000),
    ]
    report = planner.generate_report(sample_services)
    print(json.dumps(report, indent=2))
