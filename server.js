import dotenv from 'dotenv';
import app from './app.js';
import logger from './config/logger.js';
import connectDB from './config/database.js';

// Load environment variables
dotenv.config();

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception:', { error: err.message, stack: err.stack });
  process.exit(1);
});

// Connect to MongoDB and start server
const PORT = process.env.PORT || 8083;

connectDB()
  .then(() => {
    const server = app.listen(PORT, () => {
      logger.info(`Appointment Service running on port ${PORT}`);
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (err) => {
      logger.error('Unhandled Rejection:', {
        error: err.message,
        stack: err.stack,
      });
      server.close(() => process.exit(1));
    });

    // Graceful shutdown
    process.on('SIGTERM', () => {
      logger.info('SIGTERM received. Shutting down gracefully...');
      server.close(() => {
        logger.info('Server closed.');
        process.exit(0);
      });
    });
  })
  .catch((err) => {
    logger.error(`Failed to start server: ${err.message}`, {
      stack: err.stack,
    });
    process.exit(1);
  });
