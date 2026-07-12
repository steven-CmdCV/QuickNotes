# Base de datos

Esta carpeta contiene los archivos necesarios para crear la base de datos local de Quick Notes.

## Archivos

- `schema.sql`: crea las tablas `usuarios`, `categorias` y `notas`.
- `seed.sql`: agrega categorias iniciales, un usuario demo y notas de ejemplo.
- `init_db.js`: ejecuta el esquema y los datos iniciales sobre SQLite.
- `data/`: carpeta donde se genera el archivo local `quick_notes.db`.

## Creacion de la base de datos

La base de datos se crea en:

```text
backend/database/data/quick_notes.db
```

El archivo `.db` no se sube al repositorio porque contiene datos locales.

## Tablas

- `usuarios`: guarda usuarios basicos de la aplicacion.
- `categorias`: guarda categorias para clasificar notas.
- `notas`: guarda notas asociadas a un usuario y, opcionalmente, a una categoria.

Las claves foraneas de SQLite se activan con:

```sql
PRAGMA foreign_keys = ON;
```

## Ejecutar inicializacion

Desde la raiz del proyecto:

```bash
npm run init-db --prefix backend
```

Tambien se puede ejecutar desde la carpeta `backend`:

```bash
npm run init-db
```
