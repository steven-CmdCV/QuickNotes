const bcrypt = require('bcryptjs');
const userModel = require('../models/userModel');
const {
  TOKEN_EXPIRES_IN_SECONDS,
  createToken
} = require('../services/tokenService');

const BCRYPT_COST = 10;
const MAX_NAME_LENGTH = 100;
const MAX_EMAIL_LENGTH = 254;
const MIN_PASSWORD_LENGTH = 8;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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

function createSessionData(user) {
  return {
    token: createToken(user.id_usuario),
    token_type: 'Bearer',
    expires_in: TOKEN_EXPIRES_IN_SECONDS,
    user: toPublicUser(user)
  };
}

function validateRegisterBody(body) {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    return { error: 'El nombre, el correo y la contraseña son obligatorios.' };
  }

  if (
    !Object.prototype.hasOwnProperty.call(body, 'nombre')
    || !Object.prototype.hasOwnProperty.call(body, 'correo')
    || !Object.prototype.hasOwnProperty.call(body, 'password')
  ) {
    return { error: 'El nombre, el correo y la contraseña son obligatorios.' };
  }

  if (
    typeof body.nombre !== 'string'
    || typeof body.correo !== 'string'
    || typeof body.password !== 'string'
  ) {
    return {
      error: 'El nombre, el correo y la contraseña deben ser cadenas de texto.'
    };
  }

  const name = body.nombre.trim();
  const email = body.correo.trim().toLowerCase();
  const password = body.password;

  if (!name) {
    return { error: 'El nombre es obligatorio.' };
  }

  if (name.length > MAX_NAME_LENGTH) {
    return {
      error: `El nombre no puede exceder los ${MAX_NAME_LENGTH} caracteres.`
    };
  }

  if (!email) {
    return { error: 'El correo es obligatorio.' };
  }

  if (email.length > MAX_EMAIL_LENGTH) {
    return {
      error: `El correo no puede exceder los ${MAX_EMAIL_LENGTH} caracteres.`
    };
  }

  if (!EMAIL_PATTERN.test(email)) {
    return { error: 'El correo no tiene un formato válido.' };
  }

  if (!password) {
    return { error: 'La contraseña es obligatoria.' };
  }

  if (password.length < MIN_PASSWORD_LENGTH) {
    return {
      error: `La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`
    };
  }

  if (bcrypt.truncates(password)) {
    return { error: 'La contraseña supera el límite permitido.' };
  }

  return {
    data: {
      name,
      email,
      password
    }
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

    return res.json({
      success: true,
      data: createSessionData(user)
    });
  } catch (error) {
    return next(error);
  }
}

async function register(req, res, next) {
  const validation = validateRegisterBody(req.body);

  if (validation.error) {
    return res.status(400).json({
      success: false,
      message: validation.error
    });
  }

  const { name, email, password } = validation.data;

  try {
    if (userModel.getUserByEmail(email)) {
      return res.status(409).json({
        success: false,
        message: 'Ya existe una cuenta con ese correo.'
      });
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_COST);
    const user = userModel.createUser({
      name,
      email,
      passwordHash
    });

    return res.status(201).json({
      success: true,
      data: createSessionData(user)
    });
  } catch (error) {
    if (error.code === userModel.EMAIL_ALREADY_EXISTS_CODE) {
      return res.status(409).json({
        success: false,
        message: 'Ya existe una cuenta con ese correo.'
      });
    }

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
  login,
  register
};
