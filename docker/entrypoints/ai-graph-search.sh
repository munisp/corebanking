#!/bin/bash
# 54Bank Consolidated Entrypoint — ai-graph-search
# Graph & Search — Neo4j, FalkorDB, Qdrant, KGQA, LangChain
# Services: 23 | Ports: 9105-9127
set -e

echo "[ai-graph-search] Starting 23 services..."

PIDS=()

cleanup() {
  echo "[ai-graph-search] Graceful shutdown..."
  for pid in "${PIDS[@]}"; do
    kill -TERM "$pid" 2>/dev/null || true
  done
  wait
  echo "[ai-graph-search] All services stopped."
  exit 0
}
trap cleanup SIGTERM SIGINT

PORT=9105 python3 /app/services/cocoindex-pipeline-py/main.py &
PIDS+=($!)
PORT=9106 python3 /app/services/epr-kgqa-engine-py/main.py &
PIDS+=($!)
PORT=9107 /app/services/epr-kgqa-go/epr-kgqa-go &
PIDS+=($!)
PORT=9108 python3 /app/services/epr-kgqa-py/main.py &
PIDS+=($!)
PORT=9109 /app/services/epr-kgqa-rs/epr_kgqa_rs &
PIDS+=($!)
PORT=9110 /app/services/falkordb-coa-go/falkordb-coa-go &
PIDS+=($!)
PORT=9111 python3 /app/services/falkordb-coa-py/main.py &
PIDS+=($!)
PORT=9112 /app/services/falkordb-coa-rs/falkordb_coa_rs &
PIDS+=($!)
PORT=9113 /app/services/falkordb-graph-engine-rs/falkordb_graph_engine_rs &
PIDS+=($!)
PORT=9114 /app/services/falkordb-graph-rs/falkordb_graph_rs &
PIDS+=($!)
PORT=9115 python3 /app/services/kgqa-reasoning-engine-py/main.py &
PIDS+=($!)
PORT=9116 /app/services/langchain-agent-go/langchain-agent-go &
PIDS+=($!)
PORT=9117 python3 /app/services/langchain-agent-py/main.py &
PIDS+=($!)
PORT=9118 /app/services/langchain-agent-rs/langchain_agent_rs &
PIDS+=($!)
PORT=9119 /app/services/neo4j-coa-graph-go/neo4j-coa-graph-go &
PIDS+=($!)
PORT=9120 python3 /app/services/neo4j-coa-graph-py/main.py &
PIDS+=($!)
PORT=9121 /app/services/neo4j-coa-graph-rs/neo4j_coa_graph_rs &
PIDS+=($!)
PORT=9122 /app/services/neo4j-knowledge-graph-go/neo4j-knowledge-graph-go &
PIDS+=($!)
PORT=9123 /app/services/ollama-inference-go/ollama-inference-go &
PIDS+=($!)
PORT=9124 /app/services/qdrant-financial-search-go/qdrant-financial-search-go &
PIDS+=($!)
PORT=9125 python3 /app/services/qdrant-financial-search-py/main.py &
PIDS+=($!)
PORT=9126 /app/services/qdrant-financial-search-rs/qdrant_financial_search_rs &
PIDS+=($!)
PORT=9127 /app/services/qdrant-vector-store-rs/qdrant_vector_store_rs &
PIDS+=($!)

echo "[ai-graph-search] All 23 services started (ports 9105-9127)"

# Wait for any child to exit
wait -n 2>/dev/null || wait
EXIT_CODE=$?
echo "[ai-graph-search] A service exited with code $EXIT_CODE"
cleanup
