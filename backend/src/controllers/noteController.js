const noteModel = require('../models/noteModel');

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

module.exports = {
  getNotes,
  getNoteById
};
