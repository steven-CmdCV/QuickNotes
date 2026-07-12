import { useEffect, useRef, useState } from 'react';
import { deleteNote, getNotes } from '../services/api.js';

function toDateTime(value) {
  return typeof value === 'string' ? value.replace(' ', 'T') : undefined;
}

function NotesList({ refreshKey }) {
  const [requestState, setRequestState] = useState({
    status: 'loading',
    notes: [],
  });
  const [deletingNoteId, setDeletingNoteId] = useState(null);
  const [deletionMessage, setDeletionMessage] = useState(null);
  const deletionInProgressRef = useRef(false);
  const deleteControllerRef = useRef(null);

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

  useEffect(() => () => {
    deleteControllerRef.current?.abort();
  }, []);

  async function handleDelete(note) {
    if (deletionInProgressRef.current) {
      return;
    }

    const confirmed = window.confirm(
      `¿Eliminar la nota "${note.titulo}"? Esta acción no se puede deshacer.`,
    );

    if (!confirmed) {
      return;
    }

    deletionInProgressRef.current = true;
    setDeletingNoteId(note.id_nota);
    setDeletionMessage(null);

    const controller = new AbortController();
    deleteControllerRef.current = controller;

    try {
      const deletedNoteId = await deleteNote(note.id_nota, {
        signal: controller.signal,
      });

      if (!controller.signal.aborted) {
        setRequestState((currentState) => ({
          ...currentState,
          notes: currentState.notes.filter(
            (currentNote) => currentNote.id_nota !== deletedNoteId,
          ),
        }));
        setDeletionMessage({
          type: 'success',
          text: 'Nota eliminada correctamente.',
        });
      }
    } catch (error) {
      if (error.name === 'AbortError' || controller.signal.aborted) {
        return;
      }

      setDeletionMessage({
        type: 'error',
        text: 'No se pudo eliminar la nota.',
      });
    } finally {
      if (deleteControllerRef.current === controller) {
        deleteControllerRef.current = null;
      }

      deletionInProgressRef.current = false;

      if (!controller.signal.aborted) {
        setDeletingNoteId(null);
      }
    }
  }

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
              <div className="note-footer">
                <p className="note-date">
                  Actualizada:{' '}
                  <time dateTime={toDateTime(note.fecha_modificacion)}>
                    {note.fecha_modificacion}
                  </time>
                </p>
                <button
                  className="delete-button"
                  type="button"
                  disabled={deletingNoteId !== null}
                  aria-label={`Eliminar nota: ${note.titulo}`}
                  onClick={() => handleDelete(note)}
                >
                  {deletingNoteId === note.id_nota
                    ? 'Eliminando...'
                    : 'Eliminar'}
                </button>
              </div>
            </article>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <section className="notes-section" aria-labelledby="notes-title">
      <h2 id="notes-title">Tus notas</h2>
      {deletionMessage && (
        <p
          className={`deletion-message deletion-message--${deletionMessage.type}`}
          role={deletionMessage.type === 'success' ? 'status' : 'alert'}
        >
          {deletionMessage.text}
        </p>
      )}
      {content}
    </section>
  );
}

export default NotesList;
