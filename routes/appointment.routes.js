import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import authenticate from '../midlewares/authenticate.js';
import loggerMiddleware from '../midlewares/logger.middleware.js';
import {
  createAppointment,
  getAppointmentById,
  getAppointments,
  updateAppointment,
  cancelAppointment,
} from '../controllers/appointment.controller.js';
import logger from '../config/logger.js';
import CustomError from '../utils/error.js';

const router = express.Router();

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: {
    status: 'fail',
    message: 'Too many request',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

router.use(helmet());
router.use(loggerMiddleware);
router.use(apiLimiter);

const API_VERSION = '/api/v1';

router.get('/health', (req, res) => {
  logger.info('Health check endpoint accessed');
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

router
  .route(`${API_VERSION}/appointments`)
  .post(authenticate, async (req, res, next) => {
    try {
      await createAppointment(req, res, next);
    } catch (err) {
      logger.error(`Error in POST /appointments: ${err.message}`, {
        stack: err.stack,
      });
      next(err);
    }
  })
  .get(authenticate, async (req, res, next) => {
    try {
      await getAppointments(req, res, next);
    } catch (err) {
      logger.error(`Error in GET /appointments :${err.message}`, {
        stack: err.stack,
      });
      next(err);
    }
  });

router
  .route(`${API_VERSION}/appointments/:id`)
  .get(authenticate, async (req, res, next) => {
    try {
      await getAppointmentById(req, res, next);
    } catch (error) {
      logger.error(`Error in GET /appointments/:id ${err.message}`, {
        stack: err.stack,
      });
      next(err);
    }
  })
  .put(authenticate, async (req, res, next) => {
    try {
      await updateAppointment(req, res, next);
    } catch (error) {
      logger.error(`Error in PUT /appointments/:id :${err.message}`, {
        stack: err.stack,
      });
      next(err);
    }
  })
  .delete(authenticate, async (req, res, next) => {
    try {
      await cancelAppointment(req, res, next);
    } catch (err) {
      logger.error(`Error in DELETE /appointments/:id ${err.message}`, {
        stack: err.stack,
      });
      next(err);
    }
  });

router.use((req, res, next) => {
  const error = new CustomError(`Route ${req.originalUrl} not found`, 404);
  logger.warn(`Invalid route accessed : ${req.originalUrl}`, {
    method: req.method,
  });
  next(error);
});

export default router;
