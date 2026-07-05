import winston from 'winston';
import { env } from '../../config/env';

const { combine, timestamp, colorize, printf, json } = winston.format;

const devFormat = printf(({ level, message, timestamp }) => {
  return `${timestamp} [${level}]: ${message}`;
});

export const logger = winston.createLogger({
  level: env.LOG_LEVEL,
  transports: [
    new winston.transports.Console({
      format:
        env.LOG_FORMAT === 'pretty'
          ? combine(
              colorize(),
              timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
              devFormat,
            )
          : combine(timestamp(), json()),
    }),
  ],
});