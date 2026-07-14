# Base de datos de QuickNotes

Esta carpeta contiene la definición, los datos académicos iniciales y el script
de inicialización de la base SQLite de QuickNotes.

## Archivos

- `schema.sql`: crea las tablas, restricciones y relaciones.
- `seed.sql`: inserta categorías, el usuario demo y dos notas de ejemplo.
- `init_db.js`: aplica schema y seed sobre la base principal.
- `data/.gitkeep`: conserva en Git la carpeta destinada a la base local.

La base principal se crea en:

```text
backend/database/data/quick_notes.db
```

Los archivos de datos SQLite son locales y están ignorados por Git.

## Tablas y relaciones

### `usuarios`

Almacena el nombre, correo normalizado, hash de contraseña y fecha de registro.
El correo tiene una restricción `UNIQUE`.

### `categorias`

Contiene las categorías compartidas disponibles para clasificar notas. Las
categorías son de solo lectura desde la API actual.

### `notas`

Cada nota pertenece obligatoriamente a un usuario y puede pertenecer a una
categoría. Incluye título, contenido, estado de favorita y fechas de creación y
modificación.

Las relaciones principales son:

- `notas.id_usuario` → `usuarios.id_usuario` con `ON DELETE CASCADE`.
- `notas.id_categoria` → `categorias.id_categoria` con `ON DELETE SET NULL`.

SQLite requiere claves foráneas habilitadas en cada conexión. Tanto la
aplicación como el inicializador y las pruebas ejecutan:

```sql
PRAGMA foreign_keys = ON;
```

Al eliminar una cuenta, SQLite elimina sus notas en cascada. Eliminar una
categoría dejaría las notas relacionadas sin categoría.

## Seed idempotente

El seed puede ejecutarse varias veces sin duplicar los datos iniciales:

- Las categorías y el usuario demo utilizan inserciones tolerantes a registros
  existentes.
- Cada nota demo se inserta mediante `WHERE NOT EXISTS` comparando usuario,
  categoría, título, contenido y estado de favorita.
- El archivo ejecuta sus operaciones dentro de una transacción.

## Inicialización

Desde la raíz del repositorio:

```bash
npm run init-db --prefix backend
```

Desde `backend/`:

```bash
npm run init-db
```

`init_db.js` siempre inicializa
`backend/database/data/quick_notes.db`. No utiliza `DB_PATH`, por lo que no debe
ejecutarse esperando que esa variable redirija la inicialización.

No es necesario ni recomendable borrar la base principal antes de ejecutar el
script: schema y seed están preparados para verificar o completar los datos
esperados.

## Credenciales académicas

El seed incluye intencionalmente un usuario de demostración:

```text
Correo: demo@quicknotes.local
Contraseña: QuickNotesDemo2026!
```

La base almacena únicamente el hash bcrypt. Estas credenciales son exclusivas
del entorno académico y no deben reutilizarse.

## Bases temporales y `DB_PATH`

La conexión de la aplicación acepta `DB_PATH` para abrir una base diferente a
la principal. La suite de integración crea una base temporal fuera del
repositorio, aplica `schema.sql` y `seed.sql`, establece `DB_PATH` antes de
importar la aplicación y elimina la carpeta temporal al terminar.

Las pruebas destructivas o validaciones manuales deben utilizar una base
temporal. No deben ejecutarse contra
`backend/database/data/quick_notes.db`.
