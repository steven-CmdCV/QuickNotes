# QuickNotes

QuickNotes es una aplicación web académica para organizar notas personales de
forma rápida. El proyecto permite administrar cuentas y notas desde una
interfaz responsive conectada a una API con persistencia en SQLite.

El proyecto está pensado para aprendizaje y demostración. No está preparado
para producción ni para uso comercial.

## Funcionalidades

- Registro, inicio de sesión, restauración de sesión y logout.
- Manejo global de sesiones expiradas.
- Consulta y edición del nombre y correo del usuario autenticado.
- Eliminación de cuenta mediante contraseña y confirmación en dos pasos.
- Eliminación en cascada de las notas al eliminar una cuenta.
- Creación, consulta, edición y eliminación de notas.
- Categorías de solo lectura y notas favoritas.
- Búsqueda local por título y contenido.
- Filtros por categoría y favoritas.
- Aislamiento de notas entre usuarios.
- Estados de carga, error, éxito y listas vacías.
- Interfaz responsive con controles básicos de accesibilidad.

## Tecnologías

### Backend

- Node.js y Express.
- SQLite mediante `better-sqlite3`.
- JWT con `jsonwebtoken`.
- Contraseñas protegidas con `bcryptjs`.
- Pruebas de integración con `node:test` y Supertest.

### Frontend

- React.
- Vite.
- JavaScript.
- CSS.

## Estructura

```text
QuickNotes/
├── backend/
│   ├── database/       # Esquema, seed e inicialización de SQLite
│   ├── src/            # API, autenticación y acceso a datos
│   └── test/           # Pruebas de integración y base temporal
├── frontend/
│   └── src/
│       ├── components/ # Formularios, notas, filtros y perfil
│       └── services/   # Cliente de la API
└── README.md
```

Consulta también [backend/README.md](backend/README.md),
[frontend/README.md](frontend/README.md) y
[backend/database/README.md](backend/database/README.md).

## Requisitos

- Node.js y npm. El proyecto fue verificado con Node.js `24.15.0`; utiliza una
  versión moderna y compatible con las dependencias instaladas.
- Un navegador moderno.
- SQLite CLI es opcional para inspección o inicialización manual. Los scripts
  del proyecto utilizan `better-sqlite3` directamente.

## Instalación

Desde la raíz del repositorio:

```bash
npm install --prefix backend
npm install --prefix frontend
```

No existe un `package.json` en la raíz, por lo que cada aplicación administra
sus dependencias por separado.

## Variables de entorno

Crea los archivos locales a partir de las plantillas versionadas:

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

Configuración del backend:

```env
PORT=3000
DB_PATH=./database/data/quick_notes.db
JWT_SECRET=valor-local
```

Configuración del frontend:

```env
VITE_API_URL=http://localhost:3000
```

Usa un valor local suficientemente largo para `JWT_SECRET`. Los archivos
`.env` son locales, están ignorados por Git y no deben contenerse en commits.

## Base de datos

La base principal se encuentra en:

```text
backend/database/data/quick_notes.db
```

`backend/database/schema.sql` define las tablas y relaciones, mientras que
`backend/database/seed.sql` agrega las categorías, el usuario demo y dos notas
iniciales de forma idempotente.

Para inicializar o verificar la base principal:

```bash
npm run init-db --prefix backend
```

El script `init-db` siempre utiliza
`backend/database/data/quick_notes.db`; no lee `DB_PATH`. La variable `DB_PATH`
sí permite cambiar la base utilizada por la aplicación y es establecida por la
suite para trabajar con bases temporales aisladas. No es necesario borrar la
base principal para ejecutar la aplicación o las pruebas.

### Usuario demo

Estas credenciales forman parte intencional del seed académico:

```text
Correo: demo@quicknotes.local
Contraseña: QuickNotesDemo2026!
```

No deben reutilizarse fuera de este entorno de demostración.

## Ejecución

Con los archivos `.env` locales configurados, inicia cada aplicación en una
terminal diferente:

```bash
npm run dev --prefix backend
npm run dev --prefix frontend
```

```text
Backend:  http://localhost:3000
Frontend: http://localhost:5173
```

## Endpoints

Las rutas protegidas requieren:

```http
Authorization: Bearer <token>
```

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

## Pruebas y calidad

```bash
npm test --prefix backend
npm run lint --prefix frontend
npm run build --prefix frontend
```

La suite actual contiene 65 pruebas de integración y crea una base SQLite
temporal para cada ejecución.

## Seguridad académica

El backend utiliza hash bcrypt, JWT, consultas parametrizadas, correo único y
normalizado, aislamiento por usuario y verificación de que el usuario del token
continúa existiendo. SQLite mantiene las claves foráneas activas y elimina las
notas en cascada al borrar una cuenta.

Estas medidas corresponden al alcance académico del proyecto y no constituyen
una declaración de preparación para producción.

## Fuera de alcance

QuickNotes no incluye recuperación de contraseña, verificación por correo,
refresh tokens, roles administrativos ni despliegue productivo.
