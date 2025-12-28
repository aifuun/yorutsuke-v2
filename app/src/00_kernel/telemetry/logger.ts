// Semantic JSON Logger
// Pillar R: Observability - structured logs for debugging

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  context?: Record<string, unknown>;
}

function createLogEntry(level: LogLevel, message: string, context?: Record<string, unknown>): LogEntry {
  return {
    level,
    message,
    timestamp: new Date().toISOString(),
    context,
  };
}

export const logger = {
  debug: (message: string, context?: Record<string, unknown>) => {
    if (import.meta.env.DEV) {
      console.debug(JSON.stringify(createLogEntry('debug', message, context)));
    }
  },

  info: (message: string, context?: Record<string, unknown>) => {
    console.info(JSON.stringify(createLogEntry('info', message, context)));
  },

  warn: (message: string, context?: Record<string, unknown>) => {
    console.warn(JSON.stringify(createLogEntry('warn', message, context)));
  },

  error: (message: string, context?: Record<string, unknown>) => {
    console.error(JSON.stringify(createLogEntry('error', message, context)));
  },
};
