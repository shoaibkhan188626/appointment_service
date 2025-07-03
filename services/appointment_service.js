import axios from 'axios';
import logger from '../config/logger.js';
import CustomError from '../utils/error.js';
import { generateJWT } from '../utils/generate-jwt.js';

export async function validateUser(userId, role, retries = 3, delay = 1000) {
  const url = `${process.env.USER_SERVICE_URL}/api/users/${userId}`;
  for (let i = 1; i <= retries; i++) {
    try {
      const token = await generateJWT();
      const response = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch (error) {}
  }
}
