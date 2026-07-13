const bcrypt = require('bcryptjs');
const userModel = require('../models/userModel');

const MAX_NAME_LENGTH = 100;
const MAX_EMAIL_LENGTH = 254;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateProfileBody(body) {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    return { error: 'El nombre y el correo son obligatorios.' };
  }

  if (
    !Object.prototype.hasOwnProperty.call(body, 'nombre')
    || !Object.prototype.hasOwnProperty.call(body, 'correo')
  ) {
    return { error: 'El nombre y el correo son obligatorios.' };
  }

  if (typeof body.nombre !== 'string' || typeof body.correo !== 'string') {
    return { error: 'El nombre y el correo deben ser cadenas de texto.' };
  }

  const name = body.nombre.trim();
  const email = body.correo.trim().toLowerCase();

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

  return { data: { name, email } };
}

function validateDeleteBody(body) {
  if (
    body === null
    || typeof body !== 'object'
    || Array.isArray(body)
    || !Object.prototype.hasOwnProperty.call(body, 'password')
  ) {
    return { error: 'La contraseña actual es obligatoria.' };
  }

  if (typeof body.password !== 'string') {
    return { error: 'La contraseña actual debe ser una cadena de texto.' };
  }

  if (body.password.length === 0) {
    return { error: 'La contraseña actual es obligatoria.' };
  }

  return { data: { password: body.password } };
}

function updateCurrentUser(req, res, next) {
  const validation = validateProfileBody(req.body);

  if (validation.error) {
    return res.status(400).json({
      success: false,
      message: validation.error
    });
  }

  const userId = req.user.id_usuario;
  const { name, email } = validation.data;

  try {
    if (userModel.getUserByEmailExcludingId(email, userId)) {
      return res.status(409).json({
        success: false,
        message: 'Ya existe una cuenta con ese correo.'
      });
    }

    const user = userModel.updateUser({ userId, name, email });

    return res.json({
      success: true,
      data: { user }
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

async function deleteCurrentUser(req, res, next) {
  const validation = validateDeleteBody(req.body);

  if (validation.error) {
    return res.status(400).json({
      success: false,
      message: validation.error
    });
  }

  const userId = req.user.id_usuario;

  try {
    const user = userModel.getUserByIdWithPassword(userId);

    if (!user) {
      throw new Error('No se encontró el usuario autenticado.');
    }

    const passwordIsValid = await bcrypt.compare(
      validation.data.password,
      user.password_hash
    );

    if (!passwordIsValid) {
      return res.status(403).json({
        success: false,
        message: 'La contraseña actual es incorrecta.'
      });
    }

    if (!userModel.deleteUserById(userId)) {
      throw new Error('La eliminación no afectó exactamente un usuario.');
    }

    return res.json({
      success: true,
      message: 'Cuenta eliminada correctamente.'
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  deleteCurrentUser,
  updateCurrentUser
};
