import type { ILogger } from '../types/logger';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVELS: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 };

export function createConsoleLogger(minLevel: LogLevel = 'info'): ILogger {
  const min = LEVELS[minLevel];
  return {
    debug: (msg) => {
      if (LEVELS.debug >= min) console.debug(`[IQOption] ${msg}`);
    },
    info: (msg) => {
      if (LEVELS.info >= min) console.info(`[IQOption] ${msg}`);
    },
    warn: (msg) => {
      if (LEVELS.warn >= min) console.warn(`[IQOption] ${msg}`);
    },
    error: (msg) => {
      if (LEVELS.error >= min) console.error(`[IQOption] ${msg}`);
    },
  };
}

export const noopLogger: ILogger = {
  debug: () => undefined,
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
};
