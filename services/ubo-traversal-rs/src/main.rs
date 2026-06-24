#![allow(unused)]
use actix_web::{web, App, HttpServer, HttpResponse};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::collections::{HashMap, HashSet, VecDeque};
use std::sync::Mutex;
use std::env;
use uuid::Uuid;

// UBO Traversal — Graph-based Ultimate Beneficial Owner resolution
// Traverses ownership chains to find individuals with ≥10% effective ownership.
// Detects circular ownership, shell company layering, and nominee structures.

struct AppState {
    entities: Mutex<HashMap<String, Entity>>,
    ownership_links: Mutex<Vec<OwnershipLink>>,
}

#[derive(Clone, Serialize, Deserialize)]
struct Entity {
    id: String,
    name: String,
    entity_type: String, // "individual", "company", "trust", "foundation", "nominee"
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
    ownership_type: String, // "direct", "indirect", "beneficial", "nominee"
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

    // BFS from target company upward through ownership chain
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
        
        // Circular ownership detection
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
                // Intermediate entity — continue traversal
                if entity.entity_type == "nominee" {
                    flags.push(format!("NOMINEE_STRUCTURE: {} is a nominee entity", entity_id));
                }
                let high_risk_jurisdictions = ["VG", "KY", "PA", "BZ", "SC", "VU"];
                if high_risk_jurisdictions.contains(&entity.jurisdiction.as_str()) {
                    flags.push(format!("HIGH_RISK_JURISDICTION: {} in {}", entity.name, entity.jurisdiction));
                }
                
                // Traverse upward
                for link in links.iter().filter(|l| l.child_id == entity_id) {
                    let chain_pct = effective_pct * link.ownership_pct / 100.0;
                    if chain_pct >= min_pct * 0.5 { // traverse even below threshold to find hidden UBOs
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

async fn traverse(body: web::Json<TraverseRequest>, state: web::Data<AppState>) -> HttpResponse {
    let entities = state.entities.lock().unwrap();
    let links = state.ownership_links.lock().unwrap();
    let min_pct = body.min_ownership_pct.unwrap_or(10.0);
    let max_depth = body.max_depth.unwrap_or(10);
    let (ubos, flags) = traverse_ownership(&body.company_id, &entities, &links, min_pct, max_depth);
    
    let total_identified_pct: f64 = ubos.iter().map(|u| u.effective_ownership_pct).sum();
    let has_sanctioned = ubos.iter().any(|u| u.is_sanctioned);
    let has_pep = ubos.iter().any(|u| u.is_pep);
    
    let risk_level = if has_sanctioned { "CRITICAL" } else if has_pep { "HIGH" } else if total_identified_pct < 75.0 { "ELEVATED" } else { "NORMAL" };
    
    HttpResponse::Ok().json(json!({
        "company_id": body.company_id,
        "ubos": ubos,
        "total_identified_ownership_pct": total_identified_pct,
        "unidentified_ownership_pct": 100.0 - total_identified_pct.min(100.0),
        "flags": flags,
        "risk_level": risk_level,
        "has_pep_ubo": has_pep,
        "has_sanctioned_ubo": has_sanctioned,
        "traversal_config": {"min_ownership_pct": min_pct, "max_depth": max_depth},
    }))
}

async fn add_entity(body: web::Json<AddEntityRequest>, state: web::Data<AppState>) -> HttpResponse {
    let id = body.id.clone().unwrap_or_else(|| Uuid::new_v4().to_string());
    let entity = Entity {
        id: id.clone(),
        name: body.name.clone(),
        entity_type: body.entity_type.clone(),
        jurisdiction: body.jurisdiction.clone(),
        registration_number: body.registration_number.clone(),
        is_pep: body.is_pep.unwrap_or(false),
        is_sanctioned: body.is_sanctioned.unwrap_or(false),
        risk_score: 0,
    };
    state.entities.lock().unwrap().insert(id.clone(), entity);
    HttpResponse::Created().json(json!({"id": id, "status": "created"}))
}

async fn add_link(body: web::Json<AddLinkRequest>, state: web::Data<AppState>) -> HttpResponse {
    if body.ownership_pct <= 0.0 || body.ownership_pct > 100.0 {
        return HttpResponse::BadRequest().json(json!({"error": "ownership_pct must be 0-100"}));
    }
    state.ownership_links.lock().unwrap().push(OwnershipLink {
        parent_id: body.parent_id.clone(),
        child_id: body.child_id.clone(),
        ownership_pct: body.ownership_pct,
        ownership_type: body.ownership_type.clone().unwrap_or_else(|| "direct".into()),
        voting_rights_pct: body.voting_rights_pct,
        verified: false,
    });
    HttpResponse::Created().json(json!({"status": "linked"}))
}

async fn healthz() -> HttpResponse {
    HttpResponse::Ok().json(json!({"status": "healthy", "service": "ubo-traversal-rs", "version": "1.0.0"}))
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    let port: u16 = env::var("PORT").ok().and_then(|p| p.parse().ok()).unwrap_or(9033);
    let state = web::Data::new(AppState {
        entities: Mutex::new(HashMap::new()),
        ownership_links: Mutex::new(Vec::new()),
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
