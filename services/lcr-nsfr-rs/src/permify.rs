//! Wave-12 B5-P1-D-D: Permify authorization guard, synchronous variant for the
//! raw-TcpListener dispatch shape (no async runtime). Mirrors the landed
//! wave-12 B5-P0-D1 guard semantics: real POST
//! {PERMIFY_URL}/v1/tenants/{tenant}/permissions/check with a 30s in-process
//! decision cache; errors are never cached. Runs AFTER check_jwt, which
//! returns the verified claims. Fail-closed: Permify unreachable -> 502;
//! denial -> 403. Health probes pass through (check_jwt already admits them
//! without claims).

use serde_json::json;
use std::collections::HashMap;
use std::sync::{Mutex, OnceLock};
use std::time::{Duration, Instant};

const DECISION_CACHE_TTL: Duration = Duration::from_secs(30);
const DECISION_CACHE_MAX: usize = 10000;

static DECISION_CACHE: OnceLock<Mutex<HashMap<String, (bool, Instant)>>> = OnceLock::new();
static HTTP_CLIENT: OnceLock<reqwest::blocking::Client> = OnceLock::new();

fn permify_url() -> String {
    std::env::var("PERMIFY_URL")
        .unwrap_or_else(|_| "http://permify:3476".to_string())
        .trim_end_matches('/')
        .to_string()
}

fn client() -> &'static reqwest::blocking::Client {
    HTTP_CLIENT.get_or_init(|| {
        reqwest::blocking::Client::builder()
            .timeout(Duration::from_secs(5))
            .build()
            .unwrap_or_else(|_| reqwest::blocking::Client::new())
    })
}

fn is_probe(path: &str) -> bool {
    matches!(path, "/healthz" | "/readyz" | "/livez" | "/metrics" | "/health" | "/ready")
}

/// Real Permify permissions/check call with a 30s decision cache in front of
/// it. Errors are never cached, keeping callers fail-closed.
pub fn permify_check(
    tenant_id: &str,
    user_id: &str,
    entity_type: &str,
    entity_id: &str,
    permission: &str,
) -> Result<bool, String> {
    let key = format!("{}|{}|{}|{}|{}", tenant_id, user_id, entity_type, entity_id, permission);
    {
        let cache = DECISION_CACHE.get_or_init(|| Mutex::new(HashMap::new()));
        let guard = cache.lock().map_err(|e| e.to_string())?;
        if let Some((allowed, expires_at)) = guard.get(&key) {
            if Instant::now() < *expires_at {
                return Ok(*allowed);
            }
        }
    }

    let payload = json!({
        "metadata": {"schema_version": "", "snap_token": "", "depth": 20},
        "entity": {"type": entity_type, "id": entity_id},
        "permission": permission,
        "subject": {"type": "user", "id": user_id},
    });
    let url = format!("{}/v1/tenants/{}/permissions/check", permify_url(), tenant_id);
    let resp = client()
        .post(&url)
        .json(&payload)
        .send()
        .map_err(|e| format!("permify unreachable: {}", e))?;
    if !resp.status().is_success() {
        return Err(format!("permify returned {}", resp.status()));
    }
    let body: serde_json::Value = resp.json().map_err(|e| e.to_string())?;
    let allowed = body.get("can").and_then(|v| v.as_str()) == Some("CHECK_RESULT_ALLOWED");

    let cache = DECISION_CACHE.get_or_init(|| Mutex::new(HashMap::new()));
    let mut guard = cache.lock().map_err(|e| e.to_string())?;
    if guard.len() >= DECISION_CACHE_MAX {
        let now = Instant::now();
        guard.retain(|_, (_, exp)| now < *exp);
        if guard.len() >= DECISION_CACHE_MAX {
            if let Some(k) = guard.keys().next().cloned() {
                guard.remove(&k);
            }
        }
    }
    guard.insert(key, (allowed, Instant::now() + DECISION_CACHE_TTL));
    Ok(allowed)
}

/// Enforce `entity_type:permission` for the authenticated subject from the
/// verified JWT claims returned by check_jwt. `path` scopes the resource when
/// no domain id is present, so the decision is still real and tenant-scoped.
pub fn require_permify(
    claims: &serde_json::Value,
    path: &str,
    entity_type: &str,
    permission: &str,
) -> Result<(), (u16, String)> {
    if is_probe(path) {
        return Ok(());
    }
    let user_id = claims
        .get("sub")
        .or_else(|| claims.get("keycloak_id"))
        .or_else(|| claims.get("preferred_username"))
        .or_else(|| claims.get("email"))
        .and_then(|v| v.as_str())
        .ok_or_else(|| {
            (403, json!({"error": "missing authenticated subject"}).to_string())
        })?;
    let tenant_id = claims
        .get("tenant_id")
        .or_else(|| claims.get("tenant"))
        .and_then(|v| v.as_str())
        .map(|s| s.to_string())
        .or_else(|| std::env::var("PERMIFY_DEFAULT_TENANT").ok())
        .unwrap_or_else(|| "bpmgd".to_string());
    let entity_id = format!("scope:{}", path.trim_start_matches('/'));

    match permify_check(&tenant_id, user_id, entity_type, &entity_id, permission) {
        Ok(true) => Ok(()),
        Ok(false) => Err((403, json!({"error": format!("forbidden: missing permission {}:{}", entity_type, permission)}).to_string())),
        Err(e) => {
            // Fail-closed: Permify unreachable -> the request is rejected.
            eprintln!("permify check failed (fail-closed): {}", e);
            Err((502, json!({"error": "authorization service unavailable"}).to_string()))
        }
    }
}
