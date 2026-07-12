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

module.exports = {
  getNotes
};
