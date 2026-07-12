# Quick Notes

Quick Notes es una aplicacion web academica sencilla para gestionar notas rapidas.

## Stack tecnologico

- Frontend: React + JavaScript con Vite
- Backend: Node.js + Express
- Base de datos: SQLite

## Estructura del proyecto

```text
backend/
  src/
    config/
    controllers/
    models/
    routes/
    middlewares/
    app.js
    server.js
  database/
    schema.sql
    seed.sql
    init_db.js
    data/
frontend/
  src/
    components/
    pages/
    services/
    App.jsx
    main.jsx
```

## Backend

Instalar dependencias:

```bash
npm install --prefix backend
```

Inicializar la base de datos SQLite:

```bash
npm run init-db --prefix backend
```

Iniciar el backend:

```bash
npm run dev --prefix backend
```

La ruta de prueba queda disponible en:

```text
GET http://localhost:3000/api/health
```

## Frontend

Instalar dependencias:

```bash
npm install --prefix frontend
```

Iniciar el frontend:

```bash
npm run dev --prefix frontend
```

## Base de datos

La base de datos local se crea en:

```text
backend/database/data/quick_notes.db
```

Este archivo no se sube al repositorio. Para mas detalles, revisa `backend/database/README.md`.
