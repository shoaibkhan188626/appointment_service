import axios from 'axios';
import logger from '../config/logger.js';
import CustomError from '../utils/error.js';
import { generateJWT } from '../utils/generate-jwt.js';
import { error } from 'winston';

export async function validateUser(userId, role, retries = 3, delay = 1000) {
  const url = `${process.env.USER_SERVICE_URL}/api/users/${userId}`;
  for (let i = 1; i <= retries; i++) {
    try {
      const token = await generateJWT();
      const response = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 5000,
      });

      const user = response.data.data;
      if (user.role !== role) {
        throw new CustomError(`User ${userId} is not a ${role}`, 400, {
          userId,
        });
      }

      if (role === 'doctor' && !user.kycVerified) {
        throw new CustomError(`Doctor KYC is not verified`, 403, { userId });
      }
      logger.info(`validated ${role} with ID ${userId}`);
      return user;
    } catch (err) {
      logger.error(
        `Attempt ${i} failed to validate user ${userId}:${err.message}`
      );
      if (i === retries) {
        throw new CustomError(
          `Failed to validate user ${userId}`,
          err.response?.status || 500,
          {
            userId,
            error: err.message,
          }
        );
      }
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}

export async function validateHospital(hospitalId, retries = 3, delay = 1000) {
  const url = `${process.env.HOSPITAL_SERVICE_URL}/api/hospitals/${hospitalId}`;
  for (let i = 1; i <= retries; i++) {
    try {
      const token = await generateJWT();
      await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 5000,
      });
      logger.info(`Validated hospital with ID ${hospitalId}`);
      return;
    } catch (err) {
      logger.error(
        `Attempt ${i} failed to validate hospital ${hospitalId} : ${err.message}`
      );
      if (i === retries) {
        throw new CustomError(
          `Failed to validate hospital ${hospitalId}`,
          err.response?.status || 500,
          {
            hospitalId,
            error: err.message,
          }
        );
      }
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}

export async function createNotification(
  { type, recipient, subject, message, externalId },
  retries = 3,
  delay = 1000
) {
  const url = `${process.env.NOTIFICATION_SERVICE_URL}/api/notifications`;
  for (let i = 1; i <= retries; i++) {
    try {
      const token = await generateJWT();
      const response = await axios.post(
        url,
        { type, recipient, subject, message, externalId },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          timeout: 5000,
        }
      );
      logger.info(
        `Notification sent for appointment ${externalId} : ${type} to ${recipient}`
      );
      return response.data;
    } catch (err) {
      logger.error(
        `Attempt ${i} failed to send notification for ${externalId}`,
        err.response?.status || 500,
        {
          externalId,
          error: err.message,
        }
      );
    }
    await new Promise((resolve) => setTimeout(resolve, delay));
  }
}
