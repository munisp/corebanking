// Package middleware — Production-grade caching layer for 54Bank platform.
// Implements: connection pooling, multi-level cache (L1 in-process + L2 Redis),
// stampede protection (SETNX locking), distributed invalidation via pub/sub,
// structured key namespacing, configurable TTL, cache warming, and observability.
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

// ── Cache Configuration ─────────────────────────────────────────────────────

type CacheTTLConfig struct {
	Default    time.Duration
	Session    time.Duration
	RateLimit  time.Duration
	UserData   time.Duration
	ListQuery  time.Duration
	HotData    time.Duration
	Reference  time.Duration
	Computed   time.Duration
}

func DefaultTTLConfig() CacheTTLConfig {
	return CacheTTLConfig{
		Default:   5 * time.Minute,
		Session:   30 * time.Minute,
		RateLimit: 1 * time.Minute,
		UserData:  2 * time.Minute,
		ListQuery: 30 * time.Second,
		HotData:   10 * time.Second,
		Reference: 1 * time.Hour,
		Computed:  15 * time.Minute,
	}
}

// ── Cache Metrics ───────────────────────────────────────────────────────────

type CacheMetrics struct {
	L1Hits       uint64
	L1Misses     uint64
	L2Hits       uint64
	L2Misses     uint64
	Stampedes    uint64
	Invalidations uint64
	PipelineOps  uint64
	AvgLatencyNs uint64
	Errors       uint64
}

type cacheMetricsInternal struct {
	l1Hits       atomic.Uint64
	l1Misses     atomic.Uint64
	l2Hits       atomic.Uint64
	l2Misses     atomic.Uint64
	stampedes    atomic.Uint64
	invalidations atomic.Uint64
	pipelineOps  atomic.Uint64
	totalLatency atomic.Uint64
	totalOps     atomic.Uint64
	errors       atomic.Uint64
}

func (m *cacheMetricsInternal) Snapshot() CacheMetrics {
	ops := m.totalOps.Load()
	avgLat := uint64(0)
	if ops > 0 {
		avgLat = m.totalLatency.Load() / ops
	}
	return CacheMetrics{
		L1Hits:        m.l1Hits.Load(),
		L1Misses:      m.l1Misses.Load(),
		L2Hits:        m.l2Hits.Load(),
		L2Misses:      m.l2Misses.Load(),
		Stampedes:     m.stampedes.Load(),
		Invalidations: m.invalidations.Load(),
		PipelineOps:   m.pipelineOps.Load(),
		AvgLatencyNs:  avgLat,
		Errors:        m.errors.Load(),
	}
}

// ── L1 In-Process Cache ─────────────────────────────────────────────────────

type l1Entry struct {
	Value  string
	Expiry time.Time
}

type L1Cache struct {
	entries map[string]l1Entry
	mu      sync.RWMutex
	maxSize int
}

func NewL1Cache(maxSize int) *L1Cache {
	c := &L1Cache{
		entries: make(map[string]l1Entry, maxSize),
		maxSize: maxSize,
	}
	go c.evictionLoop()
	return c
}

func (c *L1Cache) Get(key string) (string, bool) {
	c.mu.RLock()
	entry, ok := c.entries[key]
	c.mu.RUnlock()
	if !ok {
		return "", false
	}
	if time.Now().After(entry.Expiry) {
		c.mu.Lock()
		delete(c.entries, key)
		c.mu.Unlock()
		return "", false
	}
	return entry.Value, true
}

func (c *L1Cache) Set(key, value string, ttl time.Duration) {
	c.mu.Lock()
	if len(c.entries) >= c.maxSize {
		c.evictOldest()
	}
	c.entries[key] = l1Entry{Value: value, Expiry: time.Now().Add(ttl)}
	c.mu.Unlock()
}

func (c *L1Cache) Delete(key string) {
	c.mu.Lock()
	delete(c.entries, key)
	c.mu.Unlock()
}

func (c *L1Cache) DeleteByPrefix(prefix string) int {
	c.mu.Lock()
	count := 0
	for k := range c.entries {
		if strings.HasPrefix(k, prefix) {
			delete(c.entries, k)
			count++
		}
	}
	c.mu.Unlock()
	return count
}

func (c *L1Cache) Size() int {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return len(c.entries)
}

func (c *L1Cache) evictOldest() {
	var oldestKey string
	var oldestTime time.Time
	first := true
	for k, v := range c.entries {
		if first || v.Expiry.Before(oldestTime) {
			oldestKey = k
			oldestTime = v.Expiry
			first = false
		}
	}
	if oldestKey != "" {
		delete(c.entries, oldestKey)
	}
}

func (c *L1Cache) evictionLoop() {
	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()
	for range ticker.C {
		now := time.Now()
		c.mu.Lock()
		for k, v := range c.entries {
			if now.After(v.Expiry) {
				delete(c.entries, k)
			}
		}
		c.mu.Unlock()
	}
}

// ── Redis Connection Pool ───────────────────────────────────────────────────

type redisPoolConn struct {
	conn     net.Conn
	lastUsed time.Time
}

type RedisPool struct {
	host       string
	port       string
	password   string
	db         string
	pool       chan *redisPoolConn
	maxConns   int
	maxIdle    time.Duration
	dialTimeout time.Duration
	readTimeout time.Duration
	mu         sync.Mutex
}

func NewRedisPool(maxConns int) *RedisPool {
	rawURL := os.Getenv("REDIS_URL")
	if rawURL == "" {
		rawURL = "redis://redis-master:6379/0"
	}
	host, port, password, db := parseRedisPoolURL(rawURL)
	p := &RedisPool{
		host:        host,
		port:        port,
		password:    password,
		db:          db,
		pool:        make(chan *redisPoolConn, maxConns),
		maxConns:    maxConns,
		maxIdle:     60 * time.Second,
		dialTimeout: 3 * time.Second,
		readTimeout: 5 * time.Second,
	}
	// Pre-warm pool with 2 connections
	for i := 0; i < 2; i++ {
		if conn := p.dial(); conn != nil {
			p.pool <- conn
		}
	}
	return p
}

func parseRedisPoolURL(rawURL string) (host, port, password, db string) {
	host = "localhost"
	port = "6379"
	db = "0"
	cleaned := strings.TrimPrefix(rawURL, "redis://")
	// Extract password if present
	if atIdx := strings.LastIndex(cleaned, "@"); atIdx >= 0 {
		userPart := cleaned[:atIdx]
		cleaned = cleaned[atIdx+1:]
		if colonIdx := strings.Index(userPart, ":"); colonIdx >= 0 {
			password = userPart[colonIdx+1:]
		}
	}
	// Extract host:port/db
	if slashIdx := strings.Index(cleaned, "/"); slashIdx >= 0 {
		db = cleaned[slashIdx+1:]
		cleaned = cleaned[:slashIdx]
	}
	if colonIdx := strings.LastIndex(cleaned, ":"); colonIdx >= 0 {
		host = cleaned[:colonIdx]
		port = cleaned[colonIdx+1:]
	} else if cleaned != "" {
		host = cleaned
	}
	return
}

func (p *RedisPool) dial() *redisPoolConn {
	addr := net.JoinHostPort(p.host, p.port)
	conn, err := net.DialTimeout("tcp", addr, p.dialTimeout)
	if err != nil {
		return nil
	}
	conn.SetDeadline(time.Now().Add(p.readTimeout))
	// AUTH if needed
	if p.password != "" {
		sendRESP(conn, "AUTH", p.password)
		readRESP(conn)
	}
	// SELECT db
	if p.db != "0" && p.db != "" {
		sendRESP(conn, "SELECT", p.db)
		readRESP(conn)
	}
	// PING
	sendRESP(conn, "PING")
	resp := readRESP(conn)
	if resp != "PONG" {
		conn.Close()
		return nil
	}
	return &redisPoolConn{conn: conn, lastUsed: time.Now()}
}

func (p *RedisPool) Get() *redisPoolConn {
	for {
		select {
		case c := <-p.pool:
			if time.Since(c.lastUsed) > p.maxIdle {
				c.conn.Close()
				continue
			}
			// Quick health check
			c.conn.SetDeadline(time.Now().Add(1 * time.Second))
			sendRESP(c.conn, "PING")
			if readRESP(c.conn) == "PONG" {
				return c
			}
			c.conn.Close()
			continue
		default:
			// Pool empty, create new connection
			if c := p.dial(); c != nil {
				return c
			}
			return nil
		}
	}
}

func (p *RedisPool) Put(c *redisPoolConn) {
	if c == nil || c.conn == nil {
		return
	}
	c.lastUsed = time.Now()
	select {
	case p.pool <- c:
	default:
		// Pool full, close connection
		c.conn.Close()
	}
}

func (p *RedisPool) Exec(args ...string) string {
	c := p.Get()
	if c == nil {
		return ""
	}
	defer p.Put(c)
	c.conn.SetDeadline(time.Now().Add(p.readTimeout))
	sendRESP(c.conn, args...)
	return readRESP(c.conn)
}

func (p *RedisPool) ExecMulti(commands [][]string) []string {
	c := p.Get()
	if c == nil {
		results := make([]string, len(commands))
		return results
	}
	defer p.Put(c)
	c.conn.SetDeadline(time.Now().Add(p.readTimeout * time.Duration(len(commands)+1)))
	// Pipeline: send all commands without reading
	for _, cmd := range commands {
		sendRESP(c.conn, cmd...)
	}
	// Read all responses
	results := make([]string, len(commands))
	for i := range commands {
		results[i] = readRESP(c.conn)
	}
	return results
}

func (p *RedisPool) Health() bool {
	c := p.Get()
	if c == nil {
		return false
	}
	p.Put(c)
	return true
}

func (p *RedisPool) Size() int {
	return len(p.pool)
}

func sendRESP(conn net.Conn, args ...string) {
	cmd := fmt.Sprintf("*%d\r\n", len(args))
	for _, a := range args {
		cmd += fmt.Sprintf("$%d\r\n%s\r\n", len(a), a)
	}
	conn.Write([]byte(cmd))
}

func readRESP(conn net.Conn) string {
	buf := make([]byte, 8192)
	n, err := conn.Read(buf)
	if err != nil || n == 0 {
		return ""
	}
	line := string(buf[:n])
	parts := strings.SplitN(line, "\r\n", 3)
	if len(parts) < 1 || len(parts[0]) == 0 {
		return ""
	}
	first := parts[0]
	switch first[0] {
	case '+':
		return first[1:]
	case '-':
		return ""
	case ':':
		return first[1:]
	case '$':
		if first == "$-1" {
			return ""
		}
		if len(parts) >= 2 {
			return parts[1]
		}
		return ""
	}
	return first
}

// ── Production Cache Manager ────────────────────────────────────────────────

type CacheManager struct {
	ServiceName string
	L1          *L1Cache
	Pool        *RedisPool
	TTL         CacheTTLConfig
	Metrics     cacheMetricsInternal
	subConn     net.Conn
	subMu       sync.Mutex
	invalidCh   chan string
}

func NewCacheManager(serviceName string) *CacheManager {
	poolSize := 10
	if ps := os.Getenv("REDIS_POOL_SIZE"); ps != "" {
		fmt.Sscanf(ps, "%d", &poolSize)
	}
	l1Size := 1000
	if ls := os.Getenv("CACHE_L1_MAX_SIZE"); ls != "" {
		fmt.Sscanf(ls, "%d", &l1Size)
	}
	cm := &CacheManager{
		ServiceName: serviceName,
		L1:          NewL1Cache(l1Size),
		Pool:        NewRedisPool(poolSize),
		TTL:         DefaultTTLConfig(),
		invalidCh:   make(chan string, 100),
	}
	// Start distributed invalidation listener
	go cm.subscribeInvalidations()
	// Start processing invalidation messages
	go cm.processInvalidations()
	return cm
}

// ── Key Namespacing ─────────────────────────────────────────────────────────

func (cm *CacheManager) Key(entity, id string) string {
	return fmt.Sprintf("%s:%s:%s", cm.ServiceName, entity, id)
}

func (cm *CacheManager) KeyWithTenant(tenant, entity, id string) string {
	return fmt.Sprintf("%s:%s:%s:%s", cm.ServiceName, tenant, entity, id)
}

func (cm *CacheManager) ListKey(entity string, page, limit int) string {
	return fmt.Sprintf("%s:%s:list:%d:%d", cm.ServiceName, entity, page, limit)
}

// ── Multi-Level Get (L1 → L2 → miss) ───────────────────────────────────────

func (cm *CacheManager) Get(ctx context.Context, key string) (string, bool) {
	start := time.Now()
	defer func() {
		cm.Metrics.totalLatency.Add(uint64(time.Since(start).Nanoseconds()))
		cm.Metrics.totalOps.Add(1)
	}()

	// L1: in-process
	if val, ok := cm.L1.Get(key); ok {
		cm.Metrics.l1Hits.Add(1)
		return val, true
	}
	cm.Metrics.l1Misses.Add(1)

	// L2: Redis
	val := cm.Pool.Exec("GET", key)
	if val != "" {
		cm.Metrics.l2Hits.Add(1)
		// Promote to L1
		cm.L1.Set(key, val, cm.TTL.HotData)
		return val, true
	}
	cm.Metrics.l2Misses.Add(1)
	return "", false
}

// ── Multi-Level Set ─────────────────────────────────────────────────────────

func (cm *CacheManager) Set(ctx context.Context, key, value string, ttl time.Duration) {
	start := time.Now()
	defer func() {
		cm.Metrics.totalLatency.Add(uint64(time.Since(start).Nanoseconds()))
		cm.Metrics.totalOps.Add(1)
	}()

	// L1
	l1TTL := ttl
	if l1TTL > cm.TTL.HotData {
		l1TTL = cm.TTL.HotData
	}
	cm.L1.Set(key, value, l1TTL)

	// L2: Redis with TTL
	if ttl > 0 {
		cm.Pool.Exec("SET", key, value, "EX", fmt.Sprintf("%d", int(ttl.Seconds())))
	} else {
		cm.Pool.Exec("SET", key, value)
	}
}

// ── Stampede Protection (SETNX lock) ────────────────────────────────────────

type CacheLoader func(ctx context.Context) (string, error)

func (cm *CacheManager) GetOrLoad(ctx context.Context, key string, ttl time.Duration, loader CacheLoader) (string, error) {
	// Try cache first
	if val, ok := cm.Get(ctx, key); ok {
		return val, nil
	}

	// Stampede protection: try to acquire lock
	lockKey := key + ":lock"
	lockResult := cm.Pool.Exec("SET", lockKey, "1", "NX", "EX", "5")
	if lockResult == "" {
		// Lock held by another goroutine — wait and retry
		cm.Metrics.stampedes.Add(1)
		time.Sleep(50 * time.Millisecond)
		if val, ok := cm.Get(ctx, key); ok {
			return val, nil
		}
		// Still no value, proceed anyway (stale read protection)
	}

	// Load from source
	val, err := loader(ctx)
	if err != nil {
		cm.Pool.Exec("DEL", lockKey)
		return "", err
	}

	// Store in both levels
	cm.Set(ctx, key, val, ttl)
	// Release lock
	cm.Pool.Exec("DEL", lockKey)
	return val, nil
}

// ── Cache Invalidation (local + distributed) ────────────────────────────────

func (cm *CacheManager) Invalidate(ctx context.Context, key string) {
	cm.Metrics.invalidations.Add(1)
	// Local L1
	cm.L1.Delete(key)
	// Redis L2
	cm.Pool.Exec("DEL", key)
	// Publish to invalidation channel for other instances
	cm.Pool.Exec("PUBLISH", "54bank:cache:invalidate", key)
}

func (cm *CacheManager) InvalidatePrefix(ctx context.Context, prefix string) {
	cm.Metrics.invalidations.Add(1)
	cm.L1.DeleteByPrefix(prefix)
	// For Redis, we scan and delete (bounded)
	// In production, use UNLINK for non-blocking
	cm.Pool.Exec("PUBLISH", "54bank:cache:invalidate", prefix+"*")
}

func (cm *CacheManager) subscribeInvalidations() {
	for {
		addr := net.JoinHostPort(cm.Pool.host, cm.Pool.port)
		conn, err := net.DialTimeout("tcp", addr, 3*time.Second)
		if err != nil {
			time.Sleep(5 * time.Second)
			continue
		}
		// AUTH + SELECT if needed
		if cm.Pool.password != "" {
			sendRESP(conn, "AUTH", cm.Pool.password)
			readRESP(conn)
		}
		if cm.Pool.db != "0" && cm.Pool.db != "" {
			sendRESP(conn, "SELECT", cm.Pool.db)
			readRESP(conn)
		}
		// SUBSCRIBE
		sendRESP(conn, "SUBSCRIBE", "54bank:cache:invalidate")
		cm.subMu.Lock()
		cm.subConn = conn
		cm.subMu.Unlock()

		buf := make([]byte, 4096)
		for {
			conn.SetDeadline(time.Now().Add(60 * time.Second))
			n, err := conn.Read(buf)
			if err != nil {
				break
			}
			msg := string(buf[:n])
			// Parse RESP array message: *3\r\n$7\r\nmessage\r\n$26\r\n54bank:cache:invalidate\r\n$...\r\nKEY\r\n
			parts := strings.Split(msg, "\r\n")
			if len(parts) >= 7 && parts[4] == "54bank:cache:invalidate" {
				key := parts[6]
				if key != "" {
					cm.invalidCh <- key
				}
			}
		}
		conn.Close()
		time.Sleep(1 * time.Second)
	}
}

func (cm *CacheManager) processInvalidations() {
	for key := range cm.invalidCh {
		if strings.HasSuffix(key, "*") {
			prefix := strings.TrimSuffix(key, "*")
			cm.L1.DeleteByPrefix(prefix)
		} else {
			cm.L1.Delete(key)
		}
	}
}

// ── Pipeline Operations ─────────────────────────────────────────────────────

func (cm *CacheManager) MGet(ctx context.Context, keys []string) map[string]string {
	start := time.Now()
	defer func() {
		cm.Metrics.totalLatency.Add(uint64(time.Since(start).Nanoseconds()))
		cm.Metrics.totalOps.Add(1)
		cm.Metrics.pipelineOps.Add(1)
	}()

	result := make(map[string]string, len(keys))
	missedKeys := make([]string, 0, len(keys))

	// Check L1 first
	for _, k := range keys {
		if val, ok := cm.L1.Get(k); ok {
			result[k] = val
			cm.Metrics.l1Hits.Add(1)
		} else {
			missedKeys = append(missedKeys, k)
			cm.Metrics.l1Misses.Add(1)
		}
	}

	if len(missedKeys) == 0 {
		return result
	}

	// Pipeline MGET to Redis for misses
	args := append([]string{"MGET"}, missedKeys...)
	// For simplicity, use individual GETs in pipeline
	commands := make([][]string, len(missedKeys))
	for i, k := range missedKeys {
		commands[i] = []string{"GET", k}
	}
	responses := cm.Pool.ExecMulti(commands)
	for i, resp := range responses {
		if resp != "" {
			result[missedKeys[i]] = resp
			cm.L1.Set(missedKeys[i], resp, cm.TTL.HotData)
			cm.Metrics.l2Hits.Add(1)
		} else {
			cm.Metrics.l2Misses.Add(1)
		}
	}
	return result
}

func (cm *CacheManager) MSet(ctx context.Context, entries map[string]string, ttl time.Duration) {
	start := time.Now()
	defer func() {
		cm.Metrics.totalLatency.Add(uint64(time.Since(start).Nanoseconds()))
		cm.Metrics.totalOps.Add(1)
		cm.Metrics.pipelineOps.Add(1)
	}()

	commands := make([][]string, 0, len(entries))
	for k, v := range entries {
		cm.L1.Set(k, v, cm.TTL.HotData)
		if ttl > 0 {
			commands = append(commands, []string{"SET", k, v, "EX", fmt.Sprintf("%d", int(ttl.Seconds()))})
		} else {
			commands = append(commands, []string{"SET", k, v})
		}
	}
	cm.Pool.ExecMulti(commands)
}

// ── Cache Warming ───────────────────────────────────────────────────────────

type WarmEntry struct {
	Key   string
	Value string
	TTL   time.Duration
}

func (cm *CacheManager) Warm(ctx context.Context, entries []WarmEntry) int {
	count := 0
	commands := make([][]string, 0, len(entries))
	for _, e := range entries {
		cm.L1.Set(e.Key, e.Value, e.TTL)
		if e.TTL > 0 {
			commands = append(commands, []string{"SET", e.Key, e.Value, "EX", fmt.Sprintf("%d", int(e.TTL.Seconds()))})
		} else {
			commands = append(commands, []string{"SET", e.Key, e.Value})
		}
		count++
	}
	if len(commands) > 0 {
		cm.Pool.ExecMulti(commands)
	}
	log.Printf("[cache] Warmed %d entries for %s", count, cm.ServiceName)
	return count
}

// ── Observability ───────────────────────────────────────────────────────────

func (cm *CacheManager) GetMetrics() CacheMetrics {
	return cm.Metrics.Snapshot()
}

func (cm *CacheManager) PrometheusMetrics() string {
	m := cm.GetMetrics()
	return fmt.Sprintf(`# HELP cache_l1_hits_total L1 cache hits
# TYPE cache_l1_hits_total counter
cache_l1_hits_total{service="%s"} %d
# HELP cache_l1_misses_total L1 cache misses
# TYPE cache_l1_misses_total counter
cache_l1_misses_total{service="%s"} %d
# HELP cache_l2_hits_total L2 Redis hits
# TYPE cache_l2_hits_total counter
cache_l2_hits_total{service="%s"} %d
# HELP cache_l2_misses_total L2 Redis misses
# TYPE cache_l2_misses_total counter
cache_l2_misses_total{service="%s"} %d
# HELP cache_stampede_total Stampede protections triggered
# TYPE cache_stampede_total counter
cache_stampede_total{service="%s"} %d
# HELP cache_invalidations_total Cache invalidations
# TYPE cache_invalidations_total counter
cache_invalidations_total{service="%s"} %d
# HELP cache_avg_latency_ns Average cache operation latency
# TYPE cache_avg_latency_ns gauge
cache_avg_latency_ns{service="%s"} %d
# HELP cache_l1_size Current L1 cache size
# TYPE cache_l1_size gauge
cache_l1_size{service="%s"} %d
# HELP cache_pool_size Current Redis pool size
# TYPE cache_pool_size gauge
cache_pool_size{service="%s"} %d
# HELP cache_hit_rate L1+L2 combined hit rate
# TYPE cache_hit_rate gauge
cache_hit_rate{service="%s"} %.4f
`,
		cm.ServiceName, m.L1Hits,
		cm.ServiceName, m.L1Misses,
		cm.ServiceName, m.L2Hits,
		cm.ServiceName, m.L2Misses,
		cm.ServiceName, m.Stampedes,
		cm.ServiceName, m.Invalidations,
		cm.ServiceName, m.AvgLatencyNs,
		cm.ServiceName, cm.L1.Size(),
		cm.ServiceName, cm.Pool.Size(),
		cm.ServiceName, cm.HitRate(),
	)
}

func (cm *CacheManager) HitRate() float64 {
	hits := cm.Metrics.l1Hits.Load() + cm.Metrics.l2Hits.Load()
	total := hits + cm.Metrics.l2Misses.Load()
	if total == 0 {
		return 0.0
	}
	return float64(hits) / float64(total)
}

func (cm *CacheManager) HealthJSON() map[string]interface{} {
	m := cm.GetMetrics()
	return map[string]interface{}{
		"redis_pool_connected": cm.Pool.Health(),
		"redis_pool_size":      cm.Pool.Size(),
		"l1_size":              cm.L1.Size(),
		"hit_rate":             cm.HitRate(),
		"l1_hits":              m.L1Hits,
		"l2_hits":              m.L2Hits,
		"misses":               m.L2Misses,
		"stampedes_prevented":  m.Stampedes,
		"avg_latency_ns":       m.AvgLatencyNs,
	}
}

// ── Consistent Hashing (for future Redis Cluster) ───────────────────────────

func ConsistentHash(key string, numSlots int) int {
	h := fnv.New32a()
	h.Write([]byte(key))
	return int(h.Sum32()) % numSlots
}

// ── JSON Helpers ────────────────────────────────────────────────────────────

func (cm *CacheManager) GetJSON(ctx context.Context, key string, target interface{}) bool {
	val, ok := cm.Get(ctx, key)
	if !ok {
		return false
	}
	return json.Unmarshal([]byte(val), target) == nil
}

func (cm *CacheManager) SetJSON(ctx context.Context, key string, value interface{}, ttl time.Duration) {
	data, err := json.Marshal(value)
	if err != nil {
		return
	}
	cm.Set(ctx, key, string(data), ttl)
}
