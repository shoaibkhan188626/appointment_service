import axios from 'axios';
import logger from '../config/logger.js';
import CustomError from '../utils/error.js';

export const validateUser = async (userId, role) => {
  try {
    const response = await axios.get(
      `${process.env.USER_SERVICE_URL}/api/users/${userId}`,
      {
        headers: { Authorization: `Bearer ${process.env.SERVICE_KEY}` },
        timeout: 5000,
      }
    );
    const user = response.data.data;
    if (user.role !== role) {
      throw new CustomError(
        `Invalid user role: expected ${role}, got ${user.role}`,
        400
      );
    }
    return user;
  } catch (err) {
    logger.error(`Failed to validate user ${userId}: ${err.message}`, {
      stack: err.stack,
    });
    throw new CustomError(
      `User validation failed: ${err.message}`,
      err.response?.status || 500
    );
  }
};

export const validateHospital = async (hospitalId) => {
  try {
    const response = await axios.get(
      `${process.env.HOSPITAL_SERVICE_URL}/api/hospitals/${hospitalId}`,
      {
        headers: { Authorization: `Bearer ${process.env.SERVICE_KEY}` },
        timeout: 5000,
      }
    );
    return response.data.data;
  } catch (err) {
    logger.error(`Failed to validate hospital ${hospitalId}: ${err.message}`, {
      stack: err.stack,
    });
    throw new CustomError(
      `Hospital validation failed: ${err.message}`,
      err.response?.status || 500
    );
  }
};

export const createNotification = async ({
  type,
  recipient,
  subject,
  message,
  externalId,
  phoneNumber,
}) => {
  try {
    const payload = { type, recipient, subject, message, externalId };
    if (type === 'sms' && phoneNumber) {
      payload.phoneNumber = phoneNumber;
    }
    const response = await axios.post(
      `${process.env.NOTIFICATION_SERVICE_URL}/api/notifications`,
      payload,
      {
        headers: { Authorization: `Bearer ${process.env.SERVICE_KEY}` },
        timeout: 5000,
      }
    );
    logger.info(`Notification sent: ${type} for ${externalId}`, {
      recipient,
      phoneNumber,
    });
    return response.data;
  } catch (err) {
    logger.error(
      `Failed to send ${type} notification for ${externalId}: ${err.message}`,
      { stack: err.stack }
    );
    throw new CustomError(
      `Notification failed: ${err.message}`,
      err.response?.status || 500
    );
  }
};
