type LogLevel = "debug" | "info" | "warn" | "error";

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  requestId?: string;
  [key: string]: unknown;
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const currentLevel: LogLevel =
  (process.env.LOG_LEVEL as LogLevel) ?? (process.env.NODE_ENV === "production" ? "info" : "debug");

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= LOG_LEVELS[currentLevel];
}

function formatEntry(entry: LogEntry): string {
  if (process.env.NODE_ENV === "production") {
    return JSON.stringify(entry);
  }
  const { level, message, timestamp, ...rest } = entry;
  const extra = Object.keys(rest).length > 0 ? ` ${JSON.stringify(rest)}` : "";
  return `[${timestamp}] ${level.toUpperCase()} ${message}${extra}`;
}

function createEntry(level: LogLevel, message: string, meta?: Record<string, unknown>): LogEntry {
  return {
    level,
    message,
    timestamp: new Date().toISOString(),
    ...meta,
  };
}

export const logger = {
  debug(message: string, meta?: Record<string, unknown>) {
    if (!shouldLog("debug")) return;
    process.stdout.write(formatEntry(createEntry("debug", message, meta)) + "\n");
  },
  info(message: string, meta?: Record<string, unknown>) {
    if (!shouldLog("info")) return;
    process.stdout.write(formatEntry(createEntry("info", message, meta)) + "\n");
  },
  warn(message: string, meta?: Record<string, unknown>) {
    if (!shouldLog("warn")) return;
    process.stderr.write(formatEntry(createEntry("warn", message, meta)) + "\n");
  },
  error(message: string, meta?: Record<string, unknown>) {
    if (!shouldLog("error")) return;
    process.stderr.write(formatEntry(createEntry("error", message, meta)) + "\n");
  },
};
