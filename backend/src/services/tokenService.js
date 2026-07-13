const jwt = require('jsonwebtoken');

const TOKEN_EXPIRES_IN_SECONDS = 2 * 60 * 60;

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;

  if (typeof secret !== 'string' || !secret.trim()) {
    const error = new Error('JWT_SECRET no está configurado.');
    error.code = 'AUTH_CONFIGURATION_ERROR';
    throw error;
  }

  return secret;
}

function createToken(userId) {
  return jwt.sign({}, getJwtSecret(), {
    algorithm: 'HS256',
    expiresIn: TOKEN_EXPIRES_IN_SECONDS,
    subject: String(userId)
  });
}

function verifyToken(token) {
  return jwt.verify(token, getJwtSecret(), {
    algorithms: ['HS256']
  });
}

function isKnownTokenError(error) {
  return error instanceof jwt.JsonWebTokenError
    || error instanceof jwt.TokenExpiredError
    || error instanceof jwt.NotBeforeError;
}

module.exports = {
  TOKEN_EXPIRES_IN_SECONDS,
  createToken,
  isKnownTokenError,
  verifyToken
};
