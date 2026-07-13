import { useEffect, useRef, useState } from 'react';
import { getCategories, updateNote } from '../services/api.js';

function getInitialFormData(note) {
  return {
    title: note.titulo,
    content: note.contenido,
    categoryId: note.id_categoria === null ? '' : String(note.id_categoria),
    isFavorite: note.es_favorita === true,
  };
}

function EditNoteForm({ note, onCancel, onUpdated }) {
  const [categoriesState, setCategoriesState] = useState({
    status: 'loading',
    categories: [],
  });
  const [formData, setFormData] = useState(() => getInitialFormData(note));
  const [submissionState, setSubmissionState] = useState('idle');
  const isMountedRef = useRef(false);
  const isSubmittingRef = useRef(false);
  const submitControllerRef = useRef(null);

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
      submitControllerRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    async function loadCategories() {
      try {
        const categories = await getCategories({ signal: controller.signal });

        if (!controller.signal.aborted) {
          setCategoriesState({ status: 'success', categories });
        }
      } catch (error) {
        if (error.name === 'AbortError' || controller.signal.aborted) {
          return;
        }

        setCategoriesState({ status: 'error', categories: [] });
      }
    }

    loadCategories();

    return () => {
      controller.abort();
    };
  }, []);

  function updateField(field, value) {
    setFormData((currentData) => ({ ...currentData, [field]: value }));

    if (
      submissionState === 'error'
      || submissionState === 'validation-error'
    ) {
      setSubmissionState('idle');
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (isSubmittingRef.current) {
      return;
    }

    const title = formData.title.trim();
    const content = formData.content.trim();

    if (!title || title.length > 150 || !content || content.length > 10000) {
      setSubmissionState('validation-error');
      return;
    }

    let categoryId = note.id_categoria;

    if (categoriesState.status === 'success') {
      categoryId = formData.categoryId === ''
        ? null
        : Number(formData.categoryId);

      const categoryIsValid = categoryId === null
        || (
          Number.isSafeInteger(categoryId)
          && categoryId > 0
          && categoriesState.categories.some(
            (category) => category.id_categoria === categoryId,
          )
        );

      if (!categoryIsValid) {
        setSubmissionState('validation-error');
        return;
      }
    } else if (
      categoryId !== null
      && (!Number.isSafeInteger(categoryId) || categoryId <= 0)
    ) {
      setSubmissionState('validation-error');
      return;
    }

    if (typeof formData.isFavorite !== 'boolean') {
      setSubmissionState('validation-error');
      return;
    }

    isSubmittingRef.current = true;
    setSubmissionState('submitting');

    const controller = new AbortController();
    submitControllerRef.current = controller;

    try {
      const updatedNote = await updateNote(note.id_nota, {
        titulo: title,
        contenido: content,
        id_categoria: categoryId,
        es_favorita: formData.isFavorite,
      }, { signal: controller.signal });

      if (!controller.signal.aborted && isMountedRef.current) {
        onUpdated(updatedNote);
      }
    } catch (error) {
      if (error.name === 'AbortError' || controller.signal.aborted) {
        return;
      }

      if (isMountedRef.current) {
        setSubmissionState('error');
      }
    } finally {
      if (submitControllerRef.current === controller) {
        submitControllerRef.current = null;
      }

      isSubmittingRef.current = false;

      if (isMountedRef.current) {
        setSubmissionState((currentState) => (
          currentState === 'submitting' ? 'idle' : currentState
        ));
      }
    }
  }

  const isSubmitting = submissionState === 'submitting';
  const categoriesAvailable = categoriesState.status === 'success';
  const titleId = `edit-note-title-${note.id_nota}`;
  const contentId = `edit-note-content-${note.id_nota}`;
  const categoryId = `edit-note-category-${note.id_nota}`;
  const favoriteId = `edit-note-favorite-${note.id_nota}`;

  return (
    <form className="edit-note-form" onSubmit={handleSubmit} noValidate>
      <h3>Editando: {note.titulo}</h3>

      {categoriesState.status === 'loading' && (
        <p className="category-status" role="status">
          Cargando categorías...
        </p>
      )}
      {categoriesState.status === 'error' && (
        <p className="category-status category-status--error" role="alert">
          No se pudieron cargar las categorías.
        </p>
      )}

      <div className="form-field">
        <label htmlFor={titleId}>
          Título <span className="required-mark" aria-hidden="true">*</span>
        </label>
        <input
          id={titleId}
          name="titulo"
          type="text"
          required
          maxLength={150}
          autoFocus
          value={formData.title}
          onChange={(event) => updateField('title', event.target.value)}
        />
      </div>

      <div className="form-field">
        <label htmlFor={contentId}>
          Contenido <span className="required-mark" aria-hidden="true">*</span>
        </label>
        <textarea
          id={contentId}
          name="contenido"
          required
          maxLength={10000}
          value={formData.content}
          onChange={(event) => updateField('content', event.target.value)}
        />
      </div>

      <div className="form-field">
        <label htmlFor={categoryId}>Categoría</label>
        <select
          id={categoryId}
          name="id_categoria"
          disabled={!categoriesAvailable || isSubmitting}
          value={formData.categoryId}
          onChange={(event) => updateField('categoryId', event.target.value)}
        >
          <option value="">Sin categoría</option>
          {categoriesState.categories.map((category) => (
            <option
              key={category.id_categoria}
              value={category.id_categoria}
            >
              {category.nombre_categoria}
            </option>
          ))}
        </select>
      </div>

      <label className="favorite-field" htmlFor={favoriteId}>
        <input
          id={favoriteId}
          name="es_favorita"
          type="checkbox"
          disabled={isSubmitting}
          checked={formData.isFavorite}
          onChange={(event) => updateField('isFavorite', event.target.checked)}
        />
        Marcar como favorita
      </label>

      <div className="edit-form-actions">
        <button className="submit-button" type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Guardando...' : 'Guardar cambios'}
        </button>
        <button
          className="cancel-button"
          type="button"
          disabled={isSubmitting}
          onClick={onCancel}
        >
          Cancelar
        </button>
      </div>

      {submissionState === 'error' && (
        <p className="form-message form-message--error" role="alert">
          No se pudo actualizar la nota.
        </p>
      )}
      {submissionState === 'validation-error' && (
        <p className="form-message form-message--error" role="alert">
          Completa el título y el contenido con valores válidos.
        </p>
      )}
    </form>
  );
}

export default EditNoteForm;
