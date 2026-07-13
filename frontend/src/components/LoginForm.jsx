import { useEffect, useRef, useState } from 'react';
import { isUnauthorizedError, login } from '../services/api.js';

function LoginForm({ notice, onAuthenticated, onLoginAttempt }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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

  function clearError() {
    if (submissionState !== 'idle' && submissionState !== 'submitting') {
      setSubmissionState('idle');
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (isSubmittingRef.current) {
      return;
    }

    onLoginAttempt();

    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail || password.length === 0) {
      setSubmissionState('validation-error');
      return;
    }

    isSubmittingRef.current = true;
    setSubmissionState('submitting');

    const controller = new AbortController();
    submitControllerRef.current = controller;

    try {
      const session = await login({
        correo: normalizedEmail,
        password,
      }, { signal: controller.signal });

      if (!controller.signal.aborted && isMountedRef.current) {
        setPassword('');

        if (onAuthenticated(session) === false) {
          setSubmissionState('error');
        }
      }
    } catch (error) {
      if (error.name === 'AbortError' || controller.signal.aborted) {
        return;
      }

      if (isMountedRef.current) {
        if (isUnauthorizedError(error)) {
          setPassword('');
          setSubmissionState('credentials-error');
        } else {
          setSubmissionState('error');
        }
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

  return (
    <section className="login-section" aria-labelledby="login-title">
      <h2 id="login-title">Iniciar sesión</h2>
      {notice && (
        <p className="auth-message auth-message--notice" role="status">
          {notice}
        </p>
      )}
      <form className="login-form" onSubmit={handleSubmit} noValidate>
        <div className="form-field">
          <label htmlFor="login-email">Correo</label>
          <input
            id="login-email"
            name="correo"
            type="email"
            autoComplete="email"
            required
            autoFocus
            value={email}
            onChange={(event) => {
              setEmail(event.target.value);
              clearError();
            }}
          />
        </div>

        <div className="form-field">
          <label htmlFor="login-password">Contraseña</label>
          <input
            id="login-password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => {
              setPassword(event.target.value);
              clearError();
            }}
          />
        </div>

        <button className="submit-button" type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Iniciando sesión...' : 'Iniciar sesión'}
        </button>

        {submissionState === 'credentials-error' && (
          <p className="auth-message auth-message--error" role="alert">
            Correo o contraseña incorrectos.
          </p>
        )}
        {submissionState === 'error' && (
          <p className="auth-message auth-message--error" role="alert">
            No se pudo iniciar sesión.
          </p>
        )}
        {submissionState === 'validation-error' && (
          <p className="auth-message auth-message--error" role="alert">
            Completa el correo y la contraseña.
          </p>
        )}
      </form>
    </section>
  );
}

export default LoginForm;
