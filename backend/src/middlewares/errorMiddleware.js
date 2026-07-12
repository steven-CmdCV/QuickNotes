function jsonParseErrorMiddleware(error, req, res, next) {
  const isJsonParseError = error.type === 'entity.parse.failed'
    && error.status === 400
    && Object.prototype.hasOwnProperty.call(error, 'body');

  if (isJsonParseError) {
    return res.status(400).json({
      success: false,
      message: 'El cuerpo de la solicitud no contiene JSON válido.'
    });
  }

  return next(error);
}

function errorMiddleware(error, req, res, next) {
  console.error('Error interno no gestionado:', error);

  if (res.headersSent) {
    return next(error);
  }

  return res.status(500).json({
    success: false,
    message: 'Ocurrió un error interno en el servidor.'
  });
}

module.exports = {
  jsonParseErrorMiddleware,
  errorMiddleware
};
