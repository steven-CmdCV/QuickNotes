const API_URL = import.meta.env.VITE_API_URL;
const normalizedApiUrl = API_URL?.replace(/\/+$/, '');
let authToken = null;
let authGeneration = 0;
let invalidatedGeneration = null;
let unauthorizedHandler = null;

class ApiError extends Error {
  constructor(status) {
    super('La respuesta del servidor no fue exitosa.');
    this.name = 'ApiError';
    this.status = status;
  }
}

function isValidPublicUser(user) {
  return user
    && typeof user === 'object'
    && !Array.isArray(user)
    && Number.isSafeInteger(user.id_usuario)
    && user.id_usuario > 0
    && typeof user.nombre === 'string'
    && user.nombre.trim() !== ''
    && typeof user.correo === 'string'
    && user.correo.trim() !== '';
}

async function requestJson(
  path,
  {
    body,
    method = 'GET',
    notifyUnauthorized = true,
    signal,
    skipAuth = false,
  } = {},
) {
  if (!normalizedApiUrl) {
    throw new Error('La URL de la API no esta configurada.');
  }

  const headers = {
    Accept: 'application/json',
  };
  const options = {
    method,
    headers,
    signal,
  };
  const requestToken = skipAuth ? null : authToken;
  const requestGeneration = authGeneration;

  if (requestToken) {
    headers.Authorization = `Bearer ${requestToken}`;
  }

  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(body);
  }

  const response = await fetch(`${normalizedApiUrl}${path}`, options);

  if (!response.ok) {
    if (
      response.status === 401
      && notifyUnauthorized
      && requestToken
      && requestToken === authToken
      && requestGeneration === authGeneration
      && invalidatedGeneration !== requestGeneration
      && typeof unauthorizedHandler === 'function'
    ) {
      invalidatedGeneration = requestGeneration;
      unauthorizedHandler();
    }

    throw new ApiError(response.status);
  }

  return response.json();
}

function setAuthToken(token) {
  if (typeof token !== 'string' || token.trim() === '') {
    throw new Error('El token de autenticación no es válido.');
  }

  authToken = token.trim();
  authGeneration += 1;
  invalidatedGeneration = null;
}

function clearAuthToken() {
  authToken = null;
  authGeneration += 1;
  invalidatedGeneration = null;
}

function setUnauthorizedHandler(handler) {
  if (typeof handler !== 'function') {
    throw new Error('El manejador de sesión no es válido.');
  }

  unauthorizedHandler = handler;
}

function clearUnauthorizedHandler(handler) {
  if (unauthorizedHandler === handler) {
    unauthorizedHandler = null;
  }
}

function isUnauthorizedError(error) {
  return error instanceof ApiError && error.status === 401;
}

async function login(credentials, { signal } = {}) {
  if (
    !credentials
    || typeof credentials !== 'object'
    || Array.isArray(credentials)
    || typeof credentials.correo !== 'string'
    || typeof credentials.password !== 'string'
  ) {
    throw new Error('Las credenciales no son válidas.');
  }

  const email = credentials.correo.trim().toLowerCase();

  if (!email || credentials.password.length === 0) {
    throw new Error('Las credenciales no son válidas.');
  }

  const data = await requestJson('/api/auth/login', {
    body: {
      correo: email,
      password: credentials.password,
    },
    method: 'POST',
    signal,
    skipAuth: true,
    notifyUnauthorized: false,
  });

  if (
    !data
    || data.success !== true
    || !data.data
    || typeof data.data !== 'object'
    || Array.isArray(data.data)
    || typeof data.data.token !== 'string'
    || data.data.token.trim() === ''
    || !isValidPublicUser(data.data.user)
  ) {
    throw new Error('La respuesta de autenticación no es válida.');
  }

  return {
    token: data.data.token.trim(),
    user: data.data.user,
  };
}

async function getCurrentUser({ signal } = {}) {
  const data = await requestJson('/api/auth/me', {
    notifyUnauthorized: false,
    signal,
  });

  if (
    !data
    || data.success !== true
    || !data.data
    || typeof data.data !== 'object'
    || Array.isArray(data.data)
    || !isValidPublicUser(data.data.user)
  ) {
    throw new Error('La respuesta de sesión no es válida.');
  }

  return data.data.user;
}

async function getHealth({ signal } = {}) {
  const data = await requestJson('/api/health', {
    notifyUnauthorized: false,
    signal,
  });

  if (!data || data.status !== 'ok') {
    throw new Error('La respuesta del servidor no es valida.');
  }

  return data;
}

async function getNotes({ signal } = {}) {
  const data = await requestJson('/api/notes', { signal });

  if (!data || data.success !== true || !Array.isArray(data.data)) {
    throw new Error('La respuesta de notas no es valida.');
  }

  return data.data;
}

async function getCategories({ signal } = {}) {
  const data = await requestJson('/api/categories', {
    notifyUnauthorized: false,
    signal,
  });

  if (!data || data.success !== true || !Array.isArray(data.data)) {
    throw new Error('La respuesta de categorías no es válida.');
  }

  return data.data;
}

async function createNote(noteData, { signal } = {}) {
  const data = await requestJson('/api/notes', {
    body: noteData,
    method: 'POST',
    signal,
  });

  if (
    !data
    || data.success !== true
    || typeof data.data !== 'object'
    || data.data === null
    || Array.isArray(data.data)
  ) {
    throw new Error('La respuesta de creación no es válida.');
  }

  return data.data;
}

async function updateNote(noteId, noteData, { signal } = {}) {
  if (!Number.isSafeInteger(noteId) || noteId <= 0) {
    throw new Error('El identificador de la nota no es válido.');
  }

  if (!noteData || typeof noteData !== 'object' || Array.isArray(noteData)) {
    throw new Error('Los datos de la nota no son válidos.');
  }

  const title = typeof noteData.titulo === 'string'
    ? noteData.titulo.trim()
    : '';
  const content = typeof noteData.contenido === 'string'
    ? noteData.contenido.trim()
    : '';
  const categoryId = noteData.id_categoria;
  const isFavorite = noteData.es_favorita;

  if (!title || title.length > 150) {
    throw new Error('El título de la nota no es válido.');
  }

  if (!content || content.length > 10000) {
    throw new Error('El contenido de la nota no es válido.');
  }

  if (
    categoryId !== null
    && (!Number.isSafeInteger(categoryId) || categoryId <= 0)
  ) {
    throw new Error('La categoría de la nota no es válida.');
  }

  if (typeof isFavorite !== 'boolean') {
    throw new Error('El estado de favorita no es válido.');
  }

  const data = await requestJson(`/api/notes/${noteId}`, {
    body: {
      titulo: title,
      contenido: content,
      id_categoria: categoryId,
      es_favorita: isFavorite,
    },
    method: 'PUT',
    signal,
  });

  if (
    !data
    || data.success !== true
    || typeof data.data !== 'object'
    || data.data === null
    || Array.isArray(data.data)
    || !Number.isSafeInteger(data.data.id_nota)
    || data.data.id_nota !== noteId
  ) {
    throw new Error('La respuesta de actualización no es válida.');
  }

  return data.data;
}

async function deleteNote(noteId, { signal } = {}) {
  if (!Number.isSafeInteger(noteId) || noteId <= 0) {
    throw new Error('El identificador de la nota no es válido.');
  }

  const data = await requestJson(`/api/notes/${noteId}`, {
    method: 'DELETE',
    signal,
  });

  if (
    !data
    || data.success !== true
    || typeof data.data !== 'object'
    || data.data === null
    || Array.isArray(data.data)
    || !Number.isSafeInteger(data.data.id_nota)
    || data.data.id_nota <= 0
    || data.data.id_nota !== noteId
  ) {
    throw new Error('La respuesta de eliminación no es válida.');
  }

  return data.data.id_nota;
}

export {
  clearAuthToken,
  clearUnauthorizedHandler,
  createNote,
  deleteNote,
  getCategories,
  getCurrentUser,
  getHealth,
  getNotes,
  isUnauthorizedError,
  login,
  setAuthToken,
  setUnauthorizedHandler,
  updateNote,
};

export default API_URL;
