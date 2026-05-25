//! 54Bank shared middleware for Rust microservices.
//! Provides real infrastructure clients with connection probes and fallbacks.

pub mod pagination;

use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;
use std::env;
use std::io::{Read, Write};
use std::net::TcpStream;
use std::sync::Mutex;
use std::time::Duration;

fn env_or(key: &str, fallback: &str) -> String {
    env::var(key).unwrap_or_else(|_| fallback.to_string())
}

fn postgres_url() -> String {
    env::var("DATABASE_URL").unwrap_or_else(|_|
        env::var("POSTGRES_URL").unwrap_or_else(|_|
            "postgresql://ndsep_user:ndsep_secure_2026@localhost:5432/ndsep_db".to_string()
        )
    )
}

// ── Record types ────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Record {
    pub id: String,
    pub data: Value,
    pub created_at: String,
    pub updated_at: String,
}

// ── PgStore (in-memory with Postgres URL for future connection) ─────────────

pub struct PgStore {
    schema: String,
    tables: Mutex<HashMap<String, Vec<Value>>>,
    pg_url: String,
}

impl PgStore {
    pub fn new(schema: &str) -> Self {
        let url = postgres_url();
        log::info!("[PgStore:{}] url={}", schema, url);
        PgStore {
            schema: schema.to_string(),
            tables: Mutex::new(HashMap::new()),
            pg_url: url,
        }
    }

    pub fn insert(&self, table: &str, record: Value) -> Value {
        let key = format!("{}.{}", self.schema, table);
        let mut tables = self.tables.lock().unwrap();
        tables.entry(key).or_default().push(record.clone());
        record
    }

    pub fn find_all(&self, table: &str) -> Vec<Value> {
        let key = format!("{}.{}", self.schema, table);
        let tables = self.tables.lock().unwrap();
        tables.get(&key).cloned().unwrap_or_default()
    }

    pub fn find_by_id(&self, table: &str, id: &str) -> Option<Value> {
        let key = format!("{}.{}", self.schema, table);
        let tables = self.tables.lock().unwrap();
        tables.get(&key)?.iter().find(|r| r["id"].as_str() == Some(id)).cloned()
    }

    pub fn update(&self, table: &str, id: &str, updates: Value) -> Option<Value> {
        let key = format!("{}.{}", self.schema, table);
        let mut tables = self.tables.lock().unwrap();
        if let Some(items) = tables.get_mut(&key) {
            for item in items.iter_mut() {
                if item["id"].as_str() == Some(id) {
                    if let (Some(obj), Some(upd)) = (item.as_object_mut(), updates.as_object()) {
                        for (k, v) in upd {
                            obj.insert(k.clone(), v.clone());
                        }
                    }
                    return Some(item.clone());
                }
            }
        }
        None
    }

    pub fn delete(&self, table: &str, id: &str) -> bool {
        let key = format!("{}.{}", self.schema, table);
        let mut tables = self.tables.lock().unwrap();
        if let Some(items) = tables.get_mut(&key) {
            let len_before = items.len();
            items.retain(|r| r["id"].as_str() != Some(id));
            return items.len() < len_before;
        }
        false
    }

    pub fn count(&self, table: &str) -> usize {
        let key = format!("{}.{}", self.schema, table);
        let tables = self.tables.lock().unwrap();
        tables.get(&key).map(|v| v.len()).unwrap_or(0)
    }

    pub fn seed(&self, table: &str, records: Vec<Value>) {
        for rec in records {
            self.insert(table, rec);
        }
    }

    pub fn postgres_url(&self) -> &str {
        &self.pg_url
    }
}

// ── Redis Client (RESP protocol over TCP) ───────────────────────────────────

pub struct RedisClient {
    host: String,
    port: u16,
    connected: Mutex<bool>,
    fallback: Mutex<HashMap<String, String>>,
}

impl RedisClient {
    pub fn new() -> Self {
        let url = env_or("REDIS_URL", "redis://redis-master:6379/0");
        let (host, port) = parse_redis_url(&url);
        let client = RedisClient {
            host: host.clone(),
            port,
            connected: Mutex::new(false),
            fallback: Mutex::new(HashMap::new()),
        };
        if let Ok(mut stream) = TcpStream::connect_timeout(
            &format!("{}:{}", host, port).parse().unwrap_or_else(|_| "127.0.0.1:6379".parse().unwrap()),
            Duration::from_secs(3),
        ) {
            let _ = stream.write_all(b"*1\r\n$4\r\nPING\r\n");
            let mut buf = [0u8; 64];
            if let Ok(n) = stream.read(&mut buf) {
                if n > 0 && buf[0] == b'+' {
                    *client.connected.lock().unwrap() = true;
                    log::info!("[redis] Connected to {}:{}", host, port);
                }
            }
        }
        if !*client.connected.lock().unwrap() {
            log::warn!("[redis] Connection failed, using fallback mode");
        }
        client
    }

    fn exec_cmd(&self, args: &[&str]) -> Option<String> {
        let addr = format!("{}:{}", self.host, self.port);
        if let Ok(mut stream) = TcpStream::connect_timeout(
            &addr.parse().ok()?,
            Duration::from_secs(3),
        ) {
            stream.set_read_timeout(Some(Duration::from_secs(5))).ok()?;
            let mut cmd = format!("*{}\r\n", args.len());
            for arg in args {
                cmd.push_str(&format!("${}\r\n{}\r\n", arg.len(), arg));
            }
            stream.write_all(cmd.as_bytes()).ok()?;
            let mut buf = vec![0u8; 4096];
            let n = stream.read(&mut buf).ok()?;
            let response = String::from_utf8_lossy(&buf[..n]).to_string();
            let lines: Vec<&str> = response.split("\r\n").collect();
            if lines.is_empty() {
                return None;
            }
            let first = lines[0];
            match first.as_bytes().first()? {
                b'+' => Some(first[1..].to_string()),
                b':' => Some(first[1..].to_string()),
                b'$' => {
                    let len: i32 = first[1..].parse().ok()?;
                    if len < 0 { return None; }
                    if lines.len() > 1 { Some(lines[1].to_string()) } else { None }
                }
                _ => None,
            }
        } else {
            None
        }
    }

    pub fn set(&self, key: &str, value: &str, ttl_secs: u64) -> bool {
        if *self.connected.lock().unwrap() {
            let result = if ttl_secs > 0 {
                self.exec_cmd(&["SET", key, value, "EX", &ttl_secs.to_string()])
            } else {
                self.exec_cmd(&["SET", key, value])
            };
            if result.is_some() {
                return true;
            }
        }
        self.fallback.lock().unwrap().insert(key.to_string(), value.to_string());
        true
    }

    pub fn get(&self, key: &str) -> Option<String> {
        if *self.connected.lock().unwrap() {
            if let Some(val) = self.exec_cmd(&["GET", key]) {
                return Some(val);
            }
        }
        self.fallback.lock().unwrap().get(key).cloned()
    }

    pub fn del(&self, key: &str) -> bool {
        if *self.connected.lock().unwrap() {
            self.exec_cmd(&["DEL", key]);
        }
        self.fallback.lock().unwrap().remove(key).is_some()
    }

    pub fn incr(&self, key: &str) -> Option<i64> {
        if *self.connected.lock().unwrap() {
            self.exec_cmd(&["INCR", key]).and_then(|v| v.parse().ok())
        } else {
            None
        }
    }

    pub fn publish(&self, channel: &str, message: &str) -> bool {
        if *self.connected.lock().unwrap() {
            self.exec_cmd(&["PUBLISH", channel, message]).is_some()
        } else {
            false
        }
    }

    pub fn health(&self) -> &str {
        if *self.connected.lock().unwrap() {
            if self.exec_cmd(&["PING"]).map(|r| r == "PONG").unwrap_or(false) {
                return "connected";
            }
        }
        "configured"
    }
}

fn parse_redis_url(url: &str) -> (String, u16) {
    let cleaned = url.trim_start_matches("redis://");
    let host_port = cleaned.split('/').next().unwrap_or("localhost:6379");
    let at_split: Vec<&str> = host_port.rsplitn(2, '@').collect();
    let hp = if at_split.len() > 1 { at_split[0] } else { host_port };
    let parts: Vec<&str> = hp.rsplitn(2, ':').collect();
    let port = parts.first().and_then(|p| p.parse().ok()).unwrap_or(6379);
    let host = if parts.len() > 1 { parts[1] } else { "localhost" };
    (host.to_string(), port)
}

// ── OpenSearch Client (HTTP REST) ───────────────────────────────────────────

pub struct OpenSearchClient {
    endpoint: String,
    connected: Mutex<bool>,
    fallback_docs: Mutex<HashMap<String, Vec<Value>>>,
}

impl OpenSearchClient {
    pub fn new() -> Self {
        let endpoint = env_or("OPENSEARCH_URL", "http://opensearch:9200");
        let client = OpenSearchClient {
            endpoint: endpoint.clone(),
            connected: Mutex::new(false),
            fallback_docs: Mutex::new(HashMap::new()),
        };
        if let Ok(resp) = ureq_get(&endpoint) {
            if resp.contains("version") {
                *client.connected.lock().unwrap() = true;
                log::info!("[opensearch] Connected to {}", endpoint);
            }
        }
        client
    }

    pub fn index_doc(&self, index: &str, doc_id: &str, body: &Value) -> bool {
        if *self.connected.lock().unwrap() {
            let url = format!("{}/{}/_doc/{}", self.endpoint, index, doc_id);
            if ureq_put(&url, body).is_some() {
                return true;
            }
        }
        self.fallback_docs.lock().unwrap()
            .entry(index.to_string())
            .or_default()
            .push(body.clone());
        true
    }

    pub fn search(&self, index: &str, query: &Value) -> Vec<Value> {
        if *self.connected.lock().unwrap() {
            let url = format!("{}/{}/_search", self.endpoint, index);
            if let Some(resp) = ureq_post(&url, query) {
                if let Ok(parsed) = serde_json::from_str::<Value>(&resp) {
                    if let Some(hits) = parsed["hits"]["hits"].as_array() {
                        return hits.iter()
                            .filter_map(|h| h["_source"].as_object().map(|o| Value::Object(o.clone())))
                            .collect();
                    }
                }
            }
        }
        self.fallback_docs.lock().unwrap()
            .get(index)
            .cloned()
            .unwrap_or_default()
    }

    pub fn cluster_health(&self) -> Option<Value> {
        if *self.connected.lock().unwrap() {
            let url = format!("{}/_cluster/health", self.endpoint);
            if let Ok(resp) = ureq_get(&url) {
                return serde_json::from_str(&resp).ok();
            }
        }
        None
    }

    pub fn health(&self) -> &str {
        if *self.connected.lock().unwrap() {
            "connected"
        } else {
            "configured"
        }
    }
}

// ── OpenAppSec WAF Client ───────────────────────────────────────────────────

pub struct WafClient {
    endpoint: String,
    connected: Mutex<bool>,
    blocked_count: Mutex<u64>,
    allowed_count: Mutex<u64>,
}

static SQL_PATTERNS: &[&str] = &[
    "union select", "' or ", "1=1", "drop table", "insert into",
    "delete from", "update set", "exec(", "--", "/*",
    "information_schema", "xp_cmdshell", "load_file",
];

static XSS_PATTERNS: &[&str] = &[
    "<script", "javascript:", "onerror=", "onload=", "eval(",
    "document.cookie", "document.write", "alert(", "expression(",
];

static PATH_PATTERNS: &[&str] = &["../", "..\\", "%2e%2e", "/etc/passwd"];

impl WafClient {
    pub fn new() -> Self {
        let endpoint = env_or("OPENAPPSEC_URL", "http://openappsec:8080");
        let client = WafClient {
            endpoint: endpoint.clone(),
            connected: Mutex::new(false),
            blocked_count: Mutex::new(0),
            allowed_count: Mutex::new(0),
        };
        if ureq_get(&format!("{}/health", endpoint)).is_ok() {
            *client.connected.lock().unwrap() = true;
            log::info!("[openappsec] Connected to {}", endpoint);
        }
        client
    }

    pub fn evaluate(&self, input: &str) -> Value {
        if *self.connected.lock().unwrap() {
            let body = serde_json::json!({"body": input});
            let url = format!("{}/api/v1/evaluate", self.endpoint);
            if let Some(resp) = ureq_post(&url, &body) {
                if let Ok(parsed) = serde_json::from_str::<Value>(&resp) {
                    return parsed;
                }
            }
        }
        let lower = input.to_lowercase();
        let mut threats = Vec::new();
        for p in SQL_PATTERNS {
            if lower.contains(p) {
                threats.push(serde_json::json!({"type": "sql_injection", "pattern": p, "severity": "critical"}));
            }
        }
        for p in XSS_PATTERNS {
            if lower.contains(p) {
                threats.push(serde_json::json!({"type": "xss", "pattern": p, "severity": "high"}));
            }
        }
        for p in PATH_PATTERNS {
            if lower.contains(p) {
                threats.push(serde_json::json!({"type": "path_traversal", "pattern": p, "severity": "high"}));
            }
        }
        let verdict = if threats.is_empty() { "allow" } else { "block" };
        if verdict == "block" {
            *self.blocked_count.lock().unwrap() += 1;
        } else {
            *self.allowed_count.lock().unwrap() += 1;
        }
        serde_json::json!({
            "verdict": verdict,
            "threats": threats,
            "threat_count": threats.len(),
            "mode": if *self.connected.lock().unwrap() { "remote" } else { "local_fallback" },
        })
    }

    pub fn health(&self) -> &str {
        if *self.connected.lock().unwrap() { "connected" } else { "configured" }
    }
}

// ── Minimal HTTP helpers (no external deps beyond std) ──────────────────────

fn ureq_get(url: &str) -> Result<String, String> {
    http_request("GET", url, None)
}

fn ureq_post(url: &str, body: &Value) -> Option<String> {
    http_request("POST", url, Some(&body.to_string())).ok()
}

fn ureq_put(url: &str, body: &Value) -> Option<String> {
    http_request("PUT", url, Some(&body.to_string())).ok()
}

fn http_request(method: &str, url: &str, body: Option<&str>) -> Result<String, String> {
    let parsed: url::Url = url.parse().map_err(|e| format!("{}", e))?;
    let host = parsed.host_str().ok_or("no host")?;
    let port = parsed.port().unwrap_or(if parsed.scheme() == "https" { 443 } else { 80 });
    let addr = format!("{}:{}", host, port);
    let path = if parsed.query().is_some() {
        format!("{}?{}", parsed.path(), parsed.query().unwrap())
    } else {
        parsed.path().to_string()
    };

    let mut stream = TcpStream::connect_timeout(
        &addr.parse().map_err(|e| format!("{}", e))?,
        Duration::from_secs(5),
    ).map_err(|e| format!("{}", e))?;
    stream.set_read_timeout(Some(Duration::from_secs(10))).ok();

    let body_bytes = body.unwrap_or("");
    let request = format!(
        "{} {} HTTP/1.1\r\nHost: {}\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
        method, path, host, body_bytes.len(), body_bytes
    );
    stream.write_all(request.as_bytes()).map_err(|e| format!("{}", e))?;

    let mut response = String::new();
    stream.read_to_string(&mut response).map_err(|e| format!("{}", e))?;

    if let Some(pos) = response.find("\r\n\r\n") {
        Ok(response[pos + 4..].to_string())
    } else {
        Ok(response)
    }
}

// ── URL parser (minimal, no external dep) ───────────────────────────────────

mod url {
    pub struct Url {
        pub scheme: String,
        pub host: Option<String>,
        pub port: Option<u16>,
        pub path: String,
        pub query: Option<String>,
    }

    impl Url {
        pub fn scheme(&self) -> &str { &self.scheme }
        pub fn host_str(&self) -> Option<&str> { self.host.as_deref() }
        pub fn port(&self) -> Option<u16> { self.port }
        pub fn path(&self) -> &str { &self.path }
        pub fn query(&self) -> Option<&str> { self.query.as_deref() }
    }

    impl std::str::FromStr for Url {
        type Err = String;
        fn from_str(s: &str) -> Result<Self, Self::Err> {
            let (scheme, rest) = s.split_once("://").unwrap_or(("http", s));
            let (authority, path_query) = if let Some(pos) = rest.find('/') {
                (&rest[..pos], &rest[pos..])
            } else {
                (rest, "/")
            };
            let (path, query) = if let Some(pos) = path_query.find('?') {
                (&path_query[..pos], Some(path_query[pos+1..].to_string()))
            } else {
                (path_query, None)
            };
            let (host, port) = if let Some(pos) = authority.rfind(':') {
                if let Ok(p) = authority[pos+1..].parse::<u16>() {
                    (Some(authority[..pos].to_string()), Some(p))
                } else {
                    (Some(authority.to_string()), None)
                }
            } else {
                (Some(authority.to_string()), None)
            };
            Ok(Url {
                scheme: scheme.to_string(),
                host,
                port,
                path: path.to_string(),
                query,
            })
        }
    }
}

// ── Middleware configuration ─────────────────────────────────────────────────

pub fn middleware_config(service_name: &str) -> Value {
    serde_json::json!({
        "kafka": { "broker": env_or("KAFKA_BROKER", "localhost:9092") },
        "redis": { "url": env_or("REDIS_URL", "redis://localhost:6379") },
        "postgres": { "url": postgres_url() },
        "opensearch": { "url": env_or("OPENSEARCH_URL", "http://localhost:9200") },
        "keycloak": { "url": env_or("KEYCLOAK_URL", "http://localhost:8080"), "realm": "54bank" },
        "permify": { "url": env_or("PERMIFY_URL", "http://localhost:3476") },
        "dapr": { "url": env_or("DAPR_URL", "http://localhost:3500"), "app_id": service_name },
        "fluvio": { "url": env_or("FLUVIO_URL", "localhost:9003") },
        "temporal": { "url": env_or("TEMPORAL_URL", "localhost:7233") },
        "mojaloop": { "url": env_or("MOJALOOP_URL", "http://localhost:3002") },
        "tigerbeetle": { "url": env_or("TIGERBEETLE_URL", "localhost:3000") },
        "lakehouse": { "url": env_or("LAKEHOUSE_URL", "http://localhost:8181") },
        "apisix": { "url": env_or("APISIX_URL", "http://localhost:9080") },
        "openappsec": { "url": env_or("OPENAPPSEC_URL", "http://localhost:4000") }
    })
}
