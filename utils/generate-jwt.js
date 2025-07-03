import jwt from 'jsonwebtoken';
import logger from '../config/logger.js';

export async function generateJWT() {
  try {
    const secret = process.env.JWT_SECRET;
    const payload = {
      key: process.env.SERVICE_KEY,
      issuer: 'appointment-service',
      issuedAt: Math.floor(Date.now() / 1000),
    };

    const token = jwt.sign(payload, secret, {
      expiresIn: '1h',
      algorithm: 'HS256',
    });
    logger.info('Generated JWT for inter-service authentication');
    return token;
  } catch (err) {
    logger.error(`Failed to generate JWT : ${err.message}`);
    throw new Error(`JWT generation failed : ${err.message}`);
  }
}

if (process.argv[2] === 'generate') {
  generateJWT()
    .then((token) => {
      console.log('SERVICE_KEY JWT :', token);
    })
    .catch((err) => {
      console.error(`ERROR in generating JWT:`, err.message);
      process.exit(1);
    });
}
