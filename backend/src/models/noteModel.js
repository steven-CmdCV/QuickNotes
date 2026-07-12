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

function createNote({ userId, categoryId, title, content, isFavorite }) {
  const createNoteTransaction = db.transaction(() => {
    const query = `
      INSERT INTO notas (
        id_usuario,
        id_categoria,
        titulo,
        contenido,
        es_favorita
      )
      VALUES (?, ?, ?, ?, ?)
    `;

    const result = db.prepare(query).run(
      userId,
      categoryId,
      title,
      content,
      isFavorite ? 1 : 0
    );
    const createdNote = getNoteByIdAndUserId(
      Number(result.lastInsertRowid),
      userId
    );

    if (!createdNote) {
      throw new Error('No se pudo recuperar la nota creada.');
    }

    return createdNote;
  });

  return createNoteTransaction();
}

function updateNote({ noteId, userId, categoryId, title, content, isFavorite }) {
  const updateNoteTransaction = db.transaction(() => {
    const existingNote = getNoteByIdAndUserId(noteId, userId);

    if (!existingNote) {
      return null;
    }

    const query = `
      UPDATE notas
      SET
        id_categoria = ?,
        titulo = ?,
        contenido = ?,
        es_favorita = ?,
        fecha_modificacion = CURRENT_TIMESTAMP
      WHERE id_nota = ?
        AND id_usuario = ?
    `;

    const result = db.prepare(query).run(
      categoryId,
      title,
      content,
      isFavorite ? 1 : 0,
      noteId,
      userId
    );

    if (result.changes !== 1) {
      throw new Error('La actualización no afectó exactamente una nota.');
    }

    const updatedNote = getNoteByIdAndUserId(noteId, userId);

    if (!updatedNote) {
      throw new Error('No se pudo recuperar la nota actualizada.');
    }

    return updatedNote;
  });

  return updateNoteTransaction();
}

module.exports = {
  getNotesByUserId,
  getNoteByIdAndUserId,
  createNote,
  updateNote
};
