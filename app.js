import express from 'express';
import helmet from 'helmet';
import dotenv from 'dotenv';
import swaggerUi from 'swagger-ui-express';
import connectDB from './config/database.js';
import logger from './config/logger.js';
import appointmentRoutes from './routes/appointment.routes.js';
import errorHandler from './midlewares/ErrorHandler.js';
import swaggerSpec from './docs/swagger.js';
import { metricsMiddleware } from './metrics.js';

// Initialize environment variables
dotenv.config();

// Initialize Express app
const app = express();

// Apply security headers
app.use(helmet());

// Request timeout (30s) to prevent hanging requests
app.use((req, res, next) => {
  res.setTimeout(30000, () => {
    logger.error(`Request timed out: ${req.method} ${req.originalUrl}`);
    res.status(504).json({ status: 'fail', message: 'Request timed out' });
  });
  next();
});

// Parse JSON bodies
app.use(express.json({ limit: '10kb' })); // Limit payload size for security

// Apply metrics middleware
app.use(metricsMiddleware);

// Serve Swagger UI
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Connect to MongoDB
connectDB().catch(err => {
  logger.error(`Failed to start server due to MongoDB connection error: ${err.message}`);
  process.exit(1);
});

// Mount routes
app.use('/', appointmentRoutes);

// Global error handler
app.use(errorHandler);

export default app;