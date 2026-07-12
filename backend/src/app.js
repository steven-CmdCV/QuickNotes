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

module.exports = app;
