import express from 'express';
import helmet from 'helmet';
import dotenv from 'dotenv';
import connectDB from './config/database.js';
import logger from './config/logger.js';
import appointmentRoutes from './routes/appointment.routes.js';
import errorHandler from './midlewares/ErrorHandler.js';

dotenv.config();

const app = express();

app.use(helmet());
app.use(express.json({ limit: '10kb' }));

connectDB.catch((err) => {
  logger.error(
    `Failed to start the server due to MongoDB connection error : ${err.message}`
  );
  process.exit(1);
});

app.use('/', appointmentRoutes);
app.use(errorHandler);

export default app;
