const categoryModel = require('../models/categoryModel');

function getCategories(req, res) {
  try {
    const categories = categoryModel.getAllCategories();

    return res.json({
      success: true,
      data: categories
    });
  } catch (error) {
    console.error('Error al obtener las categorías:', error.message);

    return res.status(500).json({
      success: false,
      message: 'No se pudieron obtener las categorías.'
    });
  }
}

module.exports = {
  getCategories
};
