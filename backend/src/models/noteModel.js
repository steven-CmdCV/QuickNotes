const db = require('../config/db');

function getNotesByUserId(userId) {
  const query = `
    SELECT
      notas.id_nota,
      notas.id_usuario,
      notas.id_categoria,
      categorias.nombre_categoria,
      notas.titulo,
      notas.contenido,
      notas.es_favorita,
      notas.fecha_creacion,
      notas.fecha_modificacion
    FROM notas
    LEFT JOIN categorias
      ON categorias.id_categoria = notas.id_categoria
    WHERE notas.id_usuario = ?
    ORDER BY
      notas.es_favorita DESC,
      notas.fecha_modificacion DESC,
      notas.id_nota DESC
  `;

  return db.prepare(query).all(userId).map((note) => ({
    ...note,
    es_favorita: Boolean(note.es_favorita)
  }));
}

function getNoteByIdAndUserId(noteId, userId) {
  const query = `
    SELECT
      notas.id_nota,
      notas.id_usuario,
      notas.id_categoria,
      categorias.nombre_categoria,
      notas.titulo,
      notas.contenido,
      notas.es_favorita,
      notas.fecha_creacion,
      notas.fecha_modificacion
    FROM notas
    LEFT JOIN categorias
      ON categorias.id_categoria = notas.id_categoria
    WHERE notas.id_nota = ?
      AND notas.id_usuario = ?
  `;

  const note = db.prepare(query).get(noteId, userId);

  if (!note) {
    return null;
  }

  return {
    ...note,
    es_favorita: Boolean(note.es_favorita)
  };
}

module.exports = {
  getNotesByUserId,
  getNoteByIdAndUserId
};
