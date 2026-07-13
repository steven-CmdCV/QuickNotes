import { useEffect, useRef, useState } from 'react';
import {
  deleteCurrentUser,
  getApiErrorStatus,
  updateCurrentUser,
} from '../services/api.js';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateProfile({ email, name }) {
  const normalizedName = name.trim();
  const normalizedEmail = email.trim().toLowerCase();

  if (!normalizedName || !normalizedEmail) {
    return { error: 'Completa el nombre y el correo.' };
  }

  if (normalizedName.length > 100) {
    return { error: 'El nombre no puede exceder los 100 caracteres.' };
  }

  if (
    normalizedEmail.length > 254
    || !EMAIL_PATTERN.test(normalizedEmail)
  ) {
    return { error: 'Introduce un correo válido.' };
  }

  return {
    data: {
      correo: normalizedEmail,
      nombre: normalizedName,
    },
  };
}

function ProfilePanel({ user, onUpdated, onDeleted, onClose }) {
  const [name, setName] = useState(user.nombre);
  const [email, setEmail] = useState(user.correo);
  const [profileState, setProfileState] = useState({
    status: 'idle',
    message: null,
  });
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
  const [password, setPassword] = useState('');
  const [deletionState, setDeletionState] = useState({
    status: 'idle',
    message: null,
  });
  const isMountedRef = useRef(false);
  const profilePendingRef = useRef(false);
  const deletionPendingRef = useRef(false);
  const profileControllerRef = useRef(null);
  const deletionControllerRef = useRef(null);
  const passwordInputRef = useRef(null);

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
      profileControllerRef.current?.abort();
      deletionControllerRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    if (showDeleteConfirmation) {
      passwordInputRef.current?.focus();
    }
  }, [showDeleteConfirmation]);

  function clearProfileMessage() {
    if (profileState.status === 'error' || profileState.status === 'success') {
      setProfileState({ status: 'idle', message: null });
    }
  }

  function clearDeletionConfirmation() {
    setPassword('');
    setShowDeleteConfirmation(false);
    setDeletionState({ status: 'idle', message: null });
  }

  function handleClose() {
    if (profilePendingRef.current || deletionPendingRef.current) {
      return;
    }

    clearDeletionConfirmation();
    onClose();
  }

  async function handleProfileSubmit(event) {
    event.preventDefault();

    if (profilePendingRef.current || deletionPendingRef.current) {
      return;
    }

    const validation = validateProfile({ email, name });

    if (validation.error) {
      setProfileState({ status: 'error', message: validation.error });
      return;
    }

    profilePendingRef.current = true;
    setProfileState({ status: 'submitting', message: null });
    const controller = new AbortController();
    profileControllerRef.current = controller;

    try {
      const updatedUser = await updateCurrentUser(
        validation.data,
        { signal: controller.signal },
      );

      if (!controller.signal.aborted && isMountedRef.current) {
        setName(updatedUser.nombre);
        setEmail(updatedUser.correo);
        onUpdated(updatedUser);
        setProfileState({
          status: 'success',
          message: 'Perfil actualizado correctamente.',
        });
      }
    } catch (error) {
      if (error.name === 'AbortError' || controller.signal.aborted) {
        return;
      }

      if (isMountedRef.current) {
        const status = getApiErrorStatus(error);
        let message = 'No se pudo actualizar el perfil.';

        if (status === 409) {
          message = 'Ya existe una cuenta con ese correo.';
        } else if (status === 400) {
          message = 'Revisa el nombre y el correo.';
        } else if (error instanceof TypeError) {
          message = 'No se pudo conectar con el servidor.';
        }

        setProfileState({ status: 'error', message });
      }
    } finally {
      if (profileControllerRef.current === controller) {
        profileControllerRef.current = null;
      }

      profilePendingRef.current = false;

      if (isMountedRef.current) {
        setProfileState((currentState) => (
          currentState.status === 'submitting'
            ? { status: 'idle', message: null }
            : currentState
        ));
      }
    }
  }

  function handleShowDeleteConfirmation() {
    if (profilePendingRef.current || deletionPendingRef.current) {
      return;
    }

    setPassword('');
    setDeletionState({ status: 'idle', message: null });
    setShowDeleteConfirmation(true);
  }

  async function handleDeleteSubmit(event) {
    event.preventDefault();

    if (profilePendingRef.current || deletionPendingRef.current) {
      return;
    }

    if (password.length === 0) {
      setDeletionState({
        status: 'error',
        message: 'Introduce tu contraseña actual.',
      });
      return;
    }

    deletionPendingRef.current = true;
    setDeletionState({ status: 'submitting', message: null });
    const controller = new AbortController();
    deletionControllerRef.current = controller;

    try {
      await deleteCurrentUser(
        { password },
        { signal: controller.signal },
      );

      if (!controller.signal.aborted && isMountedRef.current) {
        setPassword('');
        onDeleted();
        return;
      }
    } catch (error) {
      if (error.name === 'AbortError' || controller.signal.aborted) {
        return;
      }

      if (isMountedRef.current) {
        setPassword('');
        const status = getApiErrorStatus(error);
        let message = 'No se pudo eliminar la cuenta.';

        if (status === 403) {
          message = 'La contraseña actual es incorrecta.';
        } else if (error instanceof TypeError) {
          message = 'No se pudo confirmar la eliminación de la cuenta.';
        }

        setDeletionState({ status: 'error', message });
      }
    } finally {
      if (deletionControllerRef.current === controller) {
        deletionControllerRef.current = null;
      }

      deletionPendingRef.current = false;

      if (isMountedRef.current) {
        setDeletionState((currentState) => (
          currentState.status === 'submitting'
            ? { status: 'idle', message: null }
            : currentState
        ));
      }
    }
  }

  const isSaving = profileState.status === 'submitting';
  const isDeleting = deletionState.status === 'submitting';
  const operationPending = isSaving || isDeleting;

  return (
    <section
      id="profile-panel"
      className="profile-section"
      aria-labelledby="profile-title"
    >
      <div className="profile-heading">
        <div>
          <h2 id="profile-title">Mi perfil</h2>
          <p>Actualiza los datos visibles de tu cuenta.</p>
        </div>
        <button
          className="profile-close-button"
          type="button"
          onClick={handleClose}
          disabled={operationPending}
        >
          Cerrar perfil
        </button>
      </div>

      <form className="profile-form" onSubmit={handleProfileSubmit} noValidate>
        <div className="form-field">
          <label htmlFor="profile-name">
            Nombre <span className="required-mark" aria-hidden="true">*</span>
          </label>
          <input
            id="profile-name"
            name="nombre"
            type="text"
            autoComplete="name"
            maxLength={100}
            required
            value={name}
            disabled={operationPending}
            onChange={(event) => {
              setName(event.target.value);
              clearProfileMessage();
            }}
          />
        </div>

        <div className="form-field">
          <label htmlFor="profile-email">
            Correo <span className="required-mark" aria-hidden="true">*</span>
          </label>
          <input
            id="profile-email"
            name="correo"
            type="email"
            autoComplete="email"
            maxLength={254}
            required
            value={email}
            disabled={operationPending}
            onChange={(event) => {
              setEmail(event.target.value);
              clearProfileMessage();
            }}
          />
        </div>

        <button
          className="submit-button"
          type="submit"
          disabled={operationPending}
        >
          {isSaving ? 'Guardando...' : 'Guardar cambios'}
        </button>

        {profileState.status === 'success' && (
          <p className="profile-message profile-message--success" role="status">
            {profileState.message}
          </p>
        )}
        {profileState.status === 'error' && (
          <p className="profile-message profile-message--error" role="alert">
            {profileState.message}
          </p>
        )}
      </form>

      <div className="profile-danger-zone">
        <h3>Eliminar cuenta</h3>
        {!showDeleteConfirmation ? (
          <>
            <p>
              Esta acción elimina permanentemente tu cuenta y todas tus notas.
            </p>
            <button
              className="profile-delete-button"
              type="button"
              onClick={handleShowDeleteConfirmation}
              disabled={operationPending}
            >
              Eliminar cuenta
            </button>
          </>
        ) : (
          <form
            className="profile-delete-form"
            onSubmit={handleDeleteSubmit}
            noValidate
          >
            <p>
              Esta acción no se puede deshacer. Tu cuenta y todas tus notas se
              eliminarán definitivamente.
            </p>
            <div className="form-field">
              <label htmlFor="profile-current-password">
                Contraseña actual{' '}
                <span className="required-mark" aria-hidden="true">*</span>
              </label>
              <input
                ref={passwordInputRef}
                id="profile-current-password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                disabled={operationPending}
                onChange={(event) => {
                  setPassword(event.target.value);

                  if (deletionState.status === 'error') {
                    setDeletionState({ status: 'idle', message: null });
                  }
                }}
              />
            </div>
            <div className="profile-delete-actions">
              <button
                className="profile-delete-confirm-button"
                type="submit"
                disabled={operationPending}
              >
                {isDeleting ? 'Eliminando...' : 'Eliminar definitivamente'}
              </button>
              <button
                className="cancel-button"
                type="button"
                onClick={clearDeletionConfirmation}
                disabled={operationPending}
              >
                Cancelar
              </button>
            </div>
            {deletionState.status === 'error' && (
              <p className="profile-message profile-message--error" role="alert">
                {deletionState.message}
              </p>
            )}
          </form>
        )}
      </div>
    </section>
  );
}

export default ProfilePanel;
