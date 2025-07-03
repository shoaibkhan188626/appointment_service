import logger from '../config/logger.js';

export default (err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  const status =
    err.status || (statusCode >= 400 && statusCode < 500 ? 'fail' : 'error');
  const message = err.message | 'internal server error';
  const details = err.details || {};

  logger.error(`${statusCode.toUpperCase()}:${message}`, {
    statusCode,
    path: req.originalUrl,
    method: req.method,
    details,
    stack: err.stack,
  });
  res.status(statusCode).json({
    status,
    message,
    ...details(
      process.env.NODE_ENV !== 'production' && { details, stack: err.stack }
    ),
  });
};
