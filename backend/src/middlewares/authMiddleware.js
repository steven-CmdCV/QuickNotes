const {
  isKnownTokenError,
  verifyToken
} = require('../services/tokenService');
const userModel = require('../models/userModel');

function authMiddleware(req, res, next) {
  const authorization = req.get('authorization');
  const bearerMatch = typeof authorization === 'string'
    ? /^Bearer ([^\s,]+)$/.exec(authorization)
    : null;

  if (!bearerMatch) {
    return res.status(401).json({
      success: false,
      message: 'Autenticación requerida.'
    });
  }

  try {
    const payload = verifyToken(bearerMatch[1]);

    if (typeof payload.sub !== 'string' || !/^[1-9]\d*$/.test(payload.sub)) {
      return res.status(401).json({
        success: false,
        message: 'Token inválido o expirado.'
      });
    }

    const userId = Number(payload.sub);

    if (!Number.isSafeInteger(userId)) {
      return res.status(401).json({
        success: false,
        message: 'Token inválido o expirado.'
      });
    }

    const user = userModel.getPublicUserById(userId);

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Token inválido o expirado.'
      });
    }

    req.user = { id_usuario: userId };

    return next();
  } catch (error) {
    if (isKnownTokenError(error)) {
      return res.status(401).json({
        success: false,
        message: 'Token inválido o expirado.'
      });
    }

    return next(error);
  }
}

module.exports = authMiddleware;
