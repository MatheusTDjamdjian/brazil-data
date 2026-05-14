import pino, { type Logger } from 'pino';

// IMPORTANTE: MCP usa stdout para JSON-RPC. Logs vão para stderr (fd 2)
// para não corromper o protocolo.

const isDev = process.env.NODE_ENV !== 'production';
const level = (process.env.LOG_LEVEL ?? 'info') as pino.Level;

export const logger: Logger = isDev
  ? pino({
      level,
      transport: {
        target: 'pino-pretty',
        options: {
          destination: 2,
          colorize: true,
          translateTime: 'HH:MM:ss.l',
          ignore: 'pid,hostname',
        },
      },
    })
  : pino({ level }, pino.destination(2));
