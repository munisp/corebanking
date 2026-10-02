package main

// redis_store.go (c3-0762 / c3-0763 / c3-0764 / c3-0765 / c3-0766)
//
// Shared redis-backed stores for security-service:
//   - pooled go-redis client (canonical fleet pattern)
//   - API-key token-bucket Lua script (replaces the in-memory RateLimiter)
//   - cache-aside helpers for tenant config caching (audit / fraud / ipsec)
//
// OVERLAP NOTE: api_key_security.go is co-edited by batch C3-PX
// (c3-0761/0767/0768/0769 -> Postgres). This file plus the rateLimiter,
// keyCache, and audit/fraud/ipsec tenantConfig regions are C3-P1-B2D's
// scope; the API-key tenantConfig map and the other PG-target maps in
// api_key_security.go are C3-PX's scope. Both batches add the identical
// go-redis lines to go.mod (same b-side).

import (
	"context"
	"log"
	"os"
	"sync"
	"time"

	"github.com/redis/go-redis/v9"
)

// Pooled go-redis client (canonical fleet pattern: PoolSize 50, Dial 2s,
// Read/Write 3s, REDIS_URL env).
var (
	redisAddr       string
	redisClientOnce sync.Once
	redisClient     *redis.Client
	redisCtx        = context.Background()
)

func init() {
	redisAddr = os.Getenv("REDIS_URL")
	if redisAddr == "" {
		redisAddr = "localhost:6379"
	}
}

func getRedisClient() *redis.Client {
	redisClientOnce.Do(func() {
		redisClient = redis.NewClient(&redis.Options{
			Addr:         redisAddr,
			DialTimeout:  2 * time.Second,
			ReadTimeout:  3 * time.Second,
			WriteTimeout: 3 * time.Second,
			PoolSize:     50,
		})
	})
	return redisClient
}

// apiKeyRateLimitScript implements the API-key token bucket in redis
// (c3-0762). The refill math is identical to the retired in-memory
// RateLimiter: tokens refill at rateLimit/60 per second, capped at
// burstLimit; one token is consumed per request. The bucket expires after
// 60s idle (PEXPIRE), which replaces the 1-hour in-memory janitor.
//
//	KEYS[1] = ratelimit:apikey:{keyID}
//	ARGV[1] = refill rate (tokens per second)
//	ARGV[2] = max tokens (burst limit)
//	ARGV[3] = current time (unix milliseconds)
//	returns {limited (0|1), remaining tokens}
var apiKeyRateLimitScript = redis.NewScript(`
local data = redis.call('HMGET', KEYS[1], 'tokens', 'ts')
local tokens = tonumber(data[1])
local ts = tonumber(data[2])
local rate = tonumber(ARGV[1])
local max_tokens = tonumber(ARGV[2])
local now = tonumber(ARGV[3])
if tokens == nil or ts == nil then
  tokens = max_tokens
  ts = now
end
local elapsed = math.max(0, (now - ts) / 1000.0)
tokens = math.min(max_tokens, tokens + elapsed * rate)
local limited = 0
local remaining = 0
if tokens < 1 then
  limited = 1
else
  tokens = tokens - 1
  remaining = math.floor(tokens)
end
redis.call('HMSET', KEYS[1], 'tokens', tokens, 'ts', now)
redis.call('PEXPIRE', KEYS[1], 60000)
return {limited, remaining}
`)

// Tenant config cache keys (cache-aside, no TTL: configs change rarely and
// the PG write path refreshes the cache — see SetTenantConfig write-through
// in ip_security.go).
func configAuditKey(tenantID string) string { return "config:audit:" + tenantID }
func configFraudKey(tenantID string) string { return "config:fraud:" + tenantID }
func configIPSecKey(tenantID string) string { return "config:ipsec:" + tenantID }

// configCacheGet returns (value, true) on a cache hit. Any redis error is a
// logged MISS so callers fall through to Postgres (cache-aside: the cache is
// an accelerator, never the store of record).
func configCacheGet(key string) (string, bool) {
	v, err := getRedisClient().Get(redisCtx, key).Result()
	if err == redis.Nil {
		return "", false
	}
	if err != nil {
		log.Printf("security-service: config cache GET %s failed (falling through to PG): %v", key, err)
		return "", false
	}
	return v, true
}

// configCacheSet writes a config cache entry (no TTL). Failures are logged
// only — the next read falls through to Postgres and re-populates.
func configCacheSet(key, value string) {
	if err := getRedisClient().Set(redisCtx, key, value, 0).Err(); err != nil {
		log.Printf("security-service: config cache SET %s failed: %v", key, err)
	}
}
