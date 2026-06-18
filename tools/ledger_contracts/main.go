package main

import (
  "encoding/json"
  "os"
  "sort"
)

type Contract struct {
  Domain                  string   `json:"domain"`
  PostingMode             string   `json:"postingMode"`
  TigerBeetlePosting      string   `json:"tigerBeetlePosting"`
  KafkaPublication        string   `json:"kafkaPublication"`
  PostgresPersistence     string   `json:"postgresPersistence"`
  RedisInvalidation       string   `json:"redisInvalidation"`
  LakehousePublication    string   `json:"lakehousePublication"`
  WorkflowProgression     string   `json:"workflowProgression"`
  AuthContext             string   `json:"authContext"`
  Middleware              []string `json:"middleware"`
  RecommendedPostingSeams []string `json:"recommendedPostingSeams"`
  Detail                  string   `json:"detail"`
}

type Catalog struct {
  Domains []Contract `json:"domains"`
}

func main() {
  catalog := Catalog{
    Domains: []Contract{
      {
        Domain:               "teller",
        PostingMode:          "direct_go_adapter",
        TigerBeetlePosting:   "queued_for_cash_confirmation",
        KafkaPublication:     "after_ledger_commit",
        PostgresPersistence:  "session_and_transaction_metadata",
        RedisInvalidation:    "till_and_session_cache_refresh",
        LakehousePublication: "cash_activity_snapshot",
        WorkflowProgression:  "awaiting_balance_confirmation",
        AuthContext:          "keycloak_and_permify_guarded",
        Middleware:           []string{"TigerBeetle", "Kafka", "Postgres", "Redis", "Lakehouse"},
        RecommendedPostingSeams: []string{
          "counter_transaction_confirmation",
          "vault_funding_release",
          "session_balance_lock",
        },
        Detail: "Teller cash events should post directly through a Go ledger adapter before reconciliation and downstream reporting continue.",
      },
      {
        Domain:               "islamic-banking",
        PostingMode:          "direct_go_adapter",
        TigerBeetlePosting:   "queued_for_contract_approval",
        KafkaPublication:     "after_ledger_commit",
        PostgresPersistence:  "contract_and_schedule_metadata",
        RedisInvalidation:    "exposure_and_pricing_cache_refresh",
        LakehousePublication: "portfolio_and_sharia_audit_snapshot",
        WorkflowProgression:  "awaiting_contract_authorization",
        AuthContext:          "keycloak_and_permify_guarded",
        Middleware:           []string{"TigerBeetle", "Kafka", "Postgres", "Redis", "Lakehouse", "Permify"},
        RecommendedPostingSeams: []string{
          "murabaha_disbursement_authorization",
          "ijara_rental_schedule_confirmation",
          "mudarabah_profit_distribution_approval",
        },
        Detail: "Islamic-finance commitments should use a Go posting adapter so approved contracts emit explicit TigerBeetle and downstream middleware outcomes instead of generic fallback notes.",
      },
      {
        Domain:               "agricultural-insurance",
        PostingMode:          "adjacent_go_adapter",
        TigerBeetlePosting:   "conditional_on_claim_settlement",
        KafkaPublication:     "after_claim_readiness_gate",
        PostgresPersistence:  "policy_and_claim_metadata",
        RedisInvalidation:    "claims_and_weather_risk_cache_refresh",
        LakehousePublication: "claims_settlement_snapshot",
        WorkflowProgression:  "awaiting_settlement_approval",
        AuthContext:          "keycloak_and_permify_guarded",
        Middleware:           []string{"TigerBeetle", "Kafka", "Postgres", "Redis", "Lakehouse", "Fluvio"},
        RecommendedPostingSeams: []string{
          "claim_settlement_release",
          "premium_reversal_authorization",
          "weather_trigger_payout_confirmation",
        },
        Detail: "Agricultural-insurance settlement events are the safest next adjacent ledger seam: only approved claim and premium movements should emit TigerBeetle outcomes through the Go contract path.",
      },
    },
  }

  sort.Slice(catalog.Domains, func(i, j int) bool {
    return catalog.Domains[i].Domain < catalog.Domains[j].Domain
  })

  encoder := json.NewEncoder(os.Stdout)
  encoder.SetIndent("", "  ")
  if err := encoder.Encode(catalog); err != nil {
    panic(err)
  }
}
