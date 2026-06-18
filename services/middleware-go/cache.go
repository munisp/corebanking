package middleware

import (
	"context"
	"encoding/json"
	"fmt"
	"hash/fnv"
	"log"
	"net"
	"os"
	"strings"
	"sync"
	"sync/atomic"
	"time"
)

// ── Redis Pool ──────────────────────────────────────────────────────────────

type RedisPool struct {
	addr string
	conn net.Conn
	mu   sync.Mutex
}

func NewRedisPool(addr string) *RedisPool {
	return &RedisPool{addr: addr}
}

func (p *RedisPool) Exec(args ...string) string {
	p.mu.Lock()
	defer p.mu.Unlock()
	if p.conn == nil {
		c, err := net.DialTimeout("tcp", p.addr, 2*time.Second)
		if err != nil {
			return ""
		}
		p.conn = c
	}
	// RESP protocol
	cmd := fmt.Sprintf("*%d\r\n", len(args))
	for _, a := range args {
		cmd += fmt.Sprintf("$%d\r\n%s\r\n", len(a), a)
	}
	_, _ = p.conn.Write([]byte(cmd))
	buf := make([]byte, 4096)
	_ = p.conn.SetReadDeadline(time.Now().Add(1 * time.Second))
	n, _ := p.conn.Read(buf)
	return string(buf[:n])
}

func (p *RedisPool) ExecMulti(cmds [][]string) []string {
	results := make([]string, len(cmds))
	for i, cmd := range cmds {
		results[i] = p.Exec(cmd...)
	}
	return results
}

// ── Cache Metrics ───────────────────────────────────────────────────────────

type CacheMetrics struct {
	hits       atomic.Int64
	misses     atomic.Int64
	stampedes  atomic.Int64
	evictions  atomic.Int64
}

// ── Cache Configuration ─────────────────────────────────────────────────────

type CacheTTLConfig struct {
	Default   time.Duration
	Session   time.Duration
	RateLimit time.Duration
	UserData  time.Duration
	ListQuery time.Duration
	HotData   time.Duration
	Reference time.Duration
	Computed  time.Duration
}

// ── L1 in-process cache entry ───────────────────────────────────────────────

type l1Entry struct {
	value   string
	expires time.Time
}

// ── CacheManager ────────────────────────────────────────────────────────────

type CacheManager struct {
	Pool    *RedisPool
	TTL     CacheTTLConfig
	Metrics CacheMetrics
	l1      sync.Map
	prefix  string
}

func NewCacheManager() *CacheManager {
	addr := os.Getenv("REDIS_URL")
	if addr == "" {
		addr = "localhost:6379"
	}
	return &CacheManager{
		Pool:   NewRedisPool(addr),
		prefix: "54bank:",
		TTL: CacheTTLConfig{
			Default:   5 * time.Minute,
			Session:   30 * time.Minute,
			RateLimit: 1 * time.Second,
			UserData:  2 * time.Minute,
			ListQuery: 30 * time.Second,
			HotData:   10 * time.Second,
			Reference: 1 * time.Hour,
			Computed:  5 * time.Minute,
		},
	}
}

func (cm *CacheManager) nsKey(key string) string {
	h := fnv.New64a()
	_, _ = h.Write([]byte(key))
	return fmt.Sprintf("%s%s:%x", cm.prefix, strings.Split(key, ":")[0], h.Sum64())
}

func (cm *CacheManager) Get(ctx context.Context, key string) (string, bool) {
	nsKey := cm.nsKey(key)
	// L1
	if entry, ok := cm.l1.Load(nsKey); ok {
		e := entry.(*l1Entry)
		if time.Now().Before(e.expires) {
			cm.Metrics.hits.Add(1)
			return e.value, true
		}
		cm.l1.Delete(nsKey)
	}
	// L2 Redis
	resp := cm.Pool.Exec("GET", nsKey)
	if resp != "" && !strings.HasPrefix(resp, "-") && !strings.HasPrefix(resp, "$-1") {
		// Parse RESP bulk string
		val := parseRESP(resp)
		if val != "" {
			cm.Metrics.hits.Add(1)
			cm.l1.Store(nsKey, &l1Entry{value: val, expires: time.Now().Add(cm.TTL.HotData)})
			return val, true
		}
	}
	cm.Metrics.misses.Add(1)
	return "", false
}

func (cm *CacheManager) Set(ctx context.Context, key, value string, ttl time.Duration) {
	nsKey := cm.nsKey(key)
	cm.l1.Store(nsKey, &l1Entry{value: value, expires: time.Now().Add(ttl)})
	cm.Pool.Exec("SET", nsKey, value, "EX", fmt.Sprintf("%d", int(ttl.Seconds())))
}

func (cm *CacheManager) Delete(ctx context.Context, key string) {
	nsKey := cm.nsKey(key)
	cm.l1.Delete(nsKey)
	cm.Pool.Exec("DEL", nsKey)
	cm.Metrics.evictions.Add(1)
}

func (cm *CacheManager) Stats() map[string]int64 {
	return map[string]int64{
		"hits":      cm.Metrics.hits.Load(),
		"misses":    cm.Metrics.misses.Load(),
		"stampedes": cm.Metrics.stampedes.Load(),
		"evictions": cm.Metrics.evictions.Load(),
	}
}

type CacheLoader func(ctx context.Context) (string, error)

func (cm *CacheManager) GetOrLoad(ctx context.Context, key string, ttl time.Duration, loader CacheLoader) (string, error) {
	if val, ok := cm.Get(ctx, key); ok {
		return val, nil
	}
	lockKey := key + ":lock"
	lockResult := cm.Pool.Exec("SET", lockKey, "1", "NX", "EX", "5")
	if lockResult == "" {
		cm.Metrics.stampedes.Add(1)
		time.Sleep(50 * time.Millisecond)
		if val, ok := cm.Get(ctx, key); ok {
			return val, nil
		}
	}
	val, err := loader(ctx)
	if err != nil {
		cm.Pool.Exec("DEL", lockKey)
		return "", err
	}
	cm.Set(ctx, key, val, ttl)
	cm.Pool.Exec("DEL", lockKey)
	return val, nil
}

func parseRESP(resp string) string {
	lines := strings.Split(resp, "\r\n")
	if len(lines) >= 2 && strings.HasPrefix(lines[0], "$") {
		return lines[1]
	}
	if strings.HasPrefix(resp, "+") {
		return strings.TrimPrefix(strings.TrimSpace(resp), "+")
	}
	return ""
}

// suppress unused import warnings
var _ = json.Marshal
var _ = log.Println
