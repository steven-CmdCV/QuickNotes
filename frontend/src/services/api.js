const API_URL = import.meta.env.VITE_API_URL;
const normalizedApiUrl = API_URL?.replace(/\/+$/, '');

async function requestJson(path, { body, method = 'GET', signal } = {}) {
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

  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(body);
  }

  const response = await fetch(`${normalizedApiUrl}${path}`, options);

  if (!response.ok) {
    throw new Error('La respuesta del servidor no fue exitosa.');
  }

  return response.json();
}

async function getHealth({ signal } = {}) {
  const data = await requestJson('/api/health', { signal });

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
  const data = await requestJson('/api/categories', { signal });

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

export { createNote, deleteNote, getCategories, getHealth, getNotes };

export default API_URL;
