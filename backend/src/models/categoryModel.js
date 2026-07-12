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

module.exports = {
  getAllCategories
};
