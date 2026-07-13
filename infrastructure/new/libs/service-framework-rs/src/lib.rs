//! Shared service framework for all 54Bank Rust microservices.
//! Eliminates boilerplate duplication: circuit breaker, retry, rate limiter, health probes,
//! metrics, alerting, graceful shutdown, security headers.

use std::collections::HashMap;
use std::sync::{Arc, Mutex, RwLock};
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};

// --- Circuit Breaker ---

#[derive(Clone, Copy, PartialEq)]
pub enum CircuitState {
    Closed,
    Open,
    HalfOpen,
}

pub struct CircuitBreaker {
    state: Mutex<CircuitState>,
    failures: Mutex<u32>,
    threshold: u32,
    reset_after: Duration,
    last_failure: Mutex<Instant>,
}

impl CircuitBreaker {
    pub fn new(threshold: u32, reset_after: Duration) -> Self {
        Self {
            state: Mutex::new(CircuitState::Closed),
            failures: Mutex::new(0),
            threshold,
            reset_after,
            last_failure: Mutex::new(Instant::now()),
        }
    }

    pub fn allow(&self) -> bool {
        let state = *self.state.lock().unwrap();
        match state {
            CircuitState::Open => {
                let last = *self.last_failure.lock().unwrap();
                if last.elapsed() > self.reset_after {
                    *self.state.lock().unwrap() = CircuitState::HalfOpen;
                    true
                } else {
                    false
                }
            }
            _ => true,
        }
    }

    pub fn record_success(&self) {
        *self.failures.lock().unwrap() = 0;
        *self.state.lock().unwrap() = CircuitState::Closed;
    }

    pub fn record_failure(&self) {
        let mut failures = self.failures.lock().unwrap();
        *failures += 1;
        *self.last_failure.lock().unwrap() = Instant::now();
        if *failures >= self.threshold {
            *self.state.lock().unwrap() = CircuitState::Open;
        }
    }

    pub fn state_name(&self) -> &'static str {
        match *self.state.lock().unwrap() {
            CircuitState::Closed => "closed",
            CircuitState::Open => "open",
            CircuitState::HalfOpen => "half_open",
        }
    }
}

// --- Rate Limiter (Token Bucket) ---

pub struct RateLimiter {
    tokens: Mutex<f64>,
    max_tokens: f64,
    refill_rate: f64,
    last_time: Mutex<Instant>,
}

impl RateLimiter {
    pub fn new(max_tokens: f64, refill_rate: f64) -> Self {
        Self {
            tokens: Mutex::new(max_tokens),
            max_tokens,
            refill_rate,
            last_time: Mutex::new(Instant::now()),
        }
    }

    pub fn allow(&self) -> bool {
        let mut tokens = self.tokens.lock().unwrap();
        let mut last = self.last_time.lock().unwrap();
        let elapsed = last.elapsed().as_secs_f64();
        *tokens += elapsed * self.refill_rate;
        if *tokens > self.max_tokens {
            *tokens = self.max_tokens;
        }
        *last = Instant::now();
        if *tokens >= 1.0 {
            *tokens -= 1.0;
            true
        } else {
            false
        }
    }
}

// --- Retry with Exponential Backoff ---

pub struct RetryConfig {
    pub max_attempts: u32,
    pub initial_wait_ms: u64,
    pub max_wait_ms: u64,
    pub multiplier: f64,
}

impl Default for RetryConfig {
    fn default() -> Self {
        Self {
            max_attempts: 3,
            initial_wait_ms: 200,
            max_wait_ms: 5000,
            multiplier: 2.0,
        }
    }
}

pub async fn retry<F, T, E>(config: &RetryConfig, mut f: F) -> Result<T, E>
where
    F: FnMut() -> Result<T, E>,
{
    let mut wait = config.initial_wait_ms;
    let mut last_err = None;
    for attempt in 0..config.max_attempts {
        match f() {
            Ok(val) => return Ok(val),
            Err(e) => {
                last_err = Some(e);
                if attempt < config.max_attempts - 1 {
                    tokio::time::sleep(Duration::from_millis(wait)).await;
                    wait = ((wait as f64) * config.multiplier) as u64;
                    if wait > config.max_wait_ms {
                        wait = config.max_wait_ms;
                    }
                }
            }
        }
    }
    Err(last_err.unwrap())
}

// --- Health Check ---

pub struct HealthChecker {
    service_name: String,
    version: String,
    start_time: Instant,
    checks: RwLock<HashMap<String, Box<dyn Fn() -> bool + Send + Sync>>>,
}

impl HealthChecker {
    pub fn new(service_name: &str, version: &str) -> Self {
        Self {
            service_name: service_name.to_string(),
            version: version.to_string(),
            start_time: Instant::now(),
            checks: RwLock::new(HashMap::new()),
        }
    }

    pub fn register_check(&self, name: &str, check: Box<dyn Fn() -> bool + Send + Sync>) {
        self.checks.write().unwrap().insert(name.to_string(), check);
    }

    pub fn health_status(&self) -> serde_json::Value {
        let checks = self.checks.read().unwrap();
        let mut check_results = serde_json::Map::new();
        let mut all_healthy = true;
        for (name, check) in checks.iter() {
            let ok = check();
            check_results.insert(name.clone(), serde_json::json!(if ok { "ok" } else { "unhealthy" }));
            if !ok { all_healthy = false; }
        }
        serde_json::json!({
            "service": self.service_name,
            "status": if all_healthy { "healthy" } else { "degraded" },
            "version": self.version,
            "uptime_seconds": self.start_time.elapsed().as_secs(),
            "checks": check_results,
        })
    }
}

// --- Metrics ---

pub struct Metrics {
    pub request_count: std::sync::atomic::AtomicU64,
    pub error_count: std::sync::atomic::AtomicU64,
    pub service_name: String,
    start_time: Instant,
}

impl Metrics {
    pub fn new(service_name: &str) -> Self {
        Self {
            request_count: std::sync::atomic::AtomicU64::new(0),
            error_count: std::sync::atomic::AtomicU64::new(0),
            service_name: service_name.to_string(),
            start_time: Instant::now(),
        }
    }

    pub fn incr_request(&self) {
        self.request_count.fetch_add(1, std::sync::atomic::Ordering::Relaxed);
    }

    pub fn incr_error(&self) {
        self.error_count.fetch_add(1, std::sync::atomic::Ordering::Relaxed);
    }

    pub fn prometheus_output(&self) -> String {
        let reqs = self.request_count.load(std::sync::atomic::Ordering::Relaxed);
        let errs = self.error_count.load(std::sync::atomic::Ordering::Relaxed);
        let uptime = self.start_time.elapsed().as_secs();
        format!(
            "# TYPE requests_total counter\nrequests_total{{service=\"{}\"}} {}\n\
             # TYPE errors_total counter\nerrors_total{{service=\"{}\"}} {}\n\
             # TYPE uptime_seconds gauge\nuptime_seconds{{service=\"{}\"}} {}\n",
            self.service_name, reqs, self.service_name, errs, self.service_name, uptime
        )
    }
}

// --- Security Headers ---

pub fn security_headers() -> Vec<(&'static str, &'static str)> {
    vec![
        ("X-Content-Type-Options", "nosniff"),
        ("X-Frame-Options", "DENY"),
        ("X-XSS-Protection", "1; mode=block"),
        ("Strict-Transport-Security", "max-age=31536000; includeSubDomains"),
        ("Content-Security-Policy", "default-src 'self'"),
        ("Referrer-Policy", "strict-origin-when-cross-origin"),
    ]
}
