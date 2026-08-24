package main

import (
	"bytes"
	"context"
	"fmt"
	"image"
	"image/jpeg"
	"image/png"
	"io"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/disintegration/imaging"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

// Prometheus metrics
var (
	imageProcessingTime = promauto.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "adaptive_image_processing_time_seconds",
			Help:    "Time taken to process images",
			Buckets: prometheus.DefBuckets,
		},
		[]string{"operation", "network_type"},
	)

	imageCompressionRatio = promauto.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "adaptive_image_compression_ratio",
			Help:    "Image compression ratio achieved",
			Buckets: []float64{0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0},
		},
		[]string{"network_type"},
	)

	imagesProcessed = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "adaptive_images_processed_total",
			Help: "Total images processed",
		},
		[]string{"network_type", "format"},
	)
)

// ImageQuality represents quality levels
type ImageQuality int

const (
	QualityUltraLow ImageQuality = 10 // For 2G/GPRS
	QualityLow      ImageQuality = 30 // For EDGE
	QualityMedium   ImageQuality = 50 // For 3G
	QualityHigh     ImageQuality = 75 // For 4G
	QualityOriginal ImageQuality = 95 // For 5G/WiFi
)

// ImageFormat represents output formats
type ImageFormat string

const (
	FormatJPEG ImageFormat = "jpeg"
	FormatPNG  ImageFormat = "png"
	FormatWebP ImageFormat = "webp"
)

// NetworkImageConfig holds network-specific image settings
type NetworkImageConfig struct {
	Quality       ImageQuality
	MaxWidth      int
	MaxHeight     int
	Format        ImageFormat
	Grayscale     bool // Convert to grayscale for extreme low bandwidth
	Progressive   bool // Use progressive JPEG
	MaxFileSize   int  // Max file size in bytes
	EnableCaching bool
}

// DefaultImageConfigs provides optimal settings for each network type
var DefaultImageConfigs = map[NetworkType]NetworkImageConfig{
	Network2G: {
		Quality:       QualityUltraLow,
		MaxWidth:      320,
		MaxHeight:     240,
		Format:        FormatJPEG,
		Grayscale:     true,  // Grayscale for 2G to reduce size
		Progressive:   false, // Non-progressive for faster initial display
		MaxFileSize:   10240, // 10KB max
		EnableCaching: true,
	},
	NetworkGPRS: {
		Quality:       QualityUltraLow,
		MaxWidth:      240,
		MaxHeight:     180,
		Format:        FormatJPEG,
		Grayscale:     true,
		Progressive:   false,
		MaxFileSize:   8192, // 8KB max
		EnableCaching: true,
	},
	NetworkEdge: {
		Quality:       QualityLow,
		MaxWidth:      480,
		MaxHeight:     360,
		Format:        FormatJPEG,
		Grayscale:     false,
		Progressive:   true,
		MaxFileSize:   20480, // 20KB max
		EnableCaching: true,
	},
	Network3G: {
		Quality:       QualityMedium,
		MaxWidth:      800,
		MaxHeight:     600,
		Format:        FormatJPEG,
		Grayscale:     false,
		Progressive:   true,
		MaxFileSize:   102400, // 100KB max
		EnableCaching: true,
	},
	Network4G: {
		Quality:       QualityHigh,
		MaxWidth:      1920,
		MaxHeight:     1080,
		Format:        FormatJPEG,
		Grayscale:     false,
		Progressive:   true,
		MaxFileSize:   512000, // 500KB max
		EnableCaching: true,
	},
	Network5G: {
		Quality:       QualityOriginal,
		MaxWidth:      4096,
		MaxHeight:     2160,
		Format:        FormatJPEG,
		Grayscale:     false,
		Progressive:   true,
		MaxFileSize:   2097152, // 2MB max
		EnableCaching: false,
	},
	NetworkWifi: {
		Quality:       QualityOriginal,
		MaxWidth:      4096,
		MaxHeight:     2160,
		Format:        FormatJPEG,
		Grayscale:     false,
		Progressive:   true,
		MaxFileSize:   5242880, // 5MB max
		EnableCaching: false,
	},
}

// AdaptiveImageProcessor handles network-aware image processing
type AdaptiveImageProcessor struct {
	cache      *ImageCache
	bufferPool sync.Pool
}

// ProcessedImage represents a processed image
type ProcessedImage struct {
	Data          []byte       `json:"data"`
	Format        ImageFormat  `json:"format"`
	Width         int          `json:"width"`
	Height        int          `json:"height"`
	OriginalSize  int          `json:"original_size"`
	ProcessedSize int          `json:"processed_size"`
	Quality       ImageQuality `json:"quality"`
	Grayscale     bool         `json:"grayscale"`
	CacheKey      string       `json:"cache_key,omitempty"`
}

// ImageCache provides caching for processed images
type ImageCache struct {
	cache   map[string]*ProcessedImage
	mutex   sync.RWMutex
	maxSize int
	ttl     time.Duration
}

// NewAdaptiveImageProcessor creates a new adaptive image processor
func NewAdaptiveImageProcessor() *AdaptiveImageProcessor {
	return &AdaptiveImageProcessor{
		cache: &ImageCache{
			cache:   make(map[string]*ProcessedImage),
			maxSize: 1000,
			ttl:     30 * time.Minute,
		},
		bufferPool: sync.Pool{
			New: func() interface{} {
				return new(bytes.Buffer)
			},
		},
	}
}

// ProcessImage processes an image for the given network type
func (p *AdaptiveImageProcessor) ProcessImage(ctx context.Context, imageData []byte, networkType NetworkType) (*ProcessedImage, error) {
	start := time.Now()
	defer func() {
		imageProcessingTime.WithLabelValues("process", string(networkType)).Observe(time.Since(start).Seconds())
	}()

	config, ok := DefaultImageConfigs[networkType]
	if !ok {
		config = DefaultImageConfigs[Network3G]
	}

	// Check cache
	cacheKey := p.generateCacheKey(imageData, networkType)
	if config.EnableCaching {
		if cached := p.cache.Get(cacheKey); cached != nil {
			return cached, nil
		}
	}

	// Decode image
	img, format, err := image.Decode(bytes.NewReader(imageData))
	if err != nil {
		return nil, fmt.Errorf("failed to decode image: %w", err)
	}

	originalSize := len(imageData)

	// Resize if needed
	bounds := img.Bounds()
	width := bounds.Dx()
	height := bounds.Dy()

	if width > config.MaxWidth || height > config.MaxHeight {
		img = imaging.Fit(img, config.MaxWidth, config.MaxHeight, imaging.Lanczos)
		bounds = img.Bounds()
		width = bounds.Dx()
		height = bounds.Dy()
	}

	// Convert to grayscale for ultra-low bandwidth
	if config.Grayscale {
		img = imaging.Grayscale(img)
	}

	// Encode with appropriate quality
	buf := p.bufferPool.Get().(*bytes.Buffer)
	buf.Reset()
	defer p.bufferPool.Put(buf)

	switch config.Format {
	case FormatJPEG:
		err = jpeg.Encode(buf, img, &jpeg.Options{Quality: int(config.Quality)})
	case FormatPNG:
		err = png.Encode(buf, img)
	default:
		err = jpeg.Encode(buf, img, &jpeg.Options{Quality: int(config.Quality)})
	}

	if err != nil {
		return nil, fmt.Errorf("failed to encode image: %w", err)
	}

	// Further reduce quality if still too large
	processedData := buf.Bytes()
	if len(processedData) > config.MaxFileSize {
		processedData, err = p.reduceToSize(img, config.MaxFileSize, config.Format)
		if err != nil {
			return nil, err
		}
	}

	result := &ProcessedImage{
		Data:          processedData,
		Format:        config.Format,
		Width:         width,
		Height:        height,
		OriginalSize:  originalSize,
		ProcessedSize: len(processedData),
		Quality:       config.Quality,
		Grayscale:     config.Grayscale,
		CacheKey:      cacheKey,
	}

	// Update metrics
	ratio := float64(result.ProcessedSize) / float64(result.OriginalSize)
	imageCompressionRatio.WithLabelValues(string(networkType)).Observe(ratio)
	imagesProcessed.WithLabelValues(string(networkType), format).Inc()

	// Cache result
	if config.EnableCaching {
		p.cache.Set(cacheKey, result)
	}

	return result, nil
}

// reduceToSize reduces image size to fit within maxSize
func (p *AdaptiveImageProcessor) reduceToSize(img image.Image, maxSize int, format ImageFormat) ([]byte, error) {
	quality := 90
	var buf bytes.Buffer

	for quality > 5 {
		buf.Reset()

		switch format {
		case FormatJPEG:
			err := jpeg.Encode(&buf, img, &jpeg.Options{Quality: quality})
			if err != nil {
				return nil, err
			}
		case FormatPNG:
			err := png.Encode(&buf, img)
			if err != nil {
				return nil, err
			}
		}

		if buf.Len() <= maxSize {
			return buf.Bytes(), nil
		}

		quality -= 10
	}

	// If still too large, resize
	bounds := img.Bounds()
	newWidth := bounds.Dx() * 3 / 4
	newHeight := bounds.Dy() * 3 / 4
	img = imaging.Resize(img, newWidth, newHeight, imaging.Lanczos)

	buf.Reset()
	jpeg.Encode(&buf, img, &jpeg.Options{Quality: 20})
	return buf.Bytes(), nil
}

// generateCacheKey generates a cache key for an image
func (p *AdaptiveImageProcessor) generateCacheKey(data []byte, networkType NetworkType) string {
	// Simple hash based on first/last bytes and length
	if len(data) < 16 {
		return fmt.Sprintf("%s-%x", networkType, data)
	}
	return fmt.Sprintf("%s-%d-%x-%x", networkType, len(data), data[:8], data[len(data)-8:])
}

// ImageCache methods

func (c *ImageCache) Get(key string) *ProcessedImage {
	c.mutex.RLock()
	defer c.mutex.RUnlock()
	return c.cache[key]
}

func (c *ImageCache) Set(key string, img *ProcessedImage) {
	c.mutex.Lock()
	defer c.mutex.Unlock()

	// Evict if cache is full
	if len(c.cache) >= c.maxSize {
		// Remove oldest entry (simple eviction)
		for k := range c.cache {
			delete(c.cache, k)
			break
		}
	}

	c.cache[key] = img
}

// Placeholder image generation for failed loads

// PlaceholderConfig holds placeholder settings
type PlaceholderConfig struct {
	Width      int
	Height     int
	Text       string
	Background string
	TextColor  string
}

// GeneratePlaceholder generates a placeholder image for failed loads
func (p *AdaptiveImageProcessor) GeneratePlaceholder(config PlaceholderConfig) ([]byte, error) {
	// Create a simple colored rectangle as placeholder
	img := imaging.New(config.Width, config.Height, image.White)

	var buf bytes.Buffer
	err := jpeg.Encode(&buf, img, &jpeg.Options{Quality: 50})
	if err != nil {
		return nil, err
	}

	return buf.Bytes(), nil
}

// Thumbnail generation

// ThumbnailConfig holds thumbnail settings
type ThumbnailConfig struct {
	Width   int
	Height  int
	Quality int
	Crop    bool
}

// DefaultThumbnailConfigs for different network types
var DefaultThumbnailConfigs = map[NetworkType]ThumbnailConfig{
	Network2G:   {Width: 48, Height: 48, Quality: 30, Crop: true},
	NetworkGPRS: {Width: 32, Height: 32, Quality: 20, Crop: true},
	NetworkEdge: {Width: 64, Height: 64, Quality: 40, Crop: true},
	Network3G:   {Width: 96, Height: 96, Quality: 60, Crop: true},
	Network4G:   {Width: 150, Height: 150, Quality: 80, Crop: true},
	Network5G:   {Width: 200, Height: 200, Quality: 90, Crop: true},
	NetworkWifi: {Width: 200, Height: 200, Quality: 90, Crop: true},
}

// GenerateThumbnail generates a thumbnail for the given network type
func (p *AdaptiveImageProcessor) GenerateThumbnail(ctx context.Context, imageData []byte, networkType NetworkType) (*ProcessedImage, error) {
	start := time.Now()
	defer func() {
		imageProcessingTime.WithLabelValues("thumbnail", string(networkType)).Observe(time.Since(start).Seconds())
	}()

	config, ok := DefaultThumbnailConfigs[networkType]
	if !ok {
		config = DefaultThumbnailConfigs[Network3G]
	}

	img, _, err := image.Decode(bytes.NewReader(imageData))
	if err != nil {
		return nil, fmt.Errorf("failed to decode image: %w", err)
	}

	var thumbnail image.Image
	if config.Crop {
		thumbnail = imaging.Fill(img, config.Width, config.Height, imaging.Center, imaging.Lanczos)
	} else {
		thumbnail = imaging.Fit(img, config.Width, config.Height, imaging.Lanczos)
	}

	var buf bytes.Buffer
	err = jpeg.Encode(&buf, thumbnail, &jpeg.Options{Quality: config.Quality})
	if err != nil {
		return nil, fmt.Errorf("failed to encode thumbnail: %w", err)
	}

	return &ProcessedImage{
		Data:          buf.Bytes(),
		Format:        FormatJPEG,
		Width:         config.Width,
		Height:        config.Height,
		OriginalSize:  len(imageData),
		ProcessedSize: buf.Len(),
		Quality:       ImageQuality(config.Quality),
	}, nil
}

// HTTP Middleware for adaptive images

// AdaptiveImageMiddleware automatically processes images based on network type
func AdaptiveImageMiddleware(processor *AdaptiveImageProcessor) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// Check if this is an image request
			if !isImageRequest(r) {
				next.ServeHTTP(w, r)
				return
			}

			// Get network type from header
			networkType := NetworkType(r.Header.Get("X-Network-Type"))
			if networkType == "" {
				// Try to detect from User-Agent or other headers
				networkType = detectNetworkType(r)
			}

			// Wrap response writer
			airw := &adaptiveImageResponseWriter{
				ResponseWriter: w,
				processor:      processor,
				networkType:    networkType,
				buffer:         &bytes.Buffer{},
			}

			next.ServeHTTP(airw, r)

			// Process image if content type is image
			contentType := airw.Header().Get("Content-Type")
			if strings.HasPrefix(contentType, "image/") && airw.buffer.Len() > 0 {
				processed, err := processor.ProcessImage(r.Context(), airw.buffer.Bytes(), networkType)
				if err != nil {
					// Fall back to original
					w.Write(airw.buffer.Bytes())
					return
				}

				w.Header().Set("Content-Type", "image/"+string(processed.Format))
				w.Header().Set("X-Original-Size", strconv.Itoa(processed.OriginalSize))
				w.Header().Set("X-Processed-Size", strconv.Itoa(processed.ProcessedSize))
				w.Header().Set("X-Image-Quality", strconv.Itoa(int(processed.Quality)))
				w.Header().Set("X-Network-Optimized", string(networkType))

				w.Write(processed.Data)
			} else {
				w.Write(airw.buffer.Bytes())
			}
		})
	}
}

type adaptiveImageResponseWriter struct {
	http.ResponseWriter
	processor   *AdaptiveImageProcessor
	networkType NetworkType
	buffer      *bytes.Buffer
}

func (airw *adaptiveImageResponseWriter) Write(data []byte) (int, error) {
	return airw.buffer.Write(data)
}

// Helper functions

func isImageRequest(r *http.Request) bool {
	accept := r.Header.Get("Accept")
	path := strings.ToLower(r.URL.Path)

	return strings.Contains(accept, "image/") ||
		strings.HasSuffix(path, ".jpg") ||
		strings.HasSuffix(path, ".jpeg") ||
		strings.HasSuffix(path, ".png") ||
		strings.HasSuffix(path, ".gif") ||
		strings.HasSuffix(path, ".webp")
}

func detectNetworkType(r *http.Request) NetworkType {
	// Check various headers that might indicate network type

	// Check Save-Data header (indicates user wants reduced data)
	if r.Header.Get("Save-Data") == "on" {
		return Network2G
	}

	// Check ECT (Effective Connection Type) header
	ect := r.Header.Get("ECT")
	switch ect {
	case "slow-2g":
		return NetworkGPRS
	case "2g":
		return Network2G
	case "3g":
		return Network3G
	case "4g":
		return Network4G
	}

	// Check Downlink header (bandwidth in Mbps)
	downlink := r.Header.Get("Downlink")
	if downlink != "" {
		dl, err := strconv.ParseFloat(downlink, 64)
		if err == nil {
			if dl < 0.1 {
				return NetworkGPRS
			} else if dl < 0.5 {
				return Network2G
			} else if dl < 2 {
				return Network3G
			} else if dl < 10 {
				return Network4G
			}
			return Network5G
		}
	}

	// Check RTT (Round Trip Time) header
	rtt := r.Header.Get("RTT")
	if rtt != "" {
		rttMs, err := strconv.Atoi(rtt)
		if err == nil {
			if rttMs > 2000 {
				return NetworkGPRS
			} else if rttMs > 1000 {
				return Network2G
			} else if rttMs > 500 {
				return Network3G
			} else if rttMs > 100 {
				return Network4G
			}
			return Network5G
		}
	}

	// Default to 3G
	return Network3G
}

// Progressive image loading support

// ProgressiveImageLoader handles progressive image loading
type ProgressiveImageLoader struct {
	processor *AdaptiveImageProcessor
}

// NewProgressiveImageLoader creates a new progressive image loader
func NewProgressiveImageLoader(processor *AdaptiveImageProcessor) *ProgressiveImageLoader {
	return &ProgressiveImageLoader{processor: processor}
}

// LoadProgressively loads an image progressively (low quality first, then high quality)
func (l *ProgressiveImageLoader) LoadProgressively(ctx context.Context, imageData []byte, networkType NetworkType) (<-chan *ProcessedImage, error) {
	ch := make(chan *ProcessedImage, 3)

	go func() {
		defer close(ch)

		// First: Ultra-low quality preview (immediate)
		preview, err := l.processor.ProcessImage(ctx, imageData, Network2G)
		if err == nil {
			select {
			case ch <- preview:
			case <-ctx.Done():
				return
			}
		}

		// Second: Medium quality (if network allows)
		if networkType != Network2G && networkType != NetworkGPRS {
			medium, err := l.processor.ProcessImage(ctx, imageData, Network3G)
			if err == nil {
				select {
				case ch <- medium:
				case <-ctx.Done():
					return
				}
			}
		}

		// Third: Full quality for the network
		if networkType != Network2G && networkType != NetworkGPRS && networkType != Network3G {
			full, err := l.processor.ProcessImage(ctx, imageData, networkType)
			if err == nil {
				select {
				case ch <- full:
				case <-ctx.Done():
					return
				}
			}
		}
	}()

	return ch, nil
}

// LazyImageLoader for deferred image loading

// LazyImageConfig holds lazy loading settings
type LazyImageConfig struct {
	PlaceholderWidth  int
	PlaceholderHeight int
	LoadThreshold     int // Pixels from viewport to start loading
	BatchSize         int // Number of images to load at once
}

// DefaultLazyConfigs for different network types
var DefaultLazyConfigs = map[NetworkType]LazyImageConfig{
	Network2G:   {PlaceholderWidth: 48, PlaceholderHeight: 48, LoadThreshold: 100, BatchSize: 1},
	NetworkGPRS: {PlaceholderWidth: 32, PlaceholderHeight: 32, LoadThreshold: 50, BatchSize: 1},
	NetworkEdge: {PlaceholderWidth: 64, PlaceholderHeight: 64, LoadThreshold: 150, BatchSize: 2},
	Network3G:   {PlaceholderWidth: 96, PlaceholderHeight: 96, LoadThreshold: 300, BatchSize: 3},
	Network4G:   {PlaceholderWidth: 150, PlaceholderHeight: 150, LoadThreshold: 500, BatchSize: 5},
	Network5G:   {PlaceholderWidth: 200, PlaceholderHeight: 200, LoadThreshold: 1000, BatchSize: 10},
	NetworkWifi: {PlaceholderWidth: 200, PlaceholderHeight: 200, LoadThreshold: 1000, BatchSize: 10},
}

// ImageBatchProcessor processes multiple images efficiently
type ImageBatchProcessor struct {
	processor   *AdaptiveImageProcessor
	workerCount int
}

// NewImageBatchProcessor creates a new batch processor
func NewImageBatchProcessor(processor *AdaptiveImageProcessor, workerCount int) *ImageBatchProcessor {
	return &ImageBatchProcessor{
		processor:   processor,
		workerCount: workerCount,
	}
}

// ProcessBatch processes multiple images concurrently
func (b *ImageBatchProcessor) ProcessBatch(ctx context.Context, images [][]byte, networkType NetworkType) ([]*ProcessedImage, error) {
	results := make([]*ProcessedImage, len(images))
	errors := make([]error, len(images))

	var wg sync.WaitGroup
	semaphore := make(chan struct{}, b.workerCount)

	for i, imgData := range images {
		wg.Add(1)
		go func(index int, data []byte) {
			defer wg.Done()

			semaphore <- struct{}{}
			defer func() { <-semaphore }()

			processed, err := b.processor.ProcessImage(ctx, data, networkType)
			if err != nil {
				errors[index] = err
				return
			}
			results[index] = processed
		}(i, imgData)
	}

	wg.Wait()

	// Check for errors
	for _, err := range errors {
		if err != nil {
			return results, err
		}
	}

	return results, nil
}

// Document/Receipt image optimization for banking

// DocumentImageConfig holds settings for document images (receipts, statements, etc.)
type DocumentImageConfig struct {
	MaxWidth    int
	MaxHeight   int
	Quality     int
	Grayscale   bool
	EnhanceText bool
	DPI         int
}

// DefaultDocumentConfigs for different network types
var DefaultDocumentConfigs = map[NetworkType]DocumentImageConfig{
	Network2G:   {MaxWidth: 480, MaxHeight: 640, Quality: 40, Grayscale: true, EnhanceText: true, DPI: 72},
	NetworkGPRS: {MaxWidth: 320, MaxHeight: 480, Quality: 30, Grayscale: true, EnhanceText: true, DPI: 72},
	NetworkEdge: {MaxWidth: 640, MaxHeight: 800, Quality: 50, Grayscale: true, EnhanceText: true, DPI: 96},
	Network3G:   {MaxWidth: 800, MaxHeight: 1024, Quality: 60, Grayscale: false, EnhanceText: true, DPI: 150},
	Network4G:   {MaxWidth: 1200, MaxHeight: 1600, Quality: 80, Grayscale: false, EnhanceText: false, DPI: 200},
	Network5G:   {MaxWidth: 2400, MaxHeight: 3200, Quality: 90, Grayscale: false, EnhanceText: false, DPI: 300},
	NetworkWifi: {MaxWidth: 2400, MaxHeight: 3200, Quality: 90, Grayscale: false, EnhanceText: false, DPI: 300},
}

// ProcessDocumentImage processes document images (receipts, statements) for banking
func (p *AdaptiveImageProcessor) ProcessDocumentImage(ctx context.Context, imageData []byte, networkType NetworkType) (*ProcessedImage, error) {
	start := time.Now()
	defer func() {
		imageProcessingTime.WithLabelValues("document", string(networkType)).Observe(time.Since(start).Seconds())
	}()

	config, ok := DefaultDocumentConfigs[networkType]
	if !ok {
		config = DefaultDocumentConfigs[Network3G]
	}

	img, _, err := image.Decode(bytes.NewReader(imageData))
	if err != nil {
		return nil, fmt.Errorf("failed to decode document image: %w", err)
	}

	// Resize
	img = imaging.Fit(img, config.MaxWidth, config.MaxHeight, imaging.Lanczos)

	// Convert to grayscale if needed
	if config.Grayscale {
		img = imaging.Grayscale(img)
	}

	// Enhance contrast for text readability
	if config.EnhanceText {
		img = imaging.AdjustContrast(img, 20)
		img = imaging.Sharpen(img, 1.0)
	}

	var buf bytes.Buffer
	err = jpeg.Encode(&buf, img, &jpeg.Options{Quality: config.Quality})
	if err != nil {
		return nil, fmt.Errorf("failed to encode document image: %w", err)
	}

	bounds := img.Bounds()
	return &ProcessedImage{
		Data:          buf.Bytes(),
		Format:        FormatJPEG,
		Width:         bounds.Dx(),
		Height:        bounds.Dy(),
		OriginalSize:  len(imageData),
		ProcessedSize: buf.Len(),
		Quality:       ImageQuality(config.Quality),
		Grayscale:     config.Grayscale,
	}, nil
}

// Avatar/Profile image optimization

// ProcessAvatarImage processes avatar/profile images
func (p *AdaptiveImageProcessor) ProcessAvatarImage(ctx context.Context, imageData []byte, networkType NetworkType) (*ProcessedImage, error) {
	// Avatars are always small and square
	sizes := map[NetworkType]int{
		Network2G:   32,
		NetworkGPRS: 24,
		NetworkEdge: 48,
		Network3G:   64,
		Network4G:   128,
		Network5G:   200,
		NetworkWifi: 200,
	}

	size, ok := sizes[networkType]
	if !ok {
		size = 64
	}

	img, _, err := image.Decode(bytes.NewReader(imageData))
	if err != nil {
		return nil, fmt.Errorf("failed to decode avatar: %w", err)
	}

	// Crop to square and resize
	avatar := imaging.Fill(img, size, size, imaging.Center, imaging.Lanczos)

	quality := 60
	if networkType == Network2G || networkType == NetworkGPRS {
		quality = 40
	}

	var buf bytes.Buffer
	err = jpeg.Encode(&buf, avatar, &jpeg.Options{Quality: quality})
	if err != nil {
		return nil, fmt.Errorf("failed to encode avatar: %w", err)
	}

	return &ProcessedImage{
		Data:          buf.Bytes(),
		Format:        FormatJPEG,
		Width:         size,
		Height:        size,
		OriginalSize:  len(imageData),
		ProcessedSize: buf.Len(),
		Quality:       ImageQuality(quality),
	}, nil
}

// StreamingImageReader for reading large images in chunks
type StreamingImageReader struct {
	reader      io.Reader
	chunkSize   int
	networkType NetworkType
}

// NewStreamingImageReader creates a streaming image reader
func NewStreamingImageReader(reader io.Reader, networkType NetworkType) *StreamingImageReader {
	chunkSizes := map[NetworkType]int{
		Network2G:   1024,
		NetworkGPRS: 512,
		NetworkEdge: 2048,
		Network3G:   4096,
		Network4G:   16384,
		Network5G:   65536,
		NetworkWifi: 65536,
	}

	chunkSize, ok := chunkSizes[networkType]
	if !ok {
		chunkSize = 4096
	}

	return &StreamingImageReader{
		reader:      reader,
		chunkSize:   chunkSize,
		networkType: networkType,
	}
}

// ReadChunk reads a chunk of image data
func (s *StreamingImageReader) ReadChunk() ([]byte, error) {
	buf := make([]byte, s.chunkSize)
	n, err := s.reader.Read(buf)
	if err != nil && err != io.EOF {
		return nil, err
	}
	return buf[:n], err
}
