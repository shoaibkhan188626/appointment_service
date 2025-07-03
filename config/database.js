import mongoose from 'mongoose';
import logger from './logger.js';

export default async function connectDB(attempts = 5, delay = 5000) {
  const uri = process.env.MONGO_URI_LOCAL || process.env.MONGO_URI_ATLAS;
  if (!uri) {
    logger.error('MongoDB URI is not defined in environment variables');
    throw new Error('MongoDB URI is not defined');
  }

  for (let i = 1; i <= attempts; i++) {
    try {
      await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
      logger.info('Connected to MongoDB successfully');
      return;
    } catch (err) {
      logger.error(`MongoDB connection attempt ${i} failed:${err.message}`);
      if (i === attempts) {
        logger.error('Max connection attempts reached. Exiting...');
        throw new Error(
          `Failed to connect to mongoDB after ${attempts} attempts: ${
            err.message
          }`
        );
      }
      logger.info(`Retrying connection in ${delay / 1000}seconds...`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}

mongoose.connection.on('error', (err) => {
  logger.error(`MongoDB connection error: ${err.message}`);
});

mongoose.connection.on('disconnected', () => {
  logger.warn('MongoDB disconnected. Attempting to reconnect...');
  connectDB().catch((err) =>
    logger.error(`Reconnection failed : ${err.message}`)
  );
});
