const express = require('express');
const cors = require('cors');
const categoryRoutes = require('./routes/categoryRoutes');
const noteRoutes = require('./routes/noteRoutes');

const app = express();

app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'El backend de Quick Notes esta funcionando'
  });
});

app.use('/api/categories', categoryRoutes);
app.use('/api/notes', noteRoutes);

app.use((error, req, res, next) => {
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
});

module.exports = app;
