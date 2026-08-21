#!/usr/bin/env python3
"""
fix-go-outbox-relay.py — repair the fake outbox relay in Go services.

Confirmed pattern in 167 services: relayOutbox() SELECTs unpublished outbox
rows, logs "publishing event ...", and then unconditionally runs
    UPDATE outbox SET published = TRUE
without any Kafka produce — usually with the comment
    "marks as published even if Kafka unavailable to avoid infinite retry".
Events are silently lost.

This codemod rewrites the relay so that:
  * a sarama SyncProducer is created (lazily) from KAFKA_BROKERS,
  * each event is produced to Kafka FIRST,
  * `published = TRUE` is set ONLY for events Kafka confirmed,
  * failures stay published=FALSE and are retried on the next tick.

It also adds `github.com/IBM/sarama` to the service's go.mod require block
when missing (run `go mod tidy` afterwards to regenerate go.sum).

Idempotent: files whose relay already produces to Kafka (sarama SendMessage
present) or that do not match the fake pattern are skipped.

Usage:
  fix-go-outbox-relay.py [--apply] [PATH ...]
Default scan root: ./services ; default mode: DRY-RUN.
"""
import argparse
import re
import sys
from pathlib import Path

FAKE_RELAY_RE = re.compile(
    r"func relayOutbox\(brokers string, topic string\) \{.*?\n\}", re.S
)

REAL_RELAY = '''func relayOutbox(brokers string, topic string) {
	if db == nil { return }

	// Events are marked published ONLY after a confirmed Kafka produce.
	producer, err := getKafkaProducer(brokers)
	if err != nil {
		log.Printf("[outbox-relay] kafka unavailable: %v — events remain unpublished for retry", err)
		return
	}

	rows, err := db.Query(`SELECT id, event_type, aggregate_id, payload FROM outbox WHERE published = FALSE ORDER BY created_at LIMIT 100`)
	if err != nil { return }
	defer rows.Close()

	var ids []string
	for rows.Next() {
		var id, eventType, aggID string
		var payload []byte
		if err := rows.Scan(&id, &eventType, &aggID, &payload); err != nil { continue }
		_, _, err := producer.SendMessage(&sarama.ProducerMessage{
			Topic: topic,
			Key:   sarama.StringEncoder(aggID),
			Value: sarama.ByteEncoder(payload),
		})
		if err != nil {
			log.Printf("[outbox-relay] publish failed for event %s: %v — leaving unpublished for retry", id, err)
			continue
		}
		ids = append(ids, id)
	}
	if len(ids) == 0 { return }
	for _, id := range ids {
		if _, err := db.Exec(`UPDATE outbox SET published = TRUE WHERE id = $1`, id); err != nil {
			log.Printf("[outbox-relay] failed to mark event %s published: %v", id, err)
		}
	}
	if len(ids) > 0 {
		log.Printf("[outbox-relay] published %d events to kafka topic=%s", len(ids), topic)
	}
}

// getKafkaProducer lazily creates a shared sarama SyncProducer.
var kafkaProducer sarama.SyncProducer
var kafkaProducerMu sync.Mutex

func getKafkaProducer(brokers string) (sarama.SyncProducer, error) {
	kafkaProducerMu.Lock()
	defer kafkaProducerMu.Unlock()
	if kafkaProducer != nil {
		return kafkaProducer, nil
	}
	cfg := sarama.NewConfig()
	cfg.Producer.Return.Successes = true
	cfg.Producer.RequiredAcks = sarama.WaitForAll
	cfg.Producer.Retry.Max = 3
	p, err := sarama.NewSyncProducer(strings.Split(brokers, ","), cfg)
	if err != nil {
		return nil, err
	}
	kafkaProducer = p
	return kafkaProducer, nil
}
'''


def transform(src: str):
    if "getKafkaProducer" in src or "producer.SendMessage" in src:
        return src, False, ["relay already publishes via Kafka"]
    m = FAKE_RELAY_RE.search(src)
    if not m:
        return src, False, []
    body = m.group(0)
    if "marks as published" not in body and "UPDATE outbox SET published = TRUE" not in body:
        return src, False, ["relayOutbox present but pattern unrecognized; left unchanged"]
    if "SendMessage" in body:
        return src, False, ["relay already publishes via Kafka"]

    out = src[: m.start()] + REAL_RELAY + src[m.end():]
    notes = ["relayOutbox -> real sarama publish (mark published only on success)"]

    # add sarama import inside the import block
    if '"github.com/IBM/sarama"' not in out:
        out, n = re.subn(r'(\n\s*"github\.com/lib/pq"\n)', r'\1\t"github.com/IBM/sarama"\n', out, count=1)
        if n == 0:
            out, n = re.subn(r'(import\s*\(\n)', r'\1\t"github.com/IBM/sarama"\n', out, count=1)
        if n:
            notes.append("added sarama import")
        else:
            notes.append("WARNING: could not add sarama import — add manually")

    return out, True, notes


def fix_go_mod(go_mod: Path, apply: bool, notes: list):
    if not go_mod.exists():
        return
    src = go_mod.read_text(encoding="utf-8")
    if "github.com/IBM/sarama" in src:
        return
    new = None
    if re.search(r"^require \(\n", src, re.M):
        new = re.sub(r"^require \(\n", "require (\n\tgithub.com/IBM/sarama v1.43.3\n", src, count=1, flags=re.M)
    else:
        m = re.search(r"^require (\S+) (\S+)\n", src, re.M)
        if m:
            new = src.replace(
                m.group(0),
                "require (\n\tgithub.com/IBM/sarama v1.43.3\n\t%s %s\n)\n" % (m.group(1), m.group(2)),
                1,
            )
    if new:
        notes.append("go.mod: added sarama require (run `go mod tidy` for go.sum)")
        if apply:
            go_mod.write_text(new, encoding="utf-8")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true", help="write changes (default: dry-run)")
    ap.add_argument("paths", nargs="*", help="files/dirs to scan (default: ./services)")
    args = ap.parse_args()

    roots = [Path(p) for p in args.paths] if args.paths else [Path("services")]
    files = []
    for root in roots:
        if root.is_file():
            files.append(root)
        elif root.is_dir():
            files.extend(sorted(root.rglob("main.go")))

    changed = 0
    for f in files:
        src = f.read_text(encoding="utf-8")
        new, did_change, notes = transform(src)
        if not did_change:
            continue
        fix_go_mod(f.parent / "go.mod", args.apply, notes)
        changed += 1
        print(f"{'APPLY' if args.apply else 'DRY '} {f}: {'; '.join(notes)}")
        if args.apply:
            f.write_text(new, encoding="utf-8")
    print(f"\n{changed} file(s) {'modified' if args.apply else 'would be modified'}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
