import { v4 as uuidv4 } from 'uuid';
import logger from '../config/logger.js';

export default (req, res, next) => {
  const requestId = uuidv4();
  const start = Date.now();

  logger.info(`Request ${requestId} started`, {
    method: req.method,
    url: req.originalUrl,
    header: {
      authorization: req.headers.authorization ? 'Bearer[REDACTED]' : undefined,
      'content-type': req.headers['content-type'],
    },
    body: req.body,
    ip: req.ip,
  });

  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info(`Request ${requestId} completed`, {
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      duration: `${duration}ms`,
    });
  });
  next();
};
