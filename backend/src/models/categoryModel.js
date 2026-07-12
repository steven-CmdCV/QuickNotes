const db = require('../config/db');

function getAllCategories() {
  const query = `
    SELECT
      id_categoria,
      nombre_categoria,
      descripcion,
      fecha_creacion
    FROM categorias
    ORDER BY nombre_categoria COLLATE NOCASE ASC
  `;

  return db.prepare(query).all();
}

function categoryExistsById(categoryId) {
  const query = `
    SELECT 1
    FROM categorias
    WHERE id_categoria = ?
  `;

  return Boolean(db.prepare(query).get(categoryId));
}

module.exports = {
  getAllCategories,
  categoryExistsById
};
