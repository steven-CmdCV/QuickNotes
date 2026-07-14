# Backend de QuickNotes

API HTTP de QuickNotes construida con Node.js, Express y SQLite. Gestiona
autenticación, perfiles, categorías y notas, y sirve como fuente autoritativa
para el frontend.

## Estructura

```text
backend/
├── database/          # Schema, seed, inicializador y datos locales
├── src/
│   ├── config/        # Conexión SQLite
│   ├── controllers/   # Validación y respuestas HTTP
│   ├── middlewares/   # JWT, rutas inexistentes y errores
│   ├── models/        # Consultas parametrizadas y transacciones
│   ├── routes/        # Definición de endpoints Express
│   └── services/      # Creación y verificación de JWT
└── test/              # Suite de integración y ayudante de base temporal
```

Las rutas delegan el flujo HTTP a controladores; los controladores validan los
datos y llaman a los modelos; los modelos concentran el acceso a SQLite.

## Instalación

Desde la raíz del repositorio:

```bash
npm install --prefix backend
```

## Variables de entorno

Crea la configuración local:

```bash
cp backend/.env.example backend/.env
```

```env
PORT=3000
DB_PATH=./database/data/quick_notes.db
JWT_SECRET=valor-local
```

- `PORT`: puerto HTTP; usa `3000` cuando no se define.
- `DB_PATH`: ruta absoluta o relativa a `backend/` para la conexión de la API.
- `JWT_SECRET`: secreto local requerido para firmar y verificar tokens.

El archivo `.env` está ignorado por Git. No publiques secretos ni tokens.

## Scripts

Desde la raíz:

```bash
npm run start --prefix backend
npm run dev --prefix backend
npm run dev:watch --prefix backend
npm run init-db --prefix backend
npm test --prefix backend
```

- `start` y `dev` ejecutan `src/server.js`.
- `dev:watch` reinicia el servidor con nodemon al cambiar archivos de `src/`.
- `init-db` inicializa la base principal.
- `test` ejecuta las pruebas secuencialmente con `node:test`.

## Base de datos

La conexión activa siempre:

```sql
PRAGMA foreign_keys = ON;
```

La base predeterminada es
`backend/database/data/quick_notes.db`. La variable `DB_PATH` cambia la base
abierta por la aplicación, pero el script `init-db` no consulta esa variable:
siempre inicializa la base principal en `backend/database/data/quick_notes.db`.

Las pruebas crean una carpeta temporal del sistema, aplican `schema.sql` y
`seed.sql`, establecen `DB_PATH` antes de importar la aplicación y eliminan la
carpeta después de cerrar la conexión. De esta forma no utilizan la base
principal.

La relación `notas.id_usuario` usa `ON DELETE CASCADE`, por lo que una única
eliminación de usuario elimina atómicamente sus notas. Las categorías son
compartidas y no se eliminan con la cuenta.

Consulta [database/README.md](database/README.md) para los detalles del schema y
el seed.

## Autenticación

El registro y el login emiten JWT Bearer firmados con `JWT_SECRET`. Las rutas
protegidas verifican la firma, la expiración, el identificador de `sub` y que el
usuario todavía exista. La identidad usada por notas y perfil procede del token
verificado, no del cuerpo de la solicitud.

Las contraseñas se almacenan como hashes bcrypt. La API nunca devuelve
`password_hash`.

## Endpoints

| Método | Ruta | Acceso |
|---|---|---|
| `GET` | `/api/health` | Público |
| `POST` | `/api/auth/register` | Público |
| `POST` | `/api/auth/login` | Público |
| `GET` | `/api/auth/me` | Bearer |
| `PUT` | `/api/users/me` | Bearer |
| `DELETE` | `/api/users/me` | Bearer |
| `GET` | `/api/categories` | Público |
| `GET` | `/api/notes` | Bearer |
| `GET` | `/api/notes/:id` | Bearer |
| `POST` | `/api/notes` | Bearer |
| `PUT` | `/api/notes/:id` | Bearer |
| `DELETE` | `/api/notes/:id` | Bearer |

Las rutas protegidas esperan:

```http
Authorization: Bearer <token>
```

## Errores

La aplicación diferencia validaciones, autenticación, permisos, recursos no
encontrados y conflictos de correo. El middleware final responde de forma
genérica ante errores internos y no expone stack traces, consultas ni detalles
de SQLite. Existe además un manejador específico para JSON malformado y un
middleware para rutas inexistentes.

## Pruebas

```bash
npm test --prefix backend
```

La suite actual contiene 65 pruebas de integración con Supertest. Cubre health,
autenticación, usuarios, categorías, CRUD de notas, aislamiento, validaciones,
errores y cascadas de claves foráneas.
