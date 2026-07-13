#![allow(unused)]
use actix_web::{web, App, HttpServer, HttpResponse};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::collections::{HashMap, HashSet, VecDeque};
use std::sync::Arc;
use std::env;
use uuid::Uuid;
use tokio_postgres::NoTls;

struct AppState {
    db: Option<Arc<tokio_postgres::Client>>,
}

#[derive(Clone, Serialize, Deserialize)]
struct Entity {
    id: String,
    name: String,
    entity_type: String,
    jurisdiction: String,
    registration_number: Option<String>,
    is_pep: bool,
    is_sanctioned: bool,
    risk_score: u32,
}

#[derive(Clone, Serialize, Deserialize)]
struct OwnershipLink {
    parent_id: String,
    child_id: String,
    ownership_pct: f64,
    ownership_type: String,
    voting_rights_pct: Option<f64>,
    verified: bool,
}

#[derive(Serialize)]
struct UBOResult {
    entity_id: String,
    entity_name: String,
    entity_type: String,
    effective_ownership_pct: f64,
    ownership_path: Vec<String>,
    depth: usize,
    is_pep: bool,
    is_sanctioned: bool,
    flags: Vec<String>,
}

#[derive(Deserialize)]
struct TraverseRequest {
    company_id: String,
    min_ownership_pct: Option<f64>,
    max_depth: Option<usize>,
}

#[derive(Deserialize)]
struct AddEntityRequest {
    id: Option<String>,
    name: String,
    entity_type: String,
    jurisdiction: String,
    registration_number: Option<String>,
    is_pep: Option<bool>,
    is_sanctioned: Option<bool>,
}

#[derive(Deserialize)]
struct AddLinkRequest {
    parent_id: String,
    child_id: String,
    ownership_pct: f64,
    ownership_type: Option<String>,
    voting_rights_pct: Option<f64>,
}

fn traverse_ownership(
    target_id: &str,
    entities: &HashMap<String, Entity>,
    links: &[OwnershipLink],
    min_pct: f64,
    max_depth: usize,
) -> (Vec<UBOResult>, Vec<String>) {
    let mut ubos = Vec::new();
    let mut flags = Vec::new();
    let mut visited = HashSet::new();
    let mut queue: VecDeque<(String, f64, Vec<String>, usize)> = VecDeque::new();

    for link in links.iter().filter(|l| l.child_id == target_id) {
        queue.push_back((
            link.parent_id.clone(),
            link.ownership_pct,
            vec![target_id.to_string(), link.parent_id.clone()],
            1,
        ));
    }

    while let Some((entity_id, effective_pct, path, depth)) = queue.pop_front() {
        if depth > max_depth {
            flags.push(format!("MAX_DEPTH_REACHED: chain exceeds {} layers from {}", max_depth, entity_id));
            continue;
        }
        if visited.contains(&entity_id) {
            flags.push(format!("CIRCULAR_OWNERSHIP: {} appears multiple times in chain", entity_id));
            continue;
        }
        visited.insert(entity_id.clone());

        if let Some(entity) = entities.get(&entity_id) {
            if entity.entity_type == "individual" {
                if effective_pct >= min_pct {
                    let mut ubo_flags = Vec::new();
                    if entity.is_pep { ubo_flags.push("PEP".to_string()); }
                    if entity.is_sanctioned { ubo_flags.push("SANCTIONED".to_string()); }
                    if depth >= 3 { ubo_flags.push(format!("DEEP_LAYERING: {} levels", depth)); }
                    ubos.push(UBOResult {
                        entity_id: entity_id.clone(),
                        entity_name: entity.name.clone(),
                        entity_type: entity.entity_type.clone(),
                        effective_ownership_pct: effective_pct,
                        ownership_path: path.clone(),
                        depth,
                        is_pep: entity.is_pep,
                        is_sanctioned: entity.is_sanctioned,
                        flags: ubo_flags,
                    });
                }
            } else {
                if entity.entity_type == "nominee" {
                    flags.push(format!("NOMINEE_STRUCTURE: {} is a nominee entity", entity_id));
                }
                let high_risk_jurisdictions = ["VG", "KY", "PA", "BZ", "SC", "VU"];
                if high_risk_jurisdictions.contains(&entity.jurisdiction.as_str()) {
                    flags.push(format!("HIGH_RISK_JURISDICTION: {} in {}", entity.name, entity.jurisdiction));
                }
                for link in links.iter().filter(|l| l.child_id == entity_id) {
                    let chain_pct = effective_pct * link.ownership_pct / 100.0;
                    if chain_pct >= min_pct * 0.5 {
                        let mut new_path = path.clone();
                        new_path.push(link.parent_id.clone());
                        queue.push_back((link.parent_id.clone(), chain_pct, new_path, depth + 1));
                    }
                }
            }
        }
    }

    if ubos.is_empty() && !links.iter().any(|l| l.child_id == target_id) {
        flags.push("NO_OWNERSHIP_DATA: no ownership links found for this entity".to_string());
    }

    (ubos, flags)
}

async fn load_entities_and_links(db: &tokio_postgres::Client) -> (HashMap<String, Entity>, Vec<OwnershipLink>) {
    let mut entities = HashMap::new();
    let mut links = Vec::new();

    if let Ok(rows) = db.query("SELECT id, name, entity_type, jurisdiction, registration_number, is_pep, is_sanctioned, risk_score FROM ubo_entities", &[]).await {
        for row in rows {
            let id: String = row.get(0);
            let reg_num: Option<String> = row.get(4);
            entities.insert(id.clone(), Entity {
                id, name: row.get(1), entity_type: row.get(2), jurisdiction: row.get(3),
                registration_number: reg_num, is_pep: row.get(5), is_sanctioned: row.get(6), risk_score: row.get::<_, i32>(7) as u32,
            });
        }
    }
    if let Ok(rows) = db.query("SELECT parent_id, child_id, ownership_pct, ownership_type, voting_rights_pct, verified FROM ubo_ownership_links", &[]).await {
        for row in rows {
            let vr: Option<f64> = row.get(4);
            links.push(OwnershipLink {
                parent_id: row.get(0), child_id: row.get(1), ownership_pct: row.get(2),
                ownership_type: row.get(3), voting_rights_pct: vr, verified: row.get(5),
            });
        }
    }
    (entities, links)
}

async fn traverse(body: web::Json<TraverseRequest>, state: web::Data<AppState>) -> HttpResponse {
    let min_pct = body.min_ownership_pct.unwrap_or(10.0);
    let max_depth = body.max_depth.unwrap_or(10);

    if let Some(ref db) = state.db {
        let (entities, links) = load_entities_and_links(db).await;
        let (ubos, flags) = traverse_ownership(&body.company_id, &entities, &links, min_pct, max_depth);
        let total_identified_pct: f64 = ubos.iter().map(|u| u.effective_ownership_pct).sum();
        let has_sanctioned = ubos.iter().any(|u| u.is_sanctioned);
        let has_pep = ubos.iter().any(|u| u.is_pep);
        let risk_level = if has_sanctioned { "CRITICAL" } else if has_pep { "HIGH" } else if total_identified_pct < 75.0 { "ELEVATED" } else { "NORMAL" };

        return HttpResponse::Ok().json(json!({
            "company_id": body.company_id,
            "ubos": ubos,
            "total_identified_ownership_pct": total_identified_pct,
            "unidentified_ownership_pct": 100.0 - total_identified_pct.min(100.0),
            "flags": flags,
            "risk_level": risk_level,
            "has_pep_ubo": has_pep,
            "has_sanctioned_ubo": has_sanctioned,
            "source": "postgresql",
        }));
    }
    HttpResponse::ServiceUnavailable().json(json!({"error": "database unavailable"}))
}

async fn add_entity(body: web::Json<AddEntityRequest>, state: web::Data<AppState>) -> HttpResponse {
    let id = body.id.clone().unwrap_or_else(|| Uuid::new_v4().to_string());
    let is_pep = body.is_pep.unwrap_or(false);
    let is_sanctioned = body.is_sanctioned.unwrap_or(false);
    let reg_num = body.registration_number.clone().unwrap_or_default();

    if let Some(ref db) = state.db {
        let _ = db.execute(
            "INSERT INTO ubo_entities (id, name, entity_type, jurisdiction, registration_number, is_pep, is_sanctioned, risk_score) VALUES ($1, $2, $3, $4, $5, $6, $7, 0) ON CONFLICT (id) DO UPDATE SET name = $2, entity_type = $3",
            &[&id, &body.name, &body.entity_type, &body.jurisdiction, &reg_num, &is_pep, &is_sanctioned],
        ).await;
    }
    HttpResponse::Created().json(json!({"id": id, "status": "created"}))
}

async fn add_link(body: web::Json<AddLinkRequest>, state: web::Data<AppState>) -> HttpResponse {
    if body.ownership_pct <= 0.0 || body.ownership_pct > 100.0 {
        return HttpResponse::BadRequest().json(json!({"error": "ownership_pct must be 0-100"}));
    }
    let otype = body.ownership_type.clone().unwrap_or_else(|| "direct".into());
    let vr = body.voting_rights_pct.unwrap_or(0.0);

    if let Some(ref db) = state.db {
        let _ = db.execute(
            "INSERT INTO ubo_ownership_links (parent_id, child_id, ownership_pct, ownership_type, voting_rights_pct, verified) VALUES ($1, $2, $3, $4, $5, false)",
            &[&body.parent_id, &body.child_id, &body.ownership_pct, &otype, &vr],
        ).await;
    }
    HttpResponse::Created().json(json!({"status": "linked"}))
}

async fn healthz(state: web::Data<AppState>) -> HttpResponse {
    let db_status = if let Some(ref db) = state.db {
        match db.execute("SELECT 1", &[]).await { Ok(_) => "connected", Err(_) => "unhealthy" }
    } else { "not_configured" };
    HttpResponse::Ok().json(json!({"status": "healthy", "service": "ubo-traversal-rs", "version": "1.0.0", "database": db_status}))
}

async fn init_db(db_url: &str) -> Option<tokio_postgres::Client> {
    match tokio_postgres::connect(db_url, NoTls).await {
        Ok((client, connection)) => {
            tokio::spawn(async move { if let Err(e) = connection.await { eprintln!("DB error: {}", e); }});
            let _ = client.batch_execute(
                "CREATE TABLE IF NOT EXISTS ubo_entities (
                    id TEXT PRIMARY KEY, name TEXT NOT NULL, entity_type TEXT NOT NULL,
                    jurisdiction TEXT NOT NULL, registration_number TEXT NOT NULL DEFAULT '',
                    is_pep BOOLEAN NOT NULL DEFAULT FALSE, is_sanctioned BOOLEAN NOT NULL DEFAULT FALSE,
                    risk_score INTEGER NOT NULL DEFAULT 0
                );
                CREATE TABLE IF NOT EXISTS ubo_ownership_links (
                    id SERIAL PRIMARY KEY, parent_id TEXT NOT NULL, child_id TEXT NOT NULL,
                    ownership_pct DOUBLE PRECISION NOT NULL, ownership_type TEXT NOT NULL DEFAULT 'direct',
                    voting_rights_pct DOUBLE PRECISION NOT NULL DEFAULT 0, verified BOOLEAN NOT NULL DEFAULT FALSE
                );
                CREATE INDEX IF NOT EXISTS idx_uol_child ON ubo_ownership_links(child_id);",
            ).await;
            eprintln!("[ubo-traversal-rs] PostgreSQL connected, schema ready");
            Some(client)
        }
        Err(e) => { eprintln!("[ubo-traversal-rs] DB connect failed: {}", e); None }
    }
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    let port: u16 = env::var("PORT").ok().and_then(|p| p.parse().ok()).unwrap_or(9033);
    let db_url = env::var("DATABASE_URL").unwrap_or_else(|_| "host=localhost dbname=corebanking".to_string());
    let db_client = init_db(&db_url).await;
    let state = web::Data::new(AppState {
        db: db_client.map(Arc::new),
    });
    eprintln!("[ubo-traversal-rs] Starting on :{}", port);
    HttpServer::new(move || {
        App::new().app_data(state.clone())
            .route("/healthz", web::get().to(healthz))
            .route("/api/v1/ubo/traverse", web::post().to(traverse))
            .route("/api/v1/ubo/entity", web::post().to(add_entity))
            .route("/api/v1/ubo/link", web::post().to(add_link))
    }).bind(("0.0.0.0", port))?.run().await
}
