import express from 'express';
import helmet from 'helmet';
import dotenv from 'dotenv';
import appointmentRoutes from './routes/appointment.routes.js';
import errorHandler from './midlewares/ErrorHandler.js';

dotenv.config();

const app = express();

app.use(helmet());
app.use(express.json({ limit: '10kb' }));

app.get("/health", (req, res) =>
  res.json({ status: "ok", service: "appointment-service" }),
);

app.use('/', appointmentRoutes);
app.use(errorHandler);

export default app;