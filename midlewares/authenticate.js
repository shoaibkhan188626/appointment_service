import jwt from 'jsonwebtoken';
import CustomError from '../utils/error.js';
import logger from '../config/logger.js';

const authenticate =
  (requiredRoles = []) =>
  async (req, res, next) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer')) {
        throw new CustomError('Authentication token missing', 401);
      }

      const token = authHeader.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      if (!decoded.key || decoded.key !== process.env.SERVICE_KEY) {
        throw new CustomError('Invalid service key', 403);
      }
      req.user = {
        id: decoded.sub || 'system',
        role: decoded.role || 'system',
      };

      if (requiredRoles.length && !requiredRoles.includes(req.user.role)) {
        throw new CustomError(
          `Access user: ${req.user.role} role not authorized`,
          403
        );
      }
      logger.info(`Authenticated user: ${req.user.id}, role:${req.user.role}`);
      next();
    } catch (err) {
      logger.error(`Authentication failed: ${err.message}`, {
        stack: err.stack,
      });
      next(
        new CustomError(
          err.message || 'Authentication failed',
          err.status || 401
        )
      );
    }
  };

export default authenticate;
