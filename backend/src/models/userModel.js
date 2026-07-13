const db = require('../config/db');

const EMAIL_ALREADY_EXISTS_CODE = 'EMAIL_ALREADY_EXISTS';

function getUserByEmail(email) {
  const query = `
    SELECT
      id_usuario,
      nombre,
      correo,
      password_hash
    FROM usuarios
    WHERE correo = ? COLLATE NOCASE
  `;

  return db.prepare(query).get(email) || null;
}

function getPublicUserById(userId) {
  const query = `
    SELECT
      id_usuario,
      nombre,
      correo
    FROM usuarios
    WHERE id_usuario = ?
  `;

  return db.prepare(query).get(userId) || null;
}

function getUserByIdWithPassword(userId) {
  const query = `
    SELECT
      id_usuario,
      nombre,
      correo,
      password_hash
    FROM usuarios
    WHERE id_usuario = ?
  `;

  return db.prepare(query).get(userId) || null;
}

function getUserByEmailExcludingId(email, userId) {
  const query = `
    SELECT id_usuario
    FROM usuarios
    WHERE correo = ? COLLATE NOCASE
      AND id_usuario != ?
  `;

  return db.prepare(query).get(email, userId) || null;
}

function createUser({ name, email, passwordHash }) {
  const createUserTransaction = db.transaction(() => {
    const query = `
      INSERT INTO usuarios (nombre, correo, password_hash)
      VALUES (?, ?, ?)
    `;
    const result = db.prepare(query).run(name, email, passwordHash);

    if (result.changes !== 1) {
      throw new Error('La inserción no afectó exactamente un usuario.');
    }

    const user = getPublicUserById(Number(result.lastInsertRowid));

    if (!user) {
      throw new Error('No se pudo recuperar el usuario creado.');
    }

    return user;
  });

  try {
    return createUserTransaction();
  } catch (error) {
    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      const duplicateError = new Error('El correo ya está registrado.');
      duplicateError.code = EMAIL_ALREADY_EXISTS_CODE;
      throw duplicateError;
    }

    throw error;
  }
}

function updateUser({ userId, name, email }) {
  const updateUserTransaction = db.transaction(() => {
    const query = `
      UPDATE usuarios
      SET nombre = ?, correo = ?
      WHERE id_usuario = ?
    `;
    const result = db.prepare(query).run(name, email, userId);

    if (result.changes !== 1) {
      throw new Error('La actualización no afectó exactamente un usuario.');
    }

    const user = getPublicUserById(userId);

    if (!user) {
      throw new Error('No se pudo recuperar el usuario actualizado.');
    }

    return user;
  });

  try {
    return updateUserTransaction();
  } catch (error) {
    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      const duplicateError = new Error('El correo ya está registrado.');
      duplicateError.code = EMAIL_ALREADY_EXISTS_CODE;
      throw duplicateError;
    }

    throw error;
  }
}

function deleteUserById(userId) {
  const query = `
    DELETE FROM usuarios
    WHERE id_usuario = ?
  `;
  const result = db.prepare(query).run(userId);

  return result.changes === 1;
}

module.exports = {
  EMAIL_ALREADY_EXISTS_CODE,
  createUser,
  deleteUserById,
  getUserByEmail,
  getPublicUserById,
  getUserByEmailExcludingId,
  getUserByIdWithPassword,
  updateUser
};
