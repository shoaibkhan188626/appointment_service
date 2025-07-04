import app from './app.js';
import connectDB from './config/database.js';
import logger from './config/logger.js';

const PORT = process.env.PORT || 8083;

const startServer = async () => {
  try {
    await connectDB();
    app.listen(PORT, () => {
      logger.info(`✅ Appointment Service running on port ${PORT}`);
    });
  } catch (err) {
    logger.error(`❌ Failed to start server: ${err.message}`, { stack: err.stack });
    process.exit(1);
  }
};

// Top-level start
startServer();

// Handle global errors
process.on('uncaughtException', (err) => {
  logger.error(`Uncaught Exception: ${err.message}`, { stack: err.stack });
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error(`Unhandled Rejection: ${reason}`, { stack: reason?.stack });
  process.exit(1);
});
