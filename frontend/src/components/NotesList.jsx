import { useEffect, useMemo, useRef, useState } from 'react';
import { deleteNote, getNotes } from '../services/api.js';
import EditNoteForm from './EditNoteForm.jsx';
import NotesFilters from './NotesFilters.jsx';

const ALL_CATEGORIES = 'all';
const UNCATEGORIZED = 'uncategorized';

function normalizeSearchValue(value) {
  if (typeof value !== 'string') {
    return '';
  }

  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function mergeCategoryOptions(currentOptions, notes) {
  const categoriesById = new Map(
    currentOptions.map((category) => [category.id, category.name]),
  );

  for (const note of notes) {
    if (
      Number.isSafeInteger(note.id_categoria)
      && note.id_categoria > 0
      && typeof note.nombre_categoria === 'string'
      && note.nombre_categoria.trim() !== ''
    ) {
      categoriesById.set(
        note.id_categoria,
        note.nombre_categoria.trim(),
      );
    }
  }

  return Array.from(categoriesById, ([id, name]) => ({ id, name }))
    .sort((firstCategory, secondCategory) => (
      firstCategory.name.localeCompare(secondCategory.name)
    ));
}

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
  const [editingNoteId, setEditingNoteId] = useState(null);
  const [editMessage, setEditMessage] = useState(null);
  const [notesReloadKey, setNotesReloadKey] = useState(0);
  const [searchText, setSearchText] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(ALL_CATEGORIES);
  const [onlyFavorites, setOnlyFavorites] = useState(false);
  const [categoryOptions, setCategoryOptions] = useState([]);
  const deletionInProgressRef = useRef(false);
  const deleteControllerRef = useRef(null);
  const editingNoteIdRef = useRef(null);
  const editButtonRefs = useRef(new Map());

  useEffect(() => {
    const controller = new AbortController();

    async function loadNotes() {
      try {
        const notes = await getNotes({ signal: controller.signal });

        if (!controller.signal.aborted) {
          setRequestState({ status: 'success', notes });
          setCategoryOptions((currentOptions) => (
            mergeCategoryOptions(currentOptions, notes)
          ));

          if (
            editingNoteIdRef.current !== null
            && !notes.some(
              (note) => note.id_nota === editingNoteIdRef.current,
            )
          ) {
            editingNoteIdRef.current = null;
            setEditingNoteId(null);
            setEditMessage({
              type: 'error',
              text: 'No se pudo actualizar la nota.',
            });
          }
        }
      } catch (error) {
        if (error.name === 'AbortError' || controller.signal.aborted) {
          return;
        }

        setRequestState((currentState) => ({
          status: 'error',
          notes: currentState.notes,
        }));
      }
    }

    loadNotes();

    return () => {
      controller.abort();
    };
  }, [refreshKey, notesReloadKey]);

  useEffect(() => () => {
    deleteControllerRef.current?.abort();
  }, []);

  async function handleDelete(note) {
    if (
      deletionInProgressRef.current
      || editingNoteIdRef.current !== null
    ) {
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

  function focusEditButton(noteId) {
    window.setTimeout(() => {
      editButtonRefs.current.get(noteId)?.focus();
    }, 0);
  }

  function handleEdit(noteId) {
    if (
      deletionInProgressRef.current
      || editingNoteIdRef.current !== null
    ) {
      return;
    }

    editingNoteIdRef.current = noteId;
    setEditingNoteId(noteId);
    setEditMessage(null);
  }

  function handleEditCancel(noteId) {
    editingNoteIdRef.current = null;
    setEditingNoteId(null);
    focusEditButton(noteId);
  }

  function handleNoteUpdated(updatedNote) {
    editingNoteIdRef.current = null;
    setEditingNoteId(null);
    setEditMessage({
      type: 'success',
      text: 'Nota actualizada correctamente.',
    });
    setNotesReloadKey((currentKey) => currentKey + 1);
    focusEditButton(updatedNote.id_nota);
  }

  function handleClearFilters() {
    setSearchText('');
    setSelectedCategory(ALL_CATEGORIES);
    setOnlyFavorites(false);
  }

  const normalizedSearch = normalizeSearchValue(searchText);
  const hasActiveFilters = normalizedSearch !== ''
    || selectedCategory !== ALL_CATEGORIES
    || onlyFavorites;
  const filtersDisabled = editingNoteId !== null || deletingNoteId !== null;
  const filteredNotes = useMemo(() => requestState.notes.filter((note) => {
    const matchesSearch = normalizedSearch === ''
      || normalizeSearchValue(note.titulo).includes(normalizedSearch)
      || normalizeSearchValue(note.contenido).includes(normalizedSearch);

    let matchesCategory = true;

    if (selectedCategory === UNCATEGORIZED) {
      matchesCategory = note.id_categoria === null;
    } else if (selectedCategory !== ALL_CATEGORIES) {
      matchesCategory = selectedCategory === `category:${note.id_categoria}`;
    }

    const matchesFavorite = !onlyFavorites || note.es_favorita === true;

    return matchesSearch && matchesCategory && matchesFavorite;
  }), [
    normalizedSearch,
    onlyFavorites,
    requestState.notes,
    selectedCategory,
  ]);

  let content;

  if (requestState.status === 'loading' && requestState.notes.length === 0) {
    content = (
      <p className="notes-message" role="status">
        Cargando notas...
      </p>
    );
  } else if (
    requestState.status === 'error'
    && requestState.notes.length === 0
  ) {
    content = (
      <p className="notes-message notes-message--error" role="alert">
        No se pudieron cargar las notas.
      </p>
    );
  } else if (requestState.notes.length === 0) {
    content = <p className="notes-message">No hay notas disponibles.</p>;
  } else if (filteredNotes.length === 0) {
    content = (
      <p className="notes-message">
        No hay notas que coincidan con los filtros.
      </p>
    );
  } else {
    content = (
      <ul className="notes-grid">
        {filteredNotes.map((note) => (
          <li key={note.id_nota}>
            <article className="note-card">
              {editingNoteId === note.id_nota ? (
                <EditNoteForm
                  note={note}
                  onCancel={() => handleEditCancel(note.id_nota)}
                  onUpdated={handleNoteUpdated}
                />
              ) : (
                <>
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
                    <div className="note-actions">
                      <button
                        className="edit-button"
                        type="button"
                        disabled={
                          deletingNoteId !== null || editingNoteId !== null
                        }
                        ref={(element) => {
                          if (element) {
                            editButtonRefs.current.set(note.id_nota, element);
                          } else {
                            editButtonRefs.current.delete(note.id_nota);
                          }
                        }}
                        onClick={() => handleEdit(note.id_nota)}
                      >
                        Editar
                      </button>
                      <button
                        className="delete-button"
                        type="button"
                        disabled={
                          deletingNoteId !== null || editingNoteId !== null
                        }
                        aria-label={`Eliminar nota: ${note.titulo}`}
                        onClick={() => handleDelete(note)}
                      >
                        {deletingNoteId === note.id_nota
                          ? 'Eliminando...'
                          : 'Eliminar'}
                      </button>
                    </div>
                  </div>
                </>
              )}
            </article>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <section className="notes-section" aria-labelledby="notes-title">
      <h2 id="notes-title">Tus notas</h2>
      {requestState.notes.length > 0 && (
        <NotesFilters
          categoryOptions={categoryOptions}
          disabled={filtersDisabled}
          hasActiveFilters={hasActiveFilters}
          onlyFavorites={onlyFavorites}
          searchText={searchText}
          selectedCategory={selectedCategory}
          onCategoryChange={setSelectedCategory}
          onClear={handleClearFilters}
          onOnlyFavoritesChange={setOnlyFavorites}
          onSearchChange={setSearchText}
        />
      )}
      {deletionMessage && (
        <p
          className={`deletion-message deletion-message--${deletionMessage.type}`}
          role={deletionMessage.type === 'success' ? 'status' : 'alert'}
        >
          {deletionMessage.text}
        </p>
      )}
      {editMessage && (
        <p
          className={`edit-message edit-message--${editMessage.type}`}
          role={editMessage.type === 'success' ? 'status' : 'alert'}
        >
          {editMessage.text}
        </p>
      )}
      {requestState.status === 'error' && requestState.notes.length > 0 && (
        <p className="notes-message notes-message--error" role="alert">
          No se pudieron cargar las notas.
        </p>
      )}
      {content}
    </section>
  );
}

export default NotesList;
