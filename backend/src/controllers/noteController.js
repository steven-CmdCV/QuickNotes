const noteModel = require('../models/noteModel');
const categoryModel = require('../models/categoryModel');

// Solucion provisional hasta que la autenticacion determine el usuario actual.
const DEMO_USER_ID = 1;

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
  const idParam = req.params.id;

  if (!/^[1-9]\d*$/.test(idParam)) {
    return res.status(400).json({
      success: false,
      message: 'El identificador de la nota no es válido.'
    });
  }

  const noteId = Number(idParam);

  if (!Number.isSafeInteger(noteId)) {
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
  const body = req.body === undefined ? {} : req.body;

  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    return res.status(400).json({
      success: false,
      message: 'El cuerpo de la solicitud debe ser un objeto JSON válido.'
    });
  }

  if (!Object.prototype.hasOwnProperty.call(body, 'titulo')) {
    return res.status(400).json({
      success: false,
      message: 'El título es obligatorio.'
    });
  }

  if (typeof body.titulo !== 'string') {
    return res.status(400).json({
      success: false,
      message: 'El título debe ser una cadena de texto.'
    });
  }

  const title = body.titulo.trim();

  if (!title) {
    return res.status(400).json({
      success: false,
      message: 'El título es obligatorio.'
    });
  }

  if (title.length > 150) {
    return res.status(400).json({
      success: false,
      message: 'El título no puede exceder los 150 caracteres.'
    });
  }

  if (!Object.prototype.hasOwnProperty.call(body, 'contenido')) {
    return res.status(400).json({
      success: false,
      message: 'El contenido es obligatorio.'
    });
  }

  if (typeof body.contenido !== 'string') {
    return res.status(400).json({
      success: false,
      message: 'El contenido debe ser una cadena de texto.'
    });
  }

  const content = body.contenido.trim();

  if (!content) {
    return res.status(400).json({
      success: false,
      message: 'El contenido es obligatorio.'
    });
  }

  if (content.length > 10000) {
    return res.status(400).json({
      success: false,
      message: 'El contenido no puede exceder los 10,000 caracteres.'
    });
  }

  const categoryId = Object.prototype.hasOwnProperty.call(body, 'id_categoria')
    ? body.id_categoria
    : null;

  if (categoryId !== null
    && (!Number.isSafeInteger(categoryId) || categoryId <= 0)) {
    return res.status(400).json({
      success: false,
      message: 'El identificador de la categoría debe ser un número entero positivo.'
    });
  }

  if (categoryId !== null && !categoryModel.categoryExistsById(categoryId)) {
    return res.status(400).json({
      success: false,
      message: 'La categoría indicada no existe.'
    });
  }

  const isFavorite = Object.prototype.hasOwnProperty.call(body, 'es_favorita')
    ? body.es_favorita
    : false;

  if (typeof isFavorite !== 'boolean') {
    return res.status(400).json({
      success: false,
      message: 'El campo es_favorita debe ser booleano.'
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

module.exports = {
  getNotes,
  getNoteById,
  createNote
};
