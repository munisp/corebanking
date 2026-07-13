"""54Bank — Lakehouse REST API Server
Exposes the full lakehouse stack over HTTP:
  /v1/query          - SQL queries via DuckDB
  /v1/ingest         - Write data to bronze layer
  /v1/tables         - List all tables by layer
  /v1/table/{layer}/{name} - Read/write specific table
  /v1/time-travel    - Query historical versions
  /v1/schema         - Get/evolve table schemas
  /v1/etl/run        - Trigger ETL pipeline
  /v1/quality/run    - Run data quality checks
  /v1/cdc/event      - Submit CDC events
  /v1/health         - Health check
  /v1/stats          - Lakehouse statistics

Port: 8020 (LAKEHOUSE_PORT env var)
"""

import json
import logging
import os
import traceback
from datetime import datetime, timezone
from http.server import HTTPServer, BaseHTTPRequestHandler
from typing import Dict, Any

from lakehouse.engine.delta_engine import DeltaEngine, MedallionLayer, DELTA_AVAILABLE
from lakehouse.engine.query_engine import DuckDBQueryEngine, DUCKDB_AVAILABLE
from lakehouse.etl.medallion import MedallionPipeline
from lakehouse.etl.pg_extractor import PostgresExtractor
from lakehouse.etl.scheduler import ETLScheduler
from lakehouse.cdc.streaming import CDCConsumer
from lakehouse.quality.checks import DataQualityEngine

import pandas as pd

logger = logging.getLogger("54bank.lakehouse.server")

PORT = int(os.getenv("LAKEHOUSE_PORT", "8020"))


class LakehouseServer:
    """Singleton managing all lakehouse components."""

    def __init__(self):
        self.engine = DeltaEngine()
        self.query_engine = DuckDBQueryEngine(self.engine)
        self.pipeline = MedallionPipeline(self.engine)
        self.extractor = PostgresExtractor(self.engine)
        self.scheduler = ETLScheduler(self.engine)
        self.cdc = CDCConsumer(self.engine)
        self.quality = DataQualityEngine(self.engine)

        kafka_brokers = os.getenv("KAFKA_BROKERS", "")
        if kafka_brokers:
            self.cdc.start_kafka(kafka_brokers)
            logger.info(f"CDC Kafka consumer started: {kafka_brokers}")

    def bootstrap(self):
        """Bootstrap the lakehouse with synthetic data if empty."""
        all_tables = self.engine.list_tables()
        total = sum(len(v) for v in all_tables.values())
        if total == 0:
            logger.info("Empty lakehouse — bootstrapping with synthetic data...")
            self.extractor.extract_all(limit_per_table=2000)
            self.pipeline.run_full_pipeline()
            logger.info("Bootstrap complete")


_server: LakehouseServer = None


def get_server() -> LakehouseServer:
    global _server
    if _server is None:
        _server = LakehouseServer()
    return _server


class LakehouseHandler(BaseHTTPRequestHandler):
    """HTTP request handler for the lakehouse API."""

    def log_message(self, format, *args):
        logger.debug(format, *args)

    def _json_response(self, status: int, data: Any):
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(json.dumps(data, default=str).encode())

    def _read_body(self) -> Dict:
        length = int(self.headers.get("Content-Length", 0))
        if length == 0:
            return {}
        return json.loads(self.rfile.read(length))

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
        self.end_headers()

    def do_GET(self):
        srv = get_server()
        path = self.path.split("?")[0]

        try:
            if path == "/v1/health":
                self._json_response(200, {
                    "status": "healthy",
                    "delta_available": DELTA_AVAILABLE,
                    "duckdb_available": DUCKDB_AVAILABLE,
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                })

            elif path == "/v1/stats":
                self._json_response(200, {
                    "engine": srv.engine.stats(),
                    "query_engine": srv.query_engine.stats(),
                    "cdc": srv.cdc.stats,
                    "scheduler": srv.scheduler.status,
                })

            elif path == "/v1/tables":
                self._json_response(200, srv.engine.list_tables())

            elif path.startswith("/v1/tables/"):
                parts = path.split("/")
                if len(parts) >= 5:
                    layer, name = parts[3], parts[4]
                    df = srv.engine.read(layer, name)
                    self._json_response(200, {
                        "layer": layer, "table": name,
                        "rows": len(df),
                        "columns": list(df.columns),
                        "data": df.head(100).to_dict(orient="records"),
                    })
                else:
                    self._json_response(400, {"error": "Use /v1/tables/{layer}/{name}"})

            elif path.startswith("/v1/schema/"):
                parts = path.split("/")
                if len(parts) >= 5:
                    layer, name = parts[3], parts[4]
                    schema = srv.engine.schema(layer, name)
                    if schema:
                        self._json_response(200, {
                            "layer": layer, "table": name,
                            "fields": [{"name": f.name, "type": str(f.type)}
                                       for f in schema],
                        })
                    else:
                        self._json_response(404, {"error": "Table not found"})
                else:
                    self._json_response(400, {"error": "Use /v1/schema/{layer}/{name}"})

            elif path.startswith("/v1/history/"):
                parts = path.split("/")
                if len(parts) >= 5:
                    layer, name = parts[3], parts[4]
                    history = srv.engine.history(layer, name)
                    self._json_response(200, {"layer": layer, "table": name,
                                               "history": history})
                else:
                    self._json_response(400, {"error": "Use /v1/history/{layer}/{name}"})

            elif path == "/v1/quality/history":
                self._json_response(200, srv.quality.history)

            elif path == "/v1/scheduler/status":
                self._json_response(200, srv.scheduler.status)

            else:
                self._json_response(404, {"error": f"Unknown endpoint: {path}"})

        except Exception as e:
            logger.error(f"GET {path} error: {e}")
            self._json_response(500, {"error": str(e)})

    def do_POST(self):
        srv = get_server()
        path = self.path.split("?")[0]

        try:
            body = self._read_body()

            if path == "/v1/query":
                sql = body.get("sql", "")
                if not sql:
                    self._json_response(400, {"error": "Missing 'sql' field"})
                    return
                limit = body.get("limit", 10000)
                result = srv.query_engine.query(sql, limit=limit)
                self._json_response(200, result.to_dict())

            elif path == "/v1/ingest":
                layer = body.get("layer", "bronze")
                table = body.get("table", "")
                records = body.get("records", [])
                if not table or not records:
                    self._json_response(400, {"error": "Missing 'table' or 'records'"})
                    return
                df = pd.DataFrame(records)
                result = srv.engine.write(layer, table, df, mode="append")
                self._json_response(200, result)

            elif path == "/v1/time-travel":
                layer = body.get("layer", "bronze")
                table = body.get("table", "")
                version = body.get("version")
                if not table or version is None:
                    self._json_response(400, {"error": "Missing 'table' or 'version'"})
                    return
                df = srv.engine.read_at_version(layer, table, int(version))
                self._json_response(200, {
                    "layer": layer, "table": table, "version": version,
                    "rows": len(df),
                    "data": df.head(100).to_dict(orient="records"),
                })

            elif path == "/v1/etl/run":
                job = body.get("job")
                result = srv.scheduler.run_once(job)
                self._json_response(200, result)

            elif path == "/v1/etl/extract":
                table = body.get("table")
                limit = body.get("limit", 2000)
                if table:
                    result = srv.extractor.extract_table(table, limit)
                else:
                    result = srv.extractor.extract_all(limit)
                self._json_response(200, result)

            elif path == "/v1/etl/pipeline":
                result = srv.pipeline.run_full_pipeline()
                self._json_response(200, result)

            elif path == "/v1/quality/run":
                report = srv.quality.run_all_checks()
                self._json_response(200, report.to_dict())

            elif path == "/v1/cdc/event":
                topic = body.get("topic", "unknown")
                payload = body.get("payload", body)
                ok = srv.cdc.process_event(topic, payload)
                self._json_response(200, {"accepted": ok})

            elif path == "/v1/cdc/batch":
                events = body.get("events", [])
                result = srv.cdc.process_batch(events)
                self._json_response(200, result)

            elif path == "/v1/cdc/flush":
                srv.cdc.buffer.flush_all()
                self._json_response(200, {"status": "flushed", "stats": srv.cdc.stats})

            elif path == "/v1/schema/evolve":
                layer = body.get("layer")
                table = body.get("table")
                columns = body.get("columns", {})
                default = body.get("default_value")
                if not layer or not table or not columns:
                    self._json_response(400, {"error": "Missing layer/table/columns"})
                    return
                ok = srv.engine.add_columns(layer, table, columns, default)
                self._json_response(200, {"evolved": ok})

            elif path == "/v1/compact":
                layer = body.get("layer")
                table = body.get("table")
                if not layer or not table:
                    self._json_response(400, {"error": "Missing layer/table"})
                    return
                result = srv.engine.compact(layer, table)
                self._json_response(200, result)

            elif path == "/v1/scheduler/start":
                srv.scheduler.start()
                self._json_response(200, {"status": "started"})

            elif path == "/v1/scheduler/stop":
                srv.scheduler.stop()
                self._json_response(200, {"status": "stopped"})

            elif path == "/v1/bootstrap":
                srv.bootstrap()
                self._json_response(200, {"status": "bootstrapped", "stats": srv.engine.stats()})

            else:
                self._json_response(404, {"error": f"Unknown endpoint: {path}"})

        except Exception as e:
            logger.error(f"POST {path} error: {e}\n{traceback.format_exc()}")
            self._json_response(500, {"error": str(e)})


def main():
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(name)s] %(levelname)s: %(message)s",
    )
    srv = get_server()
    srv.bootstrap()

    httpd = HTTPServer(("0.0.0.0", PORT), LakehouseHandler)
    logger.info(f"54Bank Lakehouse server on :{PORT}")
    logger.info(f"  Delta Lake: {'available' if DELTA_AVAILABLE else 'UNAVAILABLE'}")
    logger.info(f"  DuckDB:     {'available' if DUCKDB_AVAILABLE else 'UNAVAILABLE'}")
    logger.info(f"  Root:       {srv.engine.root}")

    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        srv.cdc.stop()
        srv.scheduler.stop()
        httpd.server_close()


if __name__ == "__main__":
    main()
