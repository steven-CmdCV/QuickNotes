const API_URL = import.meta.env.VITE_API_URL;
const normalizedApiUrl = API_URL?.replace(/\/+$/, '');

async function requestJson(path, { signal } = {}) {
  if (!normalizedApiUrl) {
    throw new Error('La URL de la API no esta configurada.');
  }

  const response = await fetch(`${normalizedApiUrl}${path}`, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
    },
    signal,
  });

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

export { getHealth, getNotes };

export default API_URL;
