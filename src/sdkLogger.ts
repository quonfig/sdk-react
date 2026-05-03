/**
 * Pluggable logger interface for SDK-internal warnings and errors.
 *
 * Shape mirrors @quonfig/node so the contract is uniform across the
 * TypeScript SDKs: `warn` and `error` are required; `debug` and `info` are
 * optional and become no-ops when the supplied logger does not implement
 * them.
 */
export interface Logger {
  debug?(message: string, ...args: unknown[]): void;
  info?(message: string, ...args: unknown[]): void;
  warn(message: string, ...args: unknown[]): void;
  error(message: string, ...args: unknown[]): void;
}

export interface NormalizedLogger {
  debug(message: string, ...args: unknown[]): void;
  info(message: string, ...args: unknown[]): void;
  warn(message: string, ...args: unknown[]): void;
  error(message: string, ...args: unknown[]): void;
}

const NOOP = (): void => {};

const PREFIX = "[quonfig]";

function defaultSdkLogger(): NormalizedLogger {
  return {
    /* eslint-disable no-console */
    debug: (message, ...args) => console.debug(PREFIX, message, ...args),
    info: (message, ...args) => console.info(PREFIX, message, ...args),
    warn: (message, ...args) => console.warn(PREFIX, message, ...args),
    error: (message, ...args) => console.error(PREFIX, message, ...args),
    /* eslint-enable no-console */
  };
}

export function normalizeLogger(logger: Logger | undefined): NormalizedLogger {
  if (!logger) return defaultSdkLogger();
  return {
    debug: logger.debug ? logger.debug.bind(logger) : NOOP,
    info: logger.info ? logger.info.bind(logger) : NOOP,
    warn: logger.warn.bind(logger),
    error: logger.error.bind(logger),
  };
}
