package otelkit

import (
	"context"
	"strings"

	"github.com/segmentio/kafka-go"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
	"go.opentelemetry.io/otel/propagation"
	"go.opentelemetry.io/otel/trace"
)

// Kafka interceptors for segmentio/kafka-go (SPEC §2.5). They wrap
// *kafka.Writer / *kafka.Reader, adding producer/consumer spans and W3C
// tracecontext+baggage header propagation on messages (SPEC §2.4).

type kafkaHeadersCarrier struct {
	headers *[]kafka.Header
}

func (c kafkaHeadersCarrier) Get(key string) string {
	for _, h := range *c.headers {
		if strings.EqualFold(h.Key, key) {
			return string(h.Value)
		}
	}
	return ""
}

func (c kafkaHeadersCarrier) Set(key, value string) {
	for i, h := range *c.headers {
		if strings.EqualFold(h.Key, key) {
			(*c.headers)[i].Value = []byte(value)
			return
		}
	}
	*c.headers = append(*c.headers, kafka.Header{Key: key, Value: []byte(value)})
}

func (c kafkaHeadersCarrier) Keys() []string {
	keys := make([]string, 0, len(*c.headers))
	for _, h := range *c.headers {
		keys = append(keys, h.Key)
	}
	return keys
}

var _ propagation.TextMapCarrier = kafkaHeadersCarrier{}

func kafkaSpanAttrs(topic, operation string) []attribute.KeyValue {
	attrs := []attribute.KeyValue{
		attribute.String("messaging.system", "kafka"),
		attribute.String("messaging.operation.name", operation),
	}
	if topic != "" {
		attrs = append(attrs, attribute.String("messaging.destination.name", topic))
	}
	return attrs
}

func kafkaSpanName(topic, operation string) string {
	if topic == "" {
		return "kafka " + operation
	}
	return topic + " " + operation
}

// ProducerInterceptor wraps a *kafka.Writer with tracing. Use it exactly like
// the writer: WriteMessages creates a producer span and injects the trace
// context into every message's headers.
type ProducerInterceptor struct {
	writer *kafka.Writer
	tracer trace.Tracer
}

// KafkaProducerInterceptor wraps w with tracing and header injection.
// When OTEL_SDK_DISABLED is truthy the wrapper is a transparent pass-through.
func KafkaProducerInterceptor(w *kafka.Writer) *ProducerInterceptor {
	return &ProducerInterceptor{writer: w, tracer: otel.Tracer(tracerName + "/kafka")}
}

// WriteMessages implements the *kafka.Writer tracing path.
func (p *ProducerInterceptor) WriteMessages(ctx context.Context, msgs ...kafka.Message) error {
	if SDKDisabled() {
		return p.writer.WriteMessages(ctx, msgs...)
	}
	topic := p.writer.Topic
	ctx, span := p.tracer.Start(ctx, kafkaSpanName(topic, "publish"),
		trace.WithSpanKind(trace.SpanKindProducer),
		trace.WithAttributes(kafkaSpanAttrs(topic, "publish")...),
	)
	defer span.End()
	for i := range msgs {
		otel.GetTextMapPropagator().Inject(ctx, kafkaHeadersCarrier{headers: &msgs[i].Headers})
	}
	err := p.writer.WriteMessages(ctx, msgs...)
	if err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, err.Error())
	}
	return err
}

// Close closes the underlying writer.
func (p *ProducerInterceptor) Close() error { return p.writer.Close() }

// Unwrap returns the underlying *kafka.Writer for APIs that need it.
func (p *ProducerInterceptor) Unwrap() *kafka.Writer { return p.writer }

// ConsumerInterceptor wraps a *kafka.Reader with tracing. FetchMessage
// extracts the trace context from message headers and records a consumer
// span; use MessageContext to obtain the extracted context for downstream
// processing spans.
type ConsumerInterceptor struct {
	reader *kafka.Reader
	tracer trace.Tracer
}

// KafkaConsumerInterceptor wraps r with tracing and header extraction.
// When OTEL_SDK_DISABLED is truthy the wrapper is a transparent pass-through.
func KafkaConsumerInterceptor(r *kafka.Reader) *ConsumerInterceptor {
	return &ConsumerInterceptor{reader: r, tracer: otel.Tracer(tracerName + "/kafka")}
}

// MessageContext returns ctx enriched with the remote span context carried in
// the message headers (SPEC §2.4). Start processing spans from the result.
func MessageContext(ctx context.Context, msg kafka.Message) context.Context {
	if SDKDisabled() {
		return ctx
	}
	return otel.GetTextMapPropagator().Extract(ctx, kafkaHeadersCarrier{headers: &msg.Headers})
}

// FetchMessage fetches one message and records a consumer "receive" span.
func (c *ConsumerInterceptor) FetchMessage(ctx context.Context) (kafka.Message, error) {
	msg, err := c.reader.FetchMessage(ctx)
	if err != nil || SDKDisabled() {
		return msg, err
	}
	pctx := MessageContext(ctx, msg)
	_, span := c.tracer.Start(pctx, kafkaSpanName(msg.Topic, "receive"),
		trace.WithSpanKind(trace.SpanKindConsumer),
		trace.WithAttributes(kafkaSpanAttrs(msg.Topic, "receive")...),
		trace.WithAttributes(
			attribute.Int("messaging.kafka.partition", msg.Partition),
			attribute.Int64("messaging.kafka.offset", msg.Offset),
		),
	)
	span.End()
	return msg, nil
}

// CommitMessages commits offsets on the underlying reader.
func (c *ConsumerInterceptor) CommitMessages(ctx context.Context, msgs ...kafka.Message) error {
	return c.reader.CommitMessages(ctx, msgs...)
}

// ReadMessage fetches and commits one message (mirrors *kafka.Reader).
func (c *ConsumerInterceptor) ReadMessage(ctx context.Context) (kafka.Message, error) {
	msg, err := c.FetchMessage(ctx)
	if err != nil {
		return msg, err
	}
	if err := c.reader.CommitMessages(ctx, msg); err != nil {
		return msg, err
	}
	return msg, nil
}

// Close closes the underlying reader.
func (c *ConsumerInterceptor) Close() error { return c.reader.Close() }

// Unwrap returns the underlying *kafka.Reader for APIs that need it.
func (c *ConsumerInterceptor) Unwrap() *kafka.Reader { return c.reader }
