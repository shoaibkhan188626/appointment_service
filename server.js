import app from './app.js';
import logger from './config/logger.js';

const PORT = process.env.PORT || 8083;

app.listen(PORT, () => {
  logger.info(`Appointment service running on port ${PORT}`);
});
