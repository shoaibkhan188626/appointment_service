import logger from '../config/logger.js';
import CustomError from '../utils/error.js';

/**
 * Global error handler middleware
 * @param {Error} err - The error object
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
export default (err, req, res, next) => {
  // Default error details
  const statusCode = err.statusCode && Number.isInteger(err.statusCode) ? err.statusCode : 500;
  const message = err.message || 'Internal Server Error';
  const errors = err.errors || [];

  // Log the error (NDHM audit compliance)
  logger.error(`Error in ${req.method} ${req.originalUrl}: ${message}`, {
    statusCode,
    stack: err.stack,
    errors,
    user: req.user ? req.user.id : 'unauthenticated',
  });

  // Send error response
  res.status(statusCode).json({
    status: 'fail',
    message,
    errors,
  });
};