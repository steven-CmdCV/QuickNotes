import { useEffect, useRef, useState } from 'react';
import { getApiErrorStatus, registerUser } from '../services/api.js';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateRegistration({
  confirmPassword,
  email,
  name,
  password,
}) {
  const normalizedName = name.trim();
  const normalizedEmail = email.trim().toLowerCase();

  if (!normalizedName || !normalizedEmail || !password || !confirmPassword) {
    return { error: 'Completa todos los campos.' };
  }

  if (normalizedName.length > 100) {
    return { error: 'El nombre no puede exceder los 100 caracteres.' };
  }

  if (normalizedEmail.length > 254 || !EMAIL_PATTERN.test(normalizedEmail)) {
    return { error: 'Introduce un correo válido.' };
  }

  if (password.length < 8) {
    return { error: 'La contraseña debe tener al menos 8 caracteres.' };
  }

  if (new TextEncoder().encode(password).length > 72) {
    return { error: 'La contraseña supera el límite permitido.' };
  }

  if (password !== confirmPassword) {
    return { error: 'Las contraseñas no coinciden.' };
  }

  return {
    data: {
      correo: normalizedEmail,
      nombre: normalizedName,
      password,
    },
  };
}

function RegisterForm({ onAuthenticated, onShowLogin }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submissionState, setSubmissionState] = useState({
    status: 'idle',
    message: null,
  });
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

  function clearError() {
    if (submissionState.status === 'error') {
      setSubmissionState({ status: 'idle', message: null });
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (isSubmittingRef.current) {
      return;
    }

    const validation = validateRegistration({
      confirmPassword,
      email,
      name,
      password,
    });

    if (validation.error) {
      setSubmissionState({ status: 'error', message: validation.error });
      return;
    }

    isSubmittingRef.current = true;
    setSubmissionState({ status: 'submitting', message: null });

    const controller = new AbortController();
    submitControllerRef.current = controller;

    try {
      const session = await registerUser(
        validation.data,
        { signal: controller.signal },
      );

      if (!controller.signal.aborted && isMountedRef.current) {
        setPassword('');
        setConfirmPassword('');

        if (onAuthenticated(session) === false) {
          setSubmissionState({
            status: 'error',
            message: 'No se pudo crear la cuenta.',
          });
        }
      }
    } catch (error) {
      if (error.name === 'AbortError' || controller.signal.aborted) {
        return;
      }

      if (isMountedRef.current) {
        let message = 'No se pudo crear la cuenta.';
        const errorStatus = getApiErrorStatus(error);

        if (errorStatus === 409) {
          message = 'Ya existe una cuenta con ese correo.';
        } else if (errorStatus === 400) {
          message = 'Revisa los datos de registro.';
        } else if (error instanceof TypeError) {
          message = 'No se pudo conectar con el servidor.';
        }

        setSubmissionState({ status: 'error', message });
      }
    } finally {
      if (submitControllerRef.current === controller) {
        submitControllerRef.current = null;
      }

      isSubmittingRef.current = false;

      if (isMountedRef.current) {
        setSubmissionState((currentState) => (
          currentState.status === 'submitting'
            ? { status: 'idle', message: null }
            : currentState
        ));
      }
    }
  }

  const isSubmitting = submissionState.status === 'submitting';

  return (
    <section className="register-section" aria-labelledby="register-title">
      <h2 id="register-title">Crear cuenta</h2>
      <p className="required-note">
        Los campos marcados con * son obligatorios.
      </p>
      <form className="register-form" onSubmit={handleSubmit} noValidate>
        <div className="form-field">
          <label htmlFor="register-name">
            Nombre <span className="required-mark" aria-hidden="true">*</span>
          </label>
          <input
            id="register-name"
            name="nombre"
            type="text"
            autoComplete="name"
            maxLength={100}
            required
            autoFocus
            value={name}
            onChange={(event) => {
              setName(event.target.value);
              clearError();
            }}
          />
        </div>

        <div className="form-field">
          <label htmlFor="register-email">
            Correo <span className="required-mark" aria-hidden="true">*</span>
          </label>
          <input
            id="register-email"
            name="correo"
            type="email"
            autoComplete="email"
            maxLength={254}
            required
            value={email}
            onChange={(event) => {
              setEmail(event.target.value);
              clearError();
            }}
          />
        </div>

        <div className="form-field">
          <label htmlFor="register-password">
            Contraseña{' '}
            <span className="required-mark" aria-hidden="true">*</span>
          </label>
          <input
            id="register-password"
            name="password"
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
            value={password}
            onChange={(event) => {
              setPassword(event.target.value);
              clearError();
            }}
          />
        </div>

        <div className="form-field">
          <label htmlFor="register-password-confirmation">
            Confirmar contraseña{' '}
            <span className="required-mark" aria-hidden="true">*</span>
          </label>
          <input
            id="register-password-confirmation"
            name="password_confirmation"
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
            value={confirmPassword}
            onChange={(event) => {
              setConfirmPassword(event.target.value);
              clearError();
            }}
          />
        </div>

        <button className="submit-button" type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Creando cuenta...' : 'Crear cuenta'}
        </button>

        {submissionState.status === 'error' && (
          <p className="auth-message auth-message--error" role="alert">
            {submissionState.message}
          </p>
        )}
      </form>
      <div className="auth-switch">
        <p>¿Ya tienes una cuenta?</p>
        <button
          className="auth-switch-button"
          type="button"
          onClick={onShowLogin}
        >
          Iniciar sesión
        </button>
      </div>
    </section>
  );
}

export default RegisterForm;
