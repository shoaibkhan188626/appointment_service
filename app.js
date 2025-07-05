import express from 'express';
import helmet from 'helmet';
import dotenv from 'dotenv';

import connectDB from './config/database.js';
import logger from './config/logger.js';
import appointmentRoutes from './routes/appointment.routes.js';
import errorHandler from './midlewares/ErrorHandler.js';

import { metricsMiddleware, metricsEndpoint } from './metrics.js';

// Initialize environment variables
dotenv.config();

// Initialize Express app
const app = express();

// Apply security headers
app.use(helmet());

// Parse JSON bodies
app.use(express.json({ limit: '10kb' })); // Limit payload size for security

// Apply metrics middleware
app.use(metricsMiddleware);

// Serve Swagger UI

// Metrics endpoint for Prometheus
app.get('/metrics', metricsEndpoint);

// Connect to MongoDB
connectDB().catch((err) => {
  logger.error(
    `Failed to start server due to MongoDB connection error: ${err.message}`
  );
  process.exit(1);
});

// Mount routes
app.use('/', appointmentRoutes);

// Global error handler
app.use(errorHandler);

export default app;
