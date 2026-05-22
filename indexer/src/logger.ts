import pino from 'pino';
import { config } from './config';

export const logger = pino({
  level: config.log.level,
  transport:
    config.nodeEnv !== 'production'
      ? {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:standard',
            ignore: 'pid,hostname',
          },
        }
      : undefined,
  base: {
    service: 'shitmarket-indexer',
  },
  redact: ['*.privateKey', '*.password', '*.secret'],
});
