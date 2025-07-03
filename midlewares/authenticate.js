import jwt from 'jsonwebtoken';
import CustomError from '../utils/error.js';
import logger from '../config/logger.js';

export default (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer')) {
    const error = new CustomError('No token provided', 401);
    logger.warn('Authentication failed : No token provided', {
      path: req.originalUrl,
    });
    return next(error);
  }
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.key !== process.env.SERVICE_KEY) {
      const error = new CustomError('Invalid service key', 401);
      logger.warn(`Authentication failed : invalid service key`, {
        path: req.originalUrl,
      });
      return next(error);
    }
    logger.info('Authentication request', {
      path: req.originalUrl,
      issuer: decoded.issuer,
    });
    next();
  } catch (err) {
    const error = new CustomError(`Invalid token :${err.message}`, 401);
    logger.warn(`Authentication failed :${err.message}`, {
      path: req.originalUrl,
    });
    next(error);
  }
};
