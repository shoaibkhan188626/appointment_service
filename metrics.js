import client from 'prom-client';
import logger from './config/logger.js';

// Enable default metrics (CPU, memory, etc.)
client.collectDefaultMetrics({ timeout: 5000 });

// Custom metrics
const httpRequestCounter = new client.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status'],
});

const httpRequestDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route'],
  buckets: [0.1, 0.5, 1, 2, 5, 10],
});

const errorCounter = new client.Counter({
  name: 'http_errors_total',
  help: 'Total number of HTTP errors',
  labelNames: ['method', 'route', 'status'],
});

const recurringAppointmentsCounter = new client.Counter({
  name: 'recurring_appointments_created_total',
  help: 'Total number of recurring appointments created',
  labelNames: ['type'],
});

// Middleware to collect metrics
export const metricsMiddleware = (req, res, next) => {
  const start = process.hrtime();
  const route = req.baseUrl + req.path;

  res.on('finish', () => {
    const duration = process.hrtime(start);
    const durationInSeconds = duration[0] + duration[1] / 1e9;

    // Increment request counter
    httpRequestCounter.labels(req.method, route, res.statusCode).inc();

    // Record request duration
    httpRequestDuration.labels(req.method, route).observe(durationInSeconds);

    // Increment error counter for 4xx/5xx
    if (res.statusCode >= 400) {
      errorCounter.labels(req.method, route, res.statusCode).inc();
    }

    // Increment recurring appointments counter for successful POST with recurrence
    if (req.method === 'POST' && route.includes('/api/v1/appointments') && res.statusCode === 201 && req.body.recurrence?.type) {
      recurringAppointmentsCounter.labels(req.body.recurrence.type).inc(res.get('X-Recurring-Count') || 1);
    }

    logger.info(`Request processed: ${req.method} ${route}`, {
      status: res.statusCode,
      duration: durationInSeconds,
    });
  });

  next();
};

// Endpoint to expose metrics
export const metricsEndpoint = (req, res) => {
  res.set('Content-Type', client.register.contentType);
  client.register.metrics().then(metrics => res.send(metrics)).catch(err => {
    logger.error(`Failed to serve metrics: ${err.message}`, { stack: err.stack });
    res.status(500).send('Error retrieving metrics');
  });
};