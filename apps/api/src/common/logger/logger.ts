import { randomUUID } from "node:crypto";
import pino from "pino";
import pinoHttp from "pino-http";

const isProd = process.env.NODE_ENV === "production";

/**
 * The one pino instance for the whole process — everything else (the Nest
 * logger adapter, the HTTP access-log middleware, the GraphQL operation
 * logger, per-service child loggers) wraps or derives from this, the same
 * way a Go service passes around one *zap.Logger (or its .Named() children)
 * instead of constructing loggers ad hoc.
 */
export const logger = pino({
  level: process.env.LOG_LEVEL ?? (isProd ? "info" : "debug"),
  transport: isProd
    ? undefined
    : {
        target: "pino-pretty",
        options: { colorize: true, singleLine: true, translateTime: "HH:MM:ss" },
      },
  redact: {
    paths: [
      "req.headers.authorization",
      "req.headers.cookie",
      'res.headers["set-cookie"]',
      "*.password",
      "*.currentPassword",
      "*.newPassword",
      "*.token",
    ],
    censor: "[redacted]",
  },
});

/** A component-scoped child logger — e.g. `logger.child({ component: "HabitsService" })`. */
export function scopedLogger(component: string) {
  return logger.child({ component });
}

/**
 * Structured HTTP access logging for every REST request (method, url,
 * status, duration). The request id comes from the `x-request-id` header
 * the BFF forwards, which the gateway originally set, so an API log line
 * carries the same `reqId` as the BFF and gateway lines for that user action.
 * If the header is missing, for example on a direct call during local dev,
 * a new id is generated.
 */
export const httpLogger = pinoHttp({
  logger,
  autoLogging: true,
  genReqId: (req, res) => {
    const id = (req.headers["x-request-id"] as string | undefined) ?? randomUUID();
    res.setHeader("x-request-id", id);
    return id;
  },
  customSuccessMessage: (req, res) => `${req.method} ${req.url} ${res.statusCode}`,
  customErrorMessage: (req, res, err) =>
    `${req.method} ${req.url} ${res.statusCode}: ${err.message}`,
});
