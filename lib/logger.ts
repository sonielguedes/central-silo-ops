type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_WEIGHT: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

function isTruthy(value: string | undefined): boolean {
  return value === '1' || value === 'true' || value === 'yes' || value === 'on';
}

function configuredLevel(): LogLevel {
  const explicit = process.env.SILO_LOG_LEVEL?.trim().toLowerCase();
  if (explicit === 'debug' || explicit === 'info' || explicit === 'warn' || explicit === 'error') return explicit;
  if (process.env.NODE_ENV === 'production') {
    return isTruthy(process.env.SILO_DEBUG_LOGS) ? 'debug' : 'warn';
  }
  return 'info';
}

function shouldLog(level: LogLevel): boolean {
  return LEVEL_WEIGHT[level] >= LEVEL_WEIGHT[configuredLevel()];
}

function emit(method: 'log' | 'info' | 'warn' | 'error', scope: string, args: unknown[]): void {
  console[method](`[${scope}]`, ...args);
}

export function createLogger(scope: string) {
  return {
    debug: (...args: unknown[]) => {
      if (shouldLog('debug')) emit('log', scope, args);
    },
    info: (...args: unknown[]) => {
      if (shouldLog('info')) emit('info', scope, args);
    },
    warn: (...args: unknown[]) => {
      emit('warn', scope, args);
    },
    error: (...args: unknown[]) => {
      emit('error', scope, args);
    },
    security: (...args: unknown[]) => {
      emit('warn', scope, args);
    },
    audit: (...args: unknown[]) => {
      emit('log', scope, args);
    },
  };
}

export const logger = createLogger('app');
