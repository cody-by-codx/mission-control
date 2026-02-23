import pino from 'pino';

const isDev = process.env.NODE_ENV !== 'production';

const logger = pino({
  level: process.env.LOG_LEVEL || (isDev ? 'debug' : 'info'),
  ...(isDev
    ? {
        transport: {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'HH:MM:ss',
            ignore: 'pid,hostname',
          },
        },
      }
    : {}),
  base: {
    service: 'mission-control',
  },
  formatters: {
    level(label) {
      return { level: label };
    },
  },
});

export default logger;

// Convenience child loggers for different modules
export const dbLogger = logger.child({ module: 'db' });
export const apiLogger = logger.child({ module: 'api' });
export const openclawLogger = logger.child({ module: 'openclaw' });
export const sseLogger = logger.child({ module: 'sse' });
