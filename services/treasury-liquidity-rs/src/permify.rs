//! Wave-12 B5-P0-D1: Permify authorization guard for mutating money/ledger
//! handlers. Modeled on services/permify-authz-go/main.go:440 (check call) and
//! :470 (30s decision cache). Runs AFTER check_jwt, which stores the verified
//! claims in request extensions as `VerifiedClaims`. Fail-closed: Permify
//! unreachable -> 502; denial -> 403.

use actix_web::{HttpMessage, HttpResponse};
use serde_json::json;
use std::collections::HashMap;
use std::sync::{Mutex, OnceLock};
use std::time::{Duration, Instant};

const DECISION_CACHE_TTL: Duration = Duration::from_secs(30);
const DECISION_CACHE_MAX: usize = 10000;

static DECISION_CACHE: OnceLock<Mutex<HashMap<String, (bool, Instant)>>> = OnceLock::new();
static HTTP_CLIENT: OnceLock<reqwest::Client> = OnceLock::new();

fn permify_url() -> String {
    std::env::var("PERMIFY_URL")
        .unwrap_or_else(|_| "http://permify:3476".to_string())
        .trim_end_matches('/')
        .to_string()
}

fn client() -> &'static reqwest::Client {
    HTTP_CLIENT.get_or_init(|| {
        reqwest::Client::builder()
            .timeout(Duration::from_secs(5))
            .build()
            .unwrap_or_else(|_| reqwest::Client::new())
    })
}

/// Real Permify permissions/check call with a 30s decision cache in front of
/// it. Errors are never cached, keeping callers fail-closed.
pub async fn permify_check(
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
        .await
        .map_err(|e| format!("permify unreachable: {}", e))?;
    if !resp.status().is_success() {
        return Err(format!("permify returned {}", resp.status()));
    }
    let body: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
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

/// Resource id for the decision: a path `{id}`-style parameter when present,
/// else a stable per-route scope so the check is still a real, tenant-scoped
/// authorization decision.
fn entity_id(req: &actix_web::HttpRequest) -> String {
    for name in ["id", "account_id", "transfer_id", "settlement_id", "batch_id"] {
        let v = req.match_info().query(name);
        if !v.is_empty() {
            return v.to_string();
        }
    }
    format!("scope:{}", req.path().trim_start_matches('/'))
}

/// Enforce `entity_type:permission` for the authenticated subject resolved
/// from the verified JWT claims (`VerifiedClaims`, stored by check_jwt).
pub async fn require_permify(
    req: &actix_web::HttpRequest,
    entity_type: &str,
    permission: &str,
) -> Result<(), HttpResponse> {
    let claims = {
        let ext = req.extensions();
        ext.get::<crate::VerifiedClaims>().map(|c| c.0.clone())
    };
    let claims = claims.ok_or_else(|| {
        HttpResponse::Forbidden().json(json!({"error": "missing authenticated subject"}))
    })?;
    let user_id = claims
        .get("sub")
        .or_else(|| claims.get("keycloak_id"))
        .and_then(|v| v.as_str())
        .map(|s| s.to_string())
        .ok_or_else(|| {
            HttpResponse::Forbidden().json(json!({"error": "missing authenticated subject"}))
        })?;
    let tenant_id = claims
        .get("tenant_id")
        .or_else(|| claims.get("tenant"))
        .and_then(|v| v.as_str())
        .map(|s| s.to_string())
        .or_else(|| std::env::var("PERMIFY_DEFAULT_TENANT").ok())
        .unwrap_or_else(|| "bpmgd".to_string());

    match permify_check(&tenant_id, &user_id, entity_type, &entity_id(req), permission).await {
        Ok(true) => Ok(()),
        Ok(false) => Err(HttpResponse::Forbidden().json(
            json!({"error": format!("forbidden: missing permission {}:{}", entity_type, permission)}),
        )),
        Err(e) => {
            // Fail-closed: Permify unreachable -> the mutation is rejected.
            eprintln!("permify check failed (fail-closed): {}", e);
            Err(HttpResponse::BadGateway()
                .json(json!({"error": "authorization service unavailable"})))
        }
    }
}
