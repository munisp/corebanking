/** Respond 503/502 for a failed publish — never { published: true }. */
function respondPublishFailure(res: Response, eventType: string, err: unknown): void {
  if (err instanceof KafkaUnavailableError) {
    res.status(503).json({ published: false, event: eventType, error: "event_bus_unavailable", message: (err as Error).message });
    return;
  }
  const message = err instanceof Error ? err.message : String(err);
  logger.error(`[EventPublisher] Publish ${eventType} failed: ${message}`);
  res.status(502).json({ published: false, event: eventType, error: "publish_failed", message });
}