const db = require('../config/db');

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

module.exports = {
  getUserByEmail,
  getPublicUserById
};
