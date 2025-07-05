import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import authenticate from '../midlewares/authenticate.js';
import loggerMiddleware from '../midlewares/logger.middleware.js';
import {
  createAppointment,
  getAppointments,
  getAppointmentById,
  updateAppointment,
  cancelAppointment,
  healthCheck,
  metricsEndpoint,
} from '../controllers/appointment.controller.js';
import logger from '../config/logger.js';
import CustomError from '../utils/error.js';
import { metricsMiddleware } from '../metrics.js';

// Initialize router
const router = express.Router();

// Rate limiters (DPDP Act compliance)
const createLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // 50 requests per IP
  message: {
    status: 'fail',
    message: 'Too many create requests, please try again after 15 minutes',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const recurringCreateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 25, // Stricter for recurring appointments
  message: {
    status: 'fail',
    message:
      'Too many recurring appointment requests, please try again after 15 minutes',
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `${req.ip}:recurring`, // Unique key for recurring requests
});

const readLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // 200 requests per IP
  message: {
    status: 'fail',
    message: 'Too many read requests, please try again after 15 minutes',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const updateDeleteLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // 50 requests per IP
  message: {
    status: 'fail',
    message:
      'Too many update/delete requests, please try again after 15 minutes',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const healthLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // 1000 requests per IP
  message: {
    status: 'fail',
    message:
      'Too many health check requests, please try again after 15 minutes',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply global middlewares
router.use(helmet()); // Security headers for DPDP Act
router.use(loggerMiddleware); // Request logging for NDHM audit trails
router.use(metricsMiddleware); // Metrics for monitoring

// API version prefix
const API_VERSION = '/api/v1';

// Health check endpoint (public)
router.get('/health', healthLimiter, healthCheck);

// Metrics endpoint (public)
router.get('/metrics', metricsEndpoint);

// Appointment routes with RBAC and rate limiting
router
  .route(`${API_VERSION}/appointments`)
  .post(authenticate(['patient', 'admin']), async (req, res, next) => {
    try {
      // Apply stricter rate limiter for recurring appointments
      const limiter = req.body.recurrence?.type
        ? recurringCreateLimiter
        : createLimiter;
      limiter(req, res, async () => {
        await createAppointment(req, res, next);
      });
    } catch (err) {
      logger.error(`Error in POST /appointments: ${err.message}`, {
        stack: err.stack,
      });
      next(err);
    }
  })
  .get(
    authenticate(['patient', 'doctor', 'admin']),
    readLimiter,
    async (req, res, next) => {
      try {
        await getAppointments(req, res, next);
      } catch (err) {
        logger.error(`Error in GET /appointments: ${err.message}`, {
          stack: err.stack,
        });
        next(err);
      }
    }
  );

router
  .route(`${API_VERSION}/appointments/:id`)
  .get(
    authenticate(['patient', 'doctor', 'admin']),
    readLimiter,
    async (req, res, next) => {
      try {
        await getAppointmentById(req, res, next);
      } catch (err) {
        logger.error(`Error in GET /appointments/:id: ${err.message}`, {
          stack: err.stack,
        });
        next(err);
      }
    }
  )
  .put(
    authenticate(['patient', 'admin']),
    updateDeleteLimiter,
    async (req, res, next) => {
      try {
        await updateAppointment(req, res, next);
      } catch (err) {
        logger.error(`Error in PUT /appointments/:id: ${err.message}`, {
          stack: err.stack,
        });
        next(err);
      }
    }
  )
  .delete(
    authenticate(['patient', 'admin']),
    updateDeleteLimiter,
    async (req, res, next) => {
      try {
        await cancelAppointment(req, res, next);
      } catch (err) {
        logger.error(`Error in DELETE /appointments/:id: ${err.message}`, {
          stack: err.stack,
        });
        next(err);
      }
    }
  );

// Handle invalid routes
router.use((req, res, next) => {
  const error = new CustomError(`Route ${req.originalUrl} not found`, 404);
  logger.warn(`Invalid route accessed: ${req.originalUrl}`, {
    method: req.method,
  });
  next(error);
});

export default router;
