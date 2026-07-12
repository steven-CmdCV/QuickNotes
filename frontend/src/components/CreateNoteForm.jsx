import { useEffect, useRef, useState } from 'react';
import { createNote, getCategories } from '../services/api.js';

const initialFormData = {
  title: '',
  content: '',
  categoryId: '',
  isFavorite: false,
};

function CreateNoteForm({ onNoteCreated }) {
  const [categoriesState, setCategoriesState] = useState({
    status: 'loading',
    categories: [],
  });
  const [formData, setFormData] = useState(initialFormData);
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

    if (submissionState === 'success' || submissionState === 'error') {
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

    isSubmittingRef.current = true;
    setSubmissionState('submitting');

    const controller = new AbortController();
    submitControllerRef.current = controller;

    try {
      const categoryId = categoriesState.status === 'success'
        && formData.categoryId !== ''
        ? Number(formData.categoryId)
        : null;

      await createNote({
        titulo: title,
        contenido: content,
        id_categoria: categoryId,
        es_favorita: formData.isFavorite,
      }, { signal: controller.signal });

      if (!controller.signal.aborted && isMountedRef.current) {
        setFormData(initialFormData);
        setSubmissionState('success');
        onNoteCreated();
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

  return (
    <section className="create-note-section" aria-labelledby="create-title">
      <h2 id="create-title">Crear nota</h2>

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

      <form className="note-form" onSubmit={handleSubmit} noValidate>
        <div className="form-field">
          <label htmlFor="note-title">
            Título <span className="required-mark" aria-hidden="true">*</span>
          </label>
          <input
            id="note-title"
            name="titulo"
            type="text"
            required
            maxLength={150}
            value={formData.title}
            onChange={(event) => updateField('title', event.target.value)}
          />
        </div>

        <div className="form-field">
          <label htmlFor="note-content">
            Contenido <span className="required-mark" aria-hidden="true">*</span>
          </label>
          <textarea
            id="note-content"
            name="contenido"
            required
            maxLength={10000}
            value={formData.content}
            onChange={(event) => updateField('content', event.target.value)}
          />
        </div>

        <div className="form-field">
          <label htmlFor="note-category">Categoría</label>
          <select
            id="note-category"
            name="id_categoria"
            disabled={!categoriesAvailable}
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

        <label className="favorite-field" htmlFor="note-favorite">
          <input
            id="note-favorite"
            name="es_favorita"
            type="checkbox"
            checked={formData.isFavorite}
            onChange={(event) => updateField('isFavorite', event.target.checked)}
          />
          Marcar como favorita
        </label>

        <button className="submit-button" type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Creando nota...' : 'Crear nota'}
        </button>

        {submissionState === 'success' && (
          <p className="form-message form-message--success" role="status">
            Nota creada correctamente.
          </p>
        )}
        {submissionState === 'error' && (
          <p className="form-message form-message--error" role="alert">
            No se pudo crear la nota.
          </p>
        )}
        {submissionState === 'validation-error' && (
          <p className="form-message form-message--error" role="alert">
            Completa el título y el contenido con valores válidos.
          </p>
        )}
      </form>
    </section>
  );
}

export default CreateNoteForm;
