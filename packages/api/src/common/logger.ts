import pino, { type Logger } from 'pino';

const isDev = process.env.NODE_ENV !== 'production';
const level = (process.env.LOG_LEVEL ?? 'info') as pino.Level;

export const logger: Logger = isDev
  ? pino({
      level,
      transport: {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'HH:MM:ss.l',
          ignore: 'pid,hostname',
        },
      },
    })
  : pino({ level });
