const noteModel = require('../models/noteModel');
const categoryModel = require('../models/categoryModel');

// Solucion provisional hasta que la autenticacion determine el usuario actual.
const DEMO_USER_ID = 1;

function parseNoteId(idParam) {
  if (!/^[1-9]\d*$/.test(idParam)) {
    return null;
  }

  const noteId = Number(idParam);

  return Number.isSafeInteger(noteId) ? noteId : null;
}

function validateNoteBody(requestBody, options = {}) {
  const {
    requireBody = false,
    requireCategory = false,
    requireFavorite = false
  } = options;

  if (requireBody && requestBody === undefined) {
    return {
      error: 'El cuerpo de la solicitud debe ser un objeto JSON válido.'
    };
  }

  const body = requestBody === undefined ? {} : requestBody;

  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    return {
      error: 'El cuerpo de la solicitud debe ser un objeto JSON válido.'
    };
  }

  if (requireBody && Object.keys(body).length === 0) {
    return {
      error: 'El cuerpo de la solicitud debe ser un objeto JSON válido.'
    };
  }

  if (!Object.prototype.hasOwnProperty.call(body, 'titulo')) {
    return { error: 'El título es obligatorio.' };
  }

  if (typeof body.titulo !== 'string') {
    return { error: 'El título debe ser una cadena de texto.' };
  }

  const title = body.titulo.trim();

  if (!title) {
    return { error: 'El título es obligatorio.' };
  }

  if (title.length > 150) {
    return { error: 'El título no puede exceder los 150 caracteres.' };
  }

  if (!Object.prototype.hasOwnProperty.call(body, 'contenido')) {
    return { error: 'El contenido es obligatorio.' };
  }

  if (typeof body.contenido !== 'string') {
    return { error: 'El contenido debe ser una cadena de texto.' };
  }

  const content = body.contenido.trim();

  if (!content) {
    return { error: 'El contenido es obligatorio.' };
  }

  if (content.length > 10000) {
    return { error: 'El contenido no puede exceder los 10,000 caracteres.' };
  }

  const hasCategory = Object.prototype.hasOwnProperty.call(body, 'id_categoria');

  if (requireCategory && !hasCategory) {
    return { error: 'El identificador de la categoría es obligatorio.' };
  }

  const categoryId = hasCategory ? body.id_categoria : null;

  if (categoryId !== null
    && (!Number.isSafeInteger(categoryId) || categoryId <= 0)) {
    return {
      error: 'El identificador de la categoría debe ser un número entero positivo.'
    };
  }

  const hasFavorite = Object.prototype.hasOwnProperty.call(body, 'es_favorita');

  if (requireFavorite && !hasFavorite) {
    return { error: 'El campo es_favorita es obligatorio.' };
  }

  const isFavorite = hasFavorite ? body.es_favorita : false;

  if (typeof isFavorite !== 'boolean') {
    return { error: 'El campo es_favorita debe ser booleano.' };
  }

  return {
    data: {
      title,
      content,
      categoryId,
      isFavorite
    }
  };
}

function getNotes(req, res) {
  try {
    const notes = noteModel.getNotesByUserId(DEMO_USER_ID);

    return res.json({
      success: true,
      data: notes
    });
  } catch (error) {
    console.error('Error al obtener las notas:', error.message);

    return res.status(500).json({
      success: false,
      message: 'No se pudieron obtener las notas.'
    });
  }
}

function getNoteById(req, res) {
  const noteId = parseNoteId(req.params.id);

  if (noteId === null) {
    return res.status(400).json({
      success: false,
      message: 'El identificador de la nota no es válido.'
    });
  }

  try {
    const note = noteModel.getNoteByIdAndUserId(noteId, DEMO_USER_ID);

    if (!note) {
      return res.status(404).json({
        success: false,
        message: 'Nota no encontrada.'
      });
    }

    return res.json({
      success: true,
      data: note
    });
  } catch (error) {
    console.error('Error al obtener la nota:', error.message);

    return res.status(500).json({
      success: false,
      message: 'No se pudo obtener la nota.'
    });
  }
}

function createNote(req, res) {
  const validation = validateNoteBody(req.body);

  if (validation.error) {
    return res.status(400).json({
      success: false,
      message: validation.error
    });
  }

  const { title, content, categoryId, isFavorite } = validation.data;

  if (categoryId !== null && !categoryModel.categoryExistsById(categoryId)) {
    return res.status(400).json({
      success: false,
      message: 'La categoría indicada no existe.'
    });
  }

  try {
    const note = noteModel.createNote({
      userId: DEMO_USER_ID,
      categoryId,
      title,
      content,
      isFavorite
    });

    return res.status(201).json({
      success: true,
      data: note
    });
  } catch (error) {
    console.error('Error al crear la nota:', error.message);

    return res.status(500).json({
      success: false,
      message: 'No se pudo crear la nota.'
    });
  }
}

function updateNote(req, res) {
  const noteId = parseNoteId(req.params.id);

  if (noteId === null) {
    return res.status(400).json({
      success: false,
      message: 'El identificador de la nota no es válido.'
    });
  }

  const validation = validateNoteBody(req.body, {
    requireBody: true,
    requireCategory: true,
    requireFavorite: true
  });

  if (validation.error) {
    return res.status(400).json({
      success: false,
      message: validation.error
    });
  }

  const { title, content, categoryId, isFavorite } = validation.data;

  try {
    if (categoryId !== null && !categoryModel.categoryExistsById(categoryId)) {
      return res.status(400).json({
        success: false,
        message: 'La categoría indicada no existe.'
      });
    }

    const note = noteModel.updateNote({
      noteId,
      userId: DEMO_USER_ID,
      categoryId,
      title,
      content,
      isFavorite
    });

    if (!note) {
      return res.status(404).json({
        success: false,
        message: 'Nota no encontrada.'
      });
    }

    return res.json({
      success: true,
      data: note
    });
  } catch (error) {
    console.error('Error al actualizar la nota:', error.message);

    return res.status(500).json({
      success: false,
      message: 'No se pudo actualizar la nota.'
    });
  }
}

module.exports = {
  getNotes,
  getNoteById,
  createNote,
  updateNote
};
