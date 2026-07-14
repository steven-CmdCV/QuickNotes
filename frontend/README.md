# Frontend de QuickNotes

Interfaz web de QuickNotes desarrollada con React, Vite, JavaScript y CSS. Se
comunica con el backend mediante su API HTTP y no accede directamente a SQLite.

## Instalación

Desde la raíz del repositorio:

```bash
npm install --prefix frontend
```

## Variable de entorno

Crea la configuración local desde la plantilla:

```bash
cp frontend/.env.example frontend/.env
```

```env
VITE_API_URL=http://localhost:3000
```

`VITE_API_URL` es la URL base del backend. El archivo `.env` es local y está
ignorado por Git.

## Scripts

```bash
npm run dev --prefix frontend
npm run lint --prefix frontend
npm run build --prefix frontend
npm run preview --prefix frontend
```

- `dev` inicia Vite en `http://localhost:5173`.
- `lint` valida los archivos JavaScript y JSX con ESLint.
- `build` genera la versión optimizada en `frontend/dist/`.
- `preview` sirve localmente el build generado para su revisión.

El backend debe estar disponible, de forma predeterminada, en
`http://localhost:3000`.

## Estructura

```text
frontend/src/
├── components/       # Login, registro, perfil, notas y filtros
├── services/api.js   # Cliente fetch, token y manejo global de 401
├── App.jsx           # Sesión, navegación de estados e integración
├── App.css           # Estilos de componentes y diseño responsive
├── index.css         # Variables y estilos globales
└── main.jsx          # Entrada de React
```

## Flujo de sesión

El usuario puede registrarse o iniciar sesión. Después de autenticar, el JWT se
mantiene en memoria para las solicitudes y en `sessionStorage` para restaurar la
sesión al recargar la página.

Al iniciar, `App.jsx` consulta `/api/auth/me`. Las respuestas `401` de las
operaciones autenticadas invalidan una sola vez la generación activa de sesión,
limpian el token y devuelven al login con un aviso. El logout manual limpia la
sesión sin llamar a un endpoint adicional.

## Funcionalidades

- Registro y login con validaciones locales básicas.
- Restauración, expiración y cierre de sesión.
- Panel de perfil para editar nombre y correo.
- Eliminación de cuenta con contraseña y confirmación en dos pasos.
- Creación, listado, edición y eliminación de notas.
- Categorías opcionales y notas favoritas.
- Búsqueda por título y contenido.
- Filtros locales por categoría y favoritas.
- Mensajes de carga, éxito, error y resultados vacíos.

El frontend conserva el orden autoritativo recibido del backend. Después de
crear o editar vuelve a consultar las notas; después de eliminar actualiza la
lista solo tras la confirmación de la API.

## Cliente de API

`src/services/api.js` centraliza:

- La URL `VITE_API_URL`.
- El encabezado Bearer para operaciones protegidas.
- La serialización y validación mínima de JSON.
- El manejo global y generacional de respuestas `401`.
- Las funciones de autenticación, perfil, categorías y notas.

Los formularios utilizan `AbortController` al desmontarse y referencias
síncronas para evitar dobles envíos. Cancelar `fetch` evita actualizaciones de
interfaz posteriores, pero no se interpreta como garantía de que una operación
ya enviada no haya sido procesada por el servidor.

## Relación con el backend

Durante desarrollo, inicia primero el backend y después el frontend:

```bash
npm run dev --prefix backend
npm run dev --prefix frontend
```

La autenticación, autorización, validación definitiva y persistencia pertenecen
al backend. El frontend no debe tratar sus validaciones locales como sustituto
de las reglas de la API.
