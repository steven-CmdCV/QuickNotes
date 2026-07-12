import { useEffect, useState } from 'react';
import { getNotes } from '../services/api.js';

function toDateTime(value) {
  return typeof value === 'string' ? value.replace(' ', 'T') : undefined;
}

function NotesList({ refreshKey }) {
  const [requestState, setRequestState] = useState({
    status: 'loading',
    notes: [],
  });

  useEffect(() => {
    const controller = new AbortController();

    async function loadNotes() {
      try {
        const notes = await getNotes({ signal: controller.signal });

        if (!controller.signal.aborted) {
          setRequestState({ status: 'success', notes });
        }
      } catch (error) {
        if (error.name === 'AbortError' || controller.signal.aborted) {
          return;
        }

        setRequestState({ status: 'error', notes: [] });
      }
    }

    loadNotes();

    return () => {
      controller.abort();
    };
  }, [refreshKey]);

  let content;

  if (requestState.status === 'loading') {
    content = (
      <p className="notes-message" role="status">
        Cargando notas...
      </p>
    );
  } else if (requestState.status === 'error') {
    content = (
      <p className="notes-message notes-message--error" role="alert">
        No se pudieron cargar las notas.
      </p>
    );
  } else if (requestState.notes.length === 0) {
    content = <p className="notes-message">No hay notas disponibles.</p>;
  } else {
    content = (
      <ul className="notes-grid">
        {requestState.notes.map((note) => (
          <li key={note.id_nota}>
            <article className="note-card">
              <div className="note-meta">
                <p className="note-category">
                  {note.nombre_categoria ?? 'Sin categoría'}
                </p>
                {note.es_favorita === true && (
                  <span className="note-favorite">Favorita</span>
                )}
              </div>
              <h3>{note.titulo}</h3>
              <p className="note-content">{note.contenido}</p>
              <p className="note-date">
                Actualizada:{' '}
                <time dateTime={toDateTime(note.fecha_modificacion)}>
                  {note.fecha_modificacion}
                </time>
              </p>
            </article>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <section className="notes-section" aria-labelledby="notes-title">
      <h2 id="notes-title">Tus notas</h2>
      {content}
    </section>
  );
}

export default NotesList;
