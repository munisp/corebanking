use actix_web::{web, App, HttpServer, HttpResponse};
use serde::{Deserialize, Serialize};
use std::sync::Mutex;
fn ev(k: &str, d: &str) -> String { std::env::var(k).unwrap_or_else(|_| d.into()) }
fn mw() -> serde_json::Value { serde_json::json!({"kafka":{"broker":ev("KAFKA_BROKER","localhost:9092"),"topics":["txn.monitored","txn.alert-generated","txn.rule-triggered","txn.case-opened","txn.sar-recommended"]},"dapr":{"app_id":"txn-monitoring-rules-rs"},"fluvio":{"url":ev("FLUVIO_URL","localhost:9003"),"topics":["txn-monitoring-stream","txn-alert-stream"]},"temporal":{"url":ev("TEMPORAL_URL","localhost:7233"),"namespace":"txn-monitoring","workflows":["RealTimeMonitorWorkflow","BatchMonitorWorkflow","CaseManagementWorkflow"]},"postgres":{"url":ev("DATABASE_URL","postgresql://ndsep_user:ndsep_secure_2026@localhost:5432/ndsep_db"),"tables":["txn_monitoring_rules","txn_alerts","txn_cases","txn_scenarios"]},"keycloak":{"url":ev("KEYCLOAK_URL","http://localhost:8080"),"realm":"54link-dev","client_id":"txn-monitoring"},"permify":{"url":ev("PERMIFY_URL","http://localhost:3476"),"schema":"txn_monitoring"},"redis":{"url":ev("REDIS_URL","redis://localhost:6379"),"keys":["txn:velocity:{customer_id}","txn:pattern:{customer_id}","txn:alert-count"]},"mojaloop":{"url":ev("MOJALOOP_URL","http://localhost:3002"),"purpose":"cross-border-txn-monitoring"},"opensearch":{"url":ev("OPENSEARCH_URL","http://localhost:9200"),"indices":["txn-monitoring-alerts","txn-cases"]},"openappsec":{"url":ev("OPENAPPSEC_URL","http://localhost:4000")},"apisix":{"url":ev("APISIX_URL","http://localhost:9080"),"routes":["/v1/txn-monitoring/*"]},"tigerbeetle":{"url":ev("TIGERBEETLE_URL","localhost:3000"),"ledger":"txn-monitoring"},"lakehouse":{"url":ev("LAKEHOUSE_URL","http://localhost:8181"),"tables":["txn_alert_analytics","txn_pattern_analytics"]}}) }

#[derive(Clone, Serialize, Deserialize)]
struct MonitoringRule { id: String, name: String, category: String, description: String, scenario_code: String, threshold_ngn: Option<u64>, time_window_hours: Option<u32>, min_transactions: Option<u32>, risk_score_impact: u32, action: String, enabled: bool, cbn_prescribed: bool }

#[derive(Clone, Serialize, Deserialize)]
struct TxnAlert { id: String, customer_id: String, customer_name: String, rule_id: String, rule_name: String, category: String, risk_score: u32, alert_details: String, transactions_involved: u32, total_amount_ngn: u64, period: String, status: String, assigned_to: Option<String>, generated_at: String, sar_recommended: bool }

#[derive(Clone, Serialize, Deserialize)]
struct TxnCase { id: String, alert_ids: Vec<String>, customer_id: String, customer_name: String, case_type: String, risk_level: String, status: String, assigned_to: String, opened_at: String, due_date: String, outcome: Option<String>, sar_filed: bool }

fn seed_rules() -> Vec<MonitoringRule> { vec![
    MonitoringRule{id:"MR-001".into(),name:"Structuring Detection".into(),category:"structuring".into(),description:"Multiple cash transactions just below CTR threshold (₦5M) within rolling 5-day window".into(),scenario_code:"CBN-AML-001".into(),threshold_ngn:Some(4500000),time_window_hours:Some(120),min_transactions:Some(3),risk_score_impact:90,action:"alert_and_sar_review".into(),enabled:true,cbn_prescribed:true},
    MonitoringRule{id:"MR-002".into(),name:"Rapid Fund Movement".into(),category:"rapid_movement".into(),description:"Funds received and transferred out within 24 hours (>80% of received amount)".into(),scenario_code:"CBN-AML-002".into(),threshold_ngn:Some(1000000),time_window_hours:Some(24),min_transactions:Some(2),risk_score_impact:85,action:"alert_and_hold".into(),enabled:true,cbn_prescribed:true},
    MonitoringRule{id:"MR-003".into(),name:"Dormant-Then-Active".into(),category:"dormant_reactivation".into(),description:"Account dormant >6 months then sudden high-volume activity".into(),scenario_code:"CBN-AML-003".into(),threshold_ngn:Some(500000),time_window_hours:Some(168),min_transactions:Some(5),risk_score_impact:75,action:"alert_and_review".into(),enabled:true,cbn_prescribed:true},
    MonitoringRule{id:"MR-004".into(),name:"Round-Tripping".into(),category:"round_tripping".into(),description:"Funds sent to account and returned (±5%) within 48 hours".into(),scenario_code:"CBN-AML-004".into(),threshold_ngn:Some(2000000),time_window_hours:Some(48),min_transactions:Some(2),risk_score_impact:80,action:"alert_and_sar_review".into(),enabled:true,cbn_prescribed:true},
    MonitoringRule{id:"MR-005".into(),name:"PEP Threshold Monitoring".into(),category:"pep_monitoring".into(),description:"PEP customer transactions exceeding ₦1M (lower threshold than standard)".into(),scenario_code:"CBN-AML-005".into(),threshold_ngn:Some(1000000),time_window_hours:Some(24),min_transactions:Some(1),risk_score_impact:70,action:"alert_and_edd".into(),enabled:true,cbn_prescribed:true},
    MonitoringRule{id:"MR-006".into(),name:"Geographic Anomaly".into(),category:"geographic".into(),description:"Rural branch account with large urban transfers or international activity".into(),scenario_code:"CBN-AML-006".into(),threshold_ngn:Some(5000000),time_window_hours:Some(720),min_transactions:Some(3),risk_score_impact:65,action:"alert_and_review".into(),enabled:true,cbn_prescribed:true},
    MonitoringRule{id:"MR-007".into(),name:"Trade-Based ML".into(),category:"trade_based_ml".into(),description:"LC/trade values significantly above/below market prices for declared goods".into(),scenario_code:"CBN-AML-007".into(),threshold_ngn:None,time_window_hours:None,min_transactions:None,risk_score_impact:85,action:"alert_and_sar_review".into(),enabled:true,cbn_prescribed:true},
    MonitoringRule{id:"MR-008".into(),name:"Velocity Spike".into(),category:"velocity".into(),description:"Transaction count exceeds 3x monthly average".into(),scenario_code:"INT-001".into(),threshold_ngn:None,time_window_hours:Some(720),min_transactions:None,risk_score_impact:60,action:"alert_and_review".into(),enabled:true,cbn_prescribed:false},
]}

fn seed_alerts() -> Vec<TxnAlert> { vec![
    TxnAlert{id:"TA-001".into(),customer_id:"CUS-8001".into(),customer_name:"Suspicious Patterns Ltd".into(),rule_id:"MR-001".into(),rule_name:"Structuring Detection".into(),category:"structuring".into(),risk_score:92,alert_details:"12 cash deposits averaging ₦4.9M each over 5 business days — classic structuring pattern".into(),transactions_involved:12,total_amount_ngn:58800000,period:"2026-05-06 to 2026-05-10".into(),status:"sar_filed".into(),assigned_to:Some("compliance-officer-2".into()),generated_at:"2026-05-10T18:00:00Z".into(),sar_recommended:true},
    TxnAlert{id:"TA-002".into(),customer_id:"CUS-2089".into(),customer_name:"Chinedu Okeke".into(),rule_id:"MR-002".into(),rule_name:"Rapid Fund Movement".into(),category:"rapid_movement".into(),risk_score:85,alert_details:"Received ₦15M via NIP, transferred ₦14.8M to 5 accounts within 4 hours".into(),transactions_involved:6,total_amount_ngn:14800000,period:"2026-05-11".into(),status:"under_investigation".into(),assigned_to:Some("aml-analyst-1".into()),generated_at:"2026-05-11T22:00:00Z".into(),sar_recommended:true},
    TxnAlert{id:"TA-003".into(),customer_id:"CUS-5050".into(),customer_name:"Dormant Acct Holder".into(),rule_id:"MR-003".into(),rule_name:"Dormant-Then-Active".into(),category:"dormant_reactivation".into(),risk_score:75,alert_details:"Account dormant since Nov 2025, sudden 8 transactions totaling ₦12M in 3 days".into(),transactions_involved:8,total_amount_ngn:12000000,period:"2026-05-09 to 2026-05-11".into(),status:"new".into(),assigned_to:None,generated_at:"2026-05-12T06:00:00Z".into(),sar_recommended:false},
]}

fn seed_cases() -> Vec<TxnCase> { vec![
    TxnCase{id:"TC-001".into(),alert_ids:vec!["TA-001".into()],customer_id:"CUS-8001".into(),customer_name:"Suspicious Patterns Ltd".into(),case_type:"structuring".into(),risk_level:"critical".into(),status:"closed_sar_filed".into(),assigned_to:"compliance-officer-2".into(),opened_at:"2026-05-10T18:30:00Z".into(),due_date:"2026-05-13T18:00:00Z".into(),outcome:Some("SAR filed — CBN/STR/2026/05/0001".into()),sar_filed:true},
    TxnCase{id:"TC-002".into(),alert_ids:vec!["TA-002".into()],customer_id:"CUS-2089".into(),customer_name:"Chinedu Okeke".into(),case_type:"rapid_movement".into(),risk_level:"high".into(),status:"under_investigation".into(),assigned_to:"aml-analyst-1".into(),opened_at:"2026-05-11T22:30:00Z".into(),due_date:"2026-05-14T22:00:00Z".into(),outcome:None,sar_filed:false},
]}

struct St { rules: Mutex<Vec<MonitoringRule>>, alerts: Mutex<Vec<TxnAlert>>, cases: Mutex<Vec<TxnCase>> }
async fn healthz() -> HttpResponse { HttpResponse::Ok().json(serde_json::json!({"status":"healthy","service":"txn-monitoring-rules-rs","version":"1.0.0","middleware":mw()})) }
async fn get_rules(d: web::Data<St>) -> HttpResponse { let r = d.rules.lock().unwrap(); HttpResponse::Ok().json(serde_json::json!({"items":*r,"total":r.len()})) }
async fn get_alerts(d: web::Data<St>) -> HttpResponse { let a = d.alerts.lock().unwrap(); HttpResponse::Ok().json(serde_json::json!({"items":*a,"total":a.len()})) }
async fn get_cases(d: web::Data<St>) -> HttpResponse { let c = d.cases.lock().unwrap(); HttpResponse::Ok().json(serde_json::json!({"items":*c,"total":c.len()})) }

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    let port: u16 = ev("PORT","8285").parse().unwrap_or(8285);
    let d = web::Data::new(St{rules:Mutex::new(seed_rules()),alerts:Mutex::new(seed_alerts()),cases:Mutex::new(seed_cases())});
    println!("txn-monitoring-rules-rs listening on :{}",port);
    HttpServer::new(move||App::new().app_data(d.clone()).route("/healthz",web::get().to(healthz)).route("/api/rules",web::get().to(get_rules)).route("/api/alerts",web::get().to(get_alerts)).route("/api/cases",web::get().to(get_cases))).bind(("0.0.0.0",port))?.run().await
}
