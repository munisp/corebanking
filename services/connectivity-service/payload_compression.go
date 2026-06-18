package main

import (
	"bytes"
	"compress/gzip"
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/klauspost/compress/lz4"
	"github.com/klauspost/compress/zstd"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

// Prometheus metrics
var (
	compressionRatio = promauto.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "payload_compression_ratio",
			Help:    "Compression ratio achieved",
			Buckets: []float64{0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0},
		},
		[]string{"algorithm"},
	)

	compressionTime = promauto.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "payload_compression_time_seconds",
			Help:    "Time taken to compress payload",
			Buckets: prometheus.DefBuckets,
		},
		[]string{"algorithm", "operation"},
	)

	compressedPayloads = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "compressed_payloads_total",
			Help: "Total compressed payloads",
		},
		[]string{"algorithm", "network_type"},
	)
)

// CompressionAlgorithm represents supported compression algorithms
type CompressionAlgorithm string

const (
	AlgoNone  CompressionAlgorithm = "none"
	AlgoGzip  CompressionAlgorithm = "gzip"
	AlgoLZ4   CompressionAlgorithm = "lz4"
	AlgoZstd  CompressionAlgorithm = "zstd"
)

// NetworkType represents network connection types
type NetworkType string

const (
	Network2G   NetworkType = "2G"
	Network3G   NetworkType = "3G"
	Network4G   NetworkType = "4G"
	Network5G   NetworkType = "5G"
	NetworkWifi NetworkType = "WIFI"
	NetworkEdge NetworkType = "EDGE"
	NetworkGPRS NetworkType = "GPRS"
)

// CompressionLevel represents compression levels
type CompressionLevel int

const (
	LevelFastest CompressionLevel = 1
	LevelDefault CompressionLevel = 5
	LevelBest    CompressionLevel = 9
)

// PayloadCompressor handles payload compression for low-bandwidth networks
type PayloadCompressor struct {
	gzipPool    sync.Pool
	lz4Pool     sync.Pool
	zstdEncoder *zstd.Encoder
	zstdDecoder *zstd.Decoder
}

// CompressedPayload represents a compressed payload
type CompressedPayload struct {
	Algorithm      CompressionAlgorithm `json:"algorithm"`
	OriginalSize   int                  `json:"original_size"`
	CompressedSize int                  `json:"compressed_size"`
	Data           string               `json:"data"` // Base64 encoded
	Checksum       string               `json:"checksum"`
	Timestamp      time.Time            `json:"timestamp"`
}

// NetworkConfig holds network-specific compression settings
type NetworkConfig struct {
	Algorithm        CompressionAlgorithm
	Level            CompressionLevel
	MinSizeToCompress int
	MaxPayloadSize   int
	ChunkSize        int
}

// DefaultNetworkConfigs provides optimal settings for each network type
var DefaultNetworkConfigs = map[NetworkType]NetworkConfig{
	Network2G: {
		Algorithm:        AlgoLZ4,  // Fast decompression, good for slow CPUs
		Level:            LevelBest,
		MinSizeToCompress: 100,     // Compress even small payloads
		MaxPayloadSize:   10240,    // 10KB max for 2G
		ChunkSize:        1024,     // 1KB chunks
	},
	NetworkEdge: {
		Algorithm:        AlgoLZ4,
		Level:            LevelBest,
		MinSizeToCompress: 100,
		MaxPayloadSize:   20480,    // 20KB
		ChunkSize:        2048,
	},
	NetworkGPRS: {
		Algorithm:        AlgoLZ4,
		Level:            LevelBest,
		MinSizeToCompress: 100,
		MaxPayloadSize:   10240,
		ChunkSize:        1024,
	},
	Network3G: {
		Algorithm:        AlgoGzip,
		Level:            LevelDefault,
		MinSizeToCompress: 500,
		MaxPayloadSize:   102400,   // 100KB
		ChunkSize:        8192,
	},
	Network4G: {
		Algorithm:        AlgoZstd,  // Best ratio
		Level:            LevelDefault,
		MinSizeToCompress: 1024,
		MaxPayloadSize:   1048576,  // 1MB
		ChunkSize:        65536,
	},
	Network5G: {
		Algorithm:        AlgoZstd,
		Level:            LevelFastest,
		MinSizeToCompress: 4096,
		MaxPayloadSize:   10485760, // 10MB
		ChunkSize:        262144,
	},
	NetworkWifi: {
		Algorithm:        AlgoZstd,
		Level:            LevelFastest,
		MinSizeToCompress: 4096,
		MaxPayloadSize:   10485760,
		ChunkSize:        262144,
	},
}

// NewPayloadCompressor creates a new payload compressor
func NewPayloadCompressor() (*PayloadCompressor, error) {
	zstdEnc, err := zstd.NewWriter(nil, zstd.WithEncoderLevel(zstd.SpeedDefault))
	if err != nil {
		return nil, fmt.Errorf("failed to create zstd encoder: %w", err)
	}

	zstdDec, err := zstd.NewReader(nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create zstd decoder: %w", err)
	}

	return &PayloadCompressor{
		gzipPool: sync.Pool{
			New: func() interface{} {
				return gzip.NewWriter(nil)
			},
		},
		lz4Pool: sync.Pool{
			New: func() interface{} {
				return lz4.NewWriter(nil)
			},
		},
		zstdEncoder: zstdEnc,
		zstdDecoder: zstdDec,
	}, nil
}

// Compress compresses data using the specified algorithm
func (c *PayloadCompressor) Compress(data []byte, algo CompressionAlgorithm, level CompressionLevel) (*CompressedPayload, error) {
	start := time.Now()
	defer func() {
		compressionTime.WithLabelValues(string(algo), "compress").Observe(time.Since(start).Seconds())
	}()

	if len(data) == 0 {
		return nil, fmt.Errorf("empty data")
	}

	var compressed []byte
	var err error

	switch algo {
	case AlgoGzip:
		compressed, err = c.compressGzip(data, level)
	case AlgoLZ4:
		compressed, err = c.compressLZ4(data)
	case AlgoZstd:
		compressed, err = c.compressZstd(data)
	case AlgoNone:
		compressed = data
	default:
		return nil, fmt.Errorf("unsupported algorithm: %s", algo)
	}

	if err != nil {
		return nil, err
	}

	ratio := float64(len(compressed)) / float64(len(data))
	compressionRatio.WithLabelValues(string(algo)).Observe(ratio)

	// Calculate checksum
	checksum := calculateChecksum(compressed)

	return &CompressedPayload{
		Algorithm:      algo,
		OriginalSize:   len(data),
		CompressedSize: len(compressed),
		Data:           base64.StdEncoding.EncodeToString(compressed),
		Checksum:       checksum,
		Timestamp:      time.Now(),
	}, nil
}

// Decompress decompresses a compressed payload
func (c *PayloadCompressor) Decompress(payload *CompressedPayload) ([]byte, error) {
	start := time.Now()
	defer func() {
		compressionTime.WithLabelValues(string(payload.Algorithm), "decompress").Observe(time.Since(start).Seconds())
	}()

	compressed, err := base64.StdEncoding.DecodeString(payload.Data)
	if err != nil {
		return nil, fmt.Errorf("failed to decode base64: %w", err)
	}

	// Verify checksum
	if calculateChecksum(compressed) != payload.Checksum {
		return nil, fmt.Errorf("checksum mismatch")
	}

	var decompressed []byte

	switch payload.Algorithm {
	case AlgoGzip:
		decompressed, err = c.decompressGzip(compressed)
	case AlgoLZ4:
		decompressed, err = c.decompressLZ4(compressed, payload.OriginalSize)
	case AlgoZstd:
		decompressed, err = c.decompressZstd(compressed)
	case AlgoNone:
		decompressed = compressed
	default:
		return nil, fmt.Errorf("unsupported algorithm: %s", payload.Algorithm)
	}

	return decompressed, err
}

// CompressForNetwork compresses data optimized for the given network type
func (c *PayloadCompressor) CompressForNetwork(data []byte, networkType NetworkType) (*CompressedPayload, error) {
	config, ok := DefaultNetworkConfigs[networkType]
	if !ok {
		config = DefaultNetworkConfigs[Network3G] // Default to 3G settings
	}

	// Skip compression for small payloads
	if len(data) < config.MinSizeToCompress {
		return &CompressedPayload{
			Algorithm:      AlgoNone,
			OriginalSize:   len(data),
			CompressedSize: len(data),
			Data:           base64.StdEncoding.EncodeToString(data),
			Checksum:       calculateChecksum(data),
			Timestamp:      time.Now(),
		}, nil
	}

	// Truncate if exceeds max size
	if len(data) > config.MaxPayloadSize {
		data = data[:config.MaxPayloadSize]
	}

	compressedPayloads.WithLabelValues(string(config.Algorithm), string(networkType)).Inc()

	return c.Compress(data, config.Algorithm, config.Level)
}

// compressGzip compresses using gzip
func (c *PayloadCompressor) compressGzip(data []byte, level CompressionLevel) ([]byte, error) {
	var buf bytes.Buffer
	
	writer := c.gzipPool.Get().(*gzip.Writer)
	defer c.gzipPool.Put(writer)
	
	writer.Reset(&buf)
	
	// Set compression level
	var gzipLevel int
	switch level {
	case LevelFastest:
		gzipLevel = gzip.BestSpeed
	case LevelBest:
		gzipLevel = gzip.BestCompression
	default:
		gzipLevel = gzip.DefaultCompression
	}
	
	newWriter, err := gzip.NewWriterLevel(&buf, gzipLevel)
	if err != nil {
		return nil, err
	}
	
	if _, err := newWriter.Write(data); err != nil {
		return nil, err
	}
	
	if err := newWriter.Close(); err != nil {
		return nil, err
	}
	
	return buf.Bytes(), nil
}

// decompressGzip decompresses gzip data
func (c *PayloadCompressor) decompressGzip(data []byte) ([]byte, error) {
	reader, err := gzip.NewReader(bytes.NewReader(data))
	if err != nil {
		return nil, err
	}
	defer reader.Close()
	
	return io.ReadAll(reader)
}

// compressLZ4 compresses using LZ4
func (c *PayloadCompressor) compressLZ4(data []byte) ([]byte, error) {
	var buf bytes.Buffer
	
	writer := c.lz4Pool.Get().(*lz4.Writer)
	defer c.lz4Pool.Put(writer)
	
	writer.Reset(&buf)
	
	if _, err := writer.Write(data); err != nil {
		return nil, err
	}
	
	if err := writer.Close(); err != nil {
		return nil, err
	}
	
	return buf.Bytes(), nil
}

// decompressLZ4 decompresses LZ4 data
func (c *PayloadCompressor) decompressLZ4(data []byte, originalSize int) ([]byte, error) {
	reader := lz4.NewReader(bytes.NewReader(data))
	
	result := make([]byte, 0, originalSize)
	buf := make([]byte, 4096)
	
	for {
		n, err := reader.Read(buf)
		if n > 0 {
			result = append(result, buf[:n]...)
		}
		if err == io.EOF {
			break
		}
		if err != nil {
			return nil, err
		}
	}
	
	return result, nil
}

// compressZstd compresses using Zstandard
func (c *PayloadCompressor) compressZstd(data []byte) ([]byte, error) {
	return c.zstdEncoder.EncodeAll(data, nil), nil
}

// decompressZstd decompresses Zstandard data
func (c *PayloadCompressor) decompressZstd(data []byte) ([]byte, error) {
	return c.zstdDecoder.DecodeAll(data, nil)
}

// calculateChecksum calculates a simple checksum
func calculateChecksum(data []byte) string {
	var sum uint32
	for _, b := range data {
		sum += uint32(b)
	}
	return fmt.Sprintf("%08x", sum)
}

// ChunkedPayload represents a payload split into chunks for unreliable networks
type ChunkedPayload struct {
	TotalChunks int               `json:"total_chunks"`
	ChunkSize   int               `json:"chunk_size"`
	PayloadID   string            `json:"payload_id"`
	Chunks      []PayloadChunk    `json:"chunks"`
}

// PayloadChunk represents a single chunk
type PayloadChunk struct {
	Index    int    `json:"index"`
	Data     string `json:"data"` // Base64 encoded
	Checksum string `json:"checksum"`
}

// SplitIntoChunks splits a compressed payload into chunks for unreliable networks
func (c *PayloadCompressor) SplitIntoChunks(payload *CompressedPayload, chunkSize int) (*ChunkedPayload, error) {
	data, err := base64.StdEncoding.DecodeString(payload.Data)
	if err != nil {
		return nil, err
	}

	totalChunks := (len(data) + chunkSize - 1) / chunkSize
	chunks := make([]PayloadChunk, totalChunks)

	for i := 0; i < totalChunks; i++ {
		start := i * chunkSize
		end := start + chunkSize
		if end > len(data) {
			end = len(data)
		}

		chunkData := data[start:end]
		chunks[i] = PayloadChunk{
			Index:    i,
			Data:     base64.StdEncoding.EncodeToString(chunkData),
			Checksum: calculateChecksum(chunkData),
		}
	}

	return &ChunkedPayload{
		TotalChunks: totalChunks,
		ChunkSize:   chunkSize,
		PayloadID:   fmt.Sprintf("CHUNK-%d", time.Now().UnixNano()),
		Chunks:      chunks,
	}, nil
}

// ReassembleChunks reassembles chunks into a compressed payload
func (c *PayloadCompressor) ReassembleChunks(chunked *ChunkedPayload, algo CompressionAlgorithm) (*CompressedPayload, error) {
	// Sort chunks by index
	chunks := make([]PayloadChunk, len(chunked.Chunks))
	copy(chunks, chunked.Chunks)

	// Verify all chunks present
	received := make(map[int]bool)
	for _, chunk := range chunks {
		received[chunk.Index] = true
	}

	for i := 0; i < chunked.TotalChunks; i++ {
		if !received[i] {
			return nil, fmt.Errorf("missing chunk %d", i)
		}
	}

	// Reassemble
	var data []byte
	for i := 0; i < chunked.TotalChunks; i++ {
		for _, chunk := range chunks {
			if chunk.Index == i {
				chunkData, err := base64.StdEncoding.DecodeString(chunk.Data)
				if err != nil {
					return nil, err
				}

				// Verify chunk checksum
				if calculateChecksum(chunkData) != chunk.Checksum {
					return nil, fmt.Errorf("checksum mismatch for chunk %d", i)
				}

				data = append(data, chunkData...)
				break
			}
		}
	}

	return &CompressedPayload{
		Algorithm:      algo,
		CompressedSize: len(data),
		Data:           base64.StdEncoding.EncodeToString(data),
		Checksum:       calculateChecksum(data),
		Timestamp:      time.Now(),
	}, nil
}

// HTTP Middleware for automatic compression

// CompressionMiddleware automatically compresses responses based on network type
func CompressionMiddleware(compressor *PayloadCompressor) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// Get network type from header
			networkType := NetworkType(r.Header.Get("X-Network-Type"))
			if networkType == "" {
				networkType = Network4G // Default
			}

			// Check if client supports compression
			acceptEncoding := r.Header.Get("Accept-Encoding")
			if !strings.Contains(acceptEncoding, "gzip") && 
			   !strings.Contains(acceptEncoding, "lz4") &&
			   !strings.Contains(acceptEncoding, "zstd") {
				next.ServeHTTP(w, r)
				return
			}

			// Wrap response writer
			crw := &compressedResponseWriter{
				ResponseWriter: w,
				compressor:     compressor,
				networkType:    networkType,
				buffer:         &bytes.Buffer{},
			}

			next.ServeHTTP(crw, r)

			// Compress and write response
			if crw.buffer.Len() > 0 {
				compressed, err := compressor.CompressForNetwork(crw.buffer.Bytes(), networkType)
				if err != nil {
					w.Write(crw.buffer.Bytes())
					return
				}

				w.Header().Set("Content-Encoding", string(compressed.Algorithm))
				w.Header().Set("X-Original-Size", fmt.Sprintf("%d", compressed.OriginalSize))
				w.Header().Set("X-Compressed-Size", fmt.Sprintf("%d", compressed.CompressedSize))

				data, _ := base64.StdEncoding.DecodeString(compressed.Data)
				w.Write(data)
			}
		})
	}
}

type compressedResponseWriter struct {
	http.ResponseWriter
	compressor  *PayloadCompressor
	networkType NetworkType
	buffer      *bytes.Buffer
}

func (crw *compressedResponseWriter) Write(data []byte) (int, error) {
	return crw.buffer.Write(data)
}

// DeltaCompression for incremental updates

// DeltaPayload represents a delta-compressed payload
type DeltaPayload struct {
	BaseVersion string `json:"base_version"`
	Delta       string `json:"delta"` // Base64 encoded
	NewVersion  string `json:"new_version"`
	Checksum    string `json:"checksum"`
}

// ComputeDelta computes the difference between two payloads
func (c *PayloadCompressor) ComputeDelta(oldData, newData []byte) (*DeltaPayload, error) {
	// Simple XOR-based delta for demonstration
	// In production, use a proper diff algorithm like bsdiff
	
	maxLen := len(newData)
	if len(oldData) > maxLen {
		maxLen = len(oldData)
	}

	delta := make([]byte, maxLen+4) // +4 for length prefix
	
	// Store new data length
	delta[0] = byte(len(newData) >> 24)
	delta[1] = byte(len(newData) >> 16)
	delta[2] = byte(len(newData) >> 8)
	delta[3] = byte(len(newData))

	for i := 0; i < maxLen; i++ {
		var oldByte, newByte byte
		if i < len(oldData) {
			oldByte = oldData[i]
		}
		if i < len(newData) {
			newByte = newData[i]
		}
		delta[i+4] = oldByte ^ newByte
	}

	// Compress the delta
	compressed, err := c.Compress(delta, AlgoLZ4, LevelBest)
	if err != nil {
		return nil, err
	}

	return &DeltaPayload{
		BaseVersion: calculateChecksum(oldData),
		Delta:       compressed.Data,
		NewVersion:  calculateChecksum(newData),
		Checksum:    compressed.Checksum,
	}, nil
}

// ApplyDelta applies a delta to reconstruct new data
func (c *PayloadCompressor) ApplyDelta(oldData []byte, delta *DeltaPayload) ([]byte, error) {
	// Verify base version
	if calculateChecksum(oldData) != delta.BaseVersion {
		return nil, fmt.Errorf("base version mismatch")
	}

	// Decompress delta
	compressed := &CompressedPayload{
		Algorithm: AlgoLZ4,
		Data:      delta.Delta,
		Checksum:  delta.Checksum,
	}

	deltaData, err := c.Decompress(compressed)
	if err != nil {
		return nil, err
	}

	// Extract new data length
	newLen := int(deltaData[0])<<24 | int(deltaData[1])<<16 | int(deltaData[2])<<8 | int(deltaData[3])
	deltaData = deltaData[4:]

	// Apply XOR delta
	newData := make([]byte, newLen)
	for i := 0; i < newLen; i++ {
		var oldByte, deltaByte byte
		if i < len(oldData) {
			oldByte = oldData[i]
		}
		if i < len(deltaData) {
			deltaByte = deltaData[i]
		}
		newData[i] = oldByte ^ deltaByte
	}

	// Verify result
	if calculateChecksum(newData) != delta.NewVersion {
		return nil, fmt.Errorf("result checksum mismatch")
	}

	return newData, nil
}

// AdaptiveCompression selects the best algorithm based on data characteristics
func (c *PayloadCompressor) AdaptiveCompression(data []byte, networkType NetworkType) (*CompressedPayload, error) {
	config := DefaultNetworkConfigs[networkType]
	
	// For very slow networks, always use LZ4 (fastest decompression)
	if networkType == Network2G || networkType == NetworkGPRS || networkType == NetworkEdge {
		return c.Compress(data, AlgoLZ4, LevelBest)
	}

	// For medium networks, try gzip
	if networkType == Network3G {
		return c.Compress(data, AlgoGzip, config.Level)
	}

	// For fast networks, use zstd for best ratio
	return c.Compress(data, AlgoZstd, config.Level)
}

// StreamingCompressor for large payloads

// StreamingCompressor handles streaming compression for large files
type StreamingCompressor struct {
	compressor *PayloadCompressor
	chunkSize  int
	algorithm  CompressionAlgorithm
}

// NewStreamingCompressor creates a streaming compressor
func NewStreamingCompressor(compressor *PayloadCompressor, networkType NetworkType) *StreamingCompressor {
	config := DefaultNetworkConfigs[networkType]
	return &StreamingCompressor{
		compressor: compressor,
		chunkSize:  config.ChunkSize,
		algorithm:  config.Algorithm,
	}
}

// CompressStream compresses data in a streaming fashion
func (sc *StreamingCompressor) CompressStream(ctx context.Context, reader io.Reader, writer io.Writer) error {
	buf := make([]byte, sc.chunkSize)
	chunkIndex := 0

	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		default:
		}

		n, err := reader.Read(buf)
		if n > 0 {
			compressed, compErr := sc.compressor.Compress(buf[:n], sc.algorithm, LevelDefault)
			if compErr != nil {
				return compErr
			}

			// Write chunk header
			header := fmt.Sprintf("CHUNK:%d:%d:", chunkIndex, compressed.CompressedSize)
			if _, err := writer.Write([]byte(header)); err != nil {
				return err
			}

			// Write compressed data
			data, _ := base64.StdEncoding.DecodeString(compressed.Data)
			if _, err := writer.Write(data); err != nil {
				return err
			}

			chunkIndex++
		}

		if err == io.EOF {
			break
		}
		if err != nil {
			return err
		}
	}

	// Write end marker
	_, err := writer.Write([]byte("CHUNK:END"))
	return err
}
