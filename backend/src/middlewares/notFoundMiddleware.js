function notFoundMiddleware(req, res) {
  return res.status(404).json({
    success: false,
    message: 'Ruta no encontrada.'
  });
}

module.exports = notFoundMiddleware;
