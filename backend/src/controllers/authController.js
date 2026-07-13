const bcrypt = require('bcryptjs');
const userModel = require('../models/userModel');
const {
  TOKEN_EXPIRES_IN_SECONDS,
  createToken
} = require('../services/tokenService');

function validateLoginBody(body) {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    return { error: 'El correo y la contraseña son obligatorios.' };
  }

  if (
    !Object.prototype.hasOwnProperty.call(body, 'correo')
    || !Object.prototype.hasOwnProperty.call(body, 'password')
  ) {
    return { error: 'El correo y la contraseña son obligatorios.' };
  }

  if (typeof body.correo !== 'string' || typeof body.password !== 'string') {
    return {
      error: 'El correo y la contraseña deben ser cadenas de texto.'
    };
  }

  const email = body.correo.trim().toLowerCase();

  if (!email || body.password.length === 0) {
    return { error: 'El correo y la contraseña son obligatorios.' };
  }

  return {
    data: {
      email,
      password: body.password
    }
  };
}

function toPublicUser(user) {
  return {
    id_usuario: user.id_usuario,
    nombre: user.nombre,
    correo: user.correo
  };
}

async function login(req, res, next) {
  const validation = validateLoginBody(req.body);

  if (validation.error) {
    return res.status(400).json({
      success: false,
      message: validation.error
    });
  }

  const { email, password } = validation.data;

  try {
    const user = userModel.getUserByEmail(email);
    const passwordIsValid = user
      ? await bcrypt.compare(password, user.password_hash)
      : false;

    if (!user || !passwordIsValid) {
      return res.status(401).json({
        success: false,
        message: 'Credenciales inválidas.'
      });
    }

    const token = createToken(user.id_usuario);

    return res.json({
      success: true,
      data: {
        token,
        token_type: 'Bearer',
        expires_in: TOKEN_EXPIRES_IN_SECONDS,
        user: toPublicUser(user)
      }
    });
  } catch (error) {
    return next(error);
  }
}

function getMe(req, res, next) {
  try {
    const user = userModel.getPublicUserById(req.user.id_usuario);

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Token inválido o expirado.'
      });
    }

    return res.json({
      success: true,
      data: {
        user
      }
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  getMe,
  login
};
