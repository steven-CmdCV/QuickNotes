import { useEffect, useRef, useState } from 'react';
import CreateNoteForm from './components/CreateNoteForm.jsx';
import LoginForm from './components/LoginForm.jsx';
import NotesList from './components/NotesList.jsx';
import RegisterForm from './components/RegisterForm.jsx';
import {
  clearAuthToken,
  clearUnauthorizedHandler,
  getCurrentUser,
  getHealth,
  isUnauthorizedError,
  setAuthToken,
  setUnauthorizedHandler,
} from './services/api.js';
import './App.css';

const AUTH_TOKEN_KEY = 'quicknotes.authToken';
const EXPIRED_SESSION_NOTICE = 'Tu sesión expiró. Inicia sesión nuevamente.';

const connectionMessages = {
  loading: 'Comprobando conexión con el servidor...',
  success: 'Backend conectado correctamente.',
  error: 'No se pudo conectar con el backend.',
};

function removeStoredToken() {
  try {
    sessionStorage.removeItem(AUTH_TOKEN_KEY);
    return true;
  } catch {
    try {
      sessionStorage.setItem(AUTH_TOKEN_KEY, '');
      return true;
    } catch {
      return false;
    }
  }
}

function App() {
  const [connectionStatus, setConnectionStatus] = useState('loading');
  const [notesRefreshKey, setNotesRefreshKey] = useState(0);
  const [authState, setAuthState] = useState({
    status: 'checking',
    user: null,
    message: null,
  });
  const [verificationKey, setVerificationKey] = useState(0);
  const [authNotice, setAuthNotice] = useState(null);
  const [authMode, setAuthMode] = useState('login');
  const verificationControllerRef = useRef(null);
  const storedTokenRef = useRef({
    initialized: false,
    value: null,
  });

  useEffect(() => {
    function handleUnauthorized() {
      verificationControllerRef.current?.abort();
      removeStoredToken();
      clearAuthToken();
      storedTokenRef.current = { initialized: true, value: null };
      setAuthNotice(EXPIRED_SESSION_NOTICE);
      setAuthMode('login');
      setAuthState((currentState) => {
        if (
          currentState.status === 'anonymous'
          && currentState.user === null
          && currentState.message === null
        ) {
          return currentState;
        }

        return { status: 'anonymous', user: null, message: null };
      });
    }

    setUnauthorizedHandler(handleUnauthorized);

    return () => {
      clearUnauthorizedHandler(handleUnauthorized);
    };
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    async function checkConnection() {
      try {
        await getHealth({ signal: controller.signal });

        if (!controller.signal.aborted) {
          setConnectionStatus('success');
        }
      } catch (error) {
        if (error.name === 'AbortError' || controller.signal.aborted) {
          return;
        }

        setConnectionStatus('error');
      }
    }

    checkConnection();

    return () => {
      controller.abort();
    };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    verificationControllerRef.current = controller;

    async function verifySession() {
      let storedToken = storedTokenRef.current.value;

      if (!storedTokenRef.current.initialized) {
        try {
          storedToken = sessionStorage.getItem(AUTH_TOKEN_KEY);
          storedTokenRef.current = {
            initialized: true,
            value: storedToken,
          };
        } catch {
          clearAuthToken();
          storedTokenRef.current = { initialized: true, value: null };
          setAuthMode('login');
          setAuthState({
            status: 'anonymous',
            user: null,
            message: 'No se pudo iniciar sesión.',
          });
          return;
        }
      }

      const normalizedToken = typeof storedToken === 'string'
        ? storedToken.trim()
        : '';

      if (!normalizedToken) {
        clearAuthToken();
        storedTokenRef.current = { initialized: true, value: null };
        setAuthMode('login');
        const storageWasCleared = removeStoredToken();
        setAuthState({
          status: 'anonymous',
          user: null,
          message: storageWasCleared ? null : 'No se pudo iniciar sesión.',
        });
        return;
      }

      try {
        setAuthToken(normalizedToken);
        storedTokenRef.current = {
          initialized: true,
          value: normalizedToken,
        };

        const user = await getCurrentUser({ signal: controller.signal });

        if (!controller.signal.aborted) {
          setAuthNotice(null);
          setAuthState({
            status: 'authenticated',
            user,
            message: null,
          });
        }
      } catch (error) {
        if (error.name === 'AbortError' || controller.signal.aborted) {
          return;
        }

        if (isUnauthorizedError(error)) {
          clearAuthToken();
          storedTokenRef.current = { initialized: true, value: null };
          const storageWasCleared = removeStoredToken();
          setAuthNotice(null);
          setAuthMode('login');
          setAuthState({
            status: 'anonymous',
            user: null,
            message: storageWasCleared ? null : 'No se pudo iniciar sesión.',
          });
        } else {
          setAuthState({
            status: 'verification-error',
            user: null,
            message: 'No se pudo verificar la sesión.',
          });
        }
      } finally {
        if (verificationControllerRef.current === controller) {
          verificationControllerRef.current = null;
        }
      }
    }

    verifySession();

    return () => {
      controller.abort();

      if (verificationControllerRef.current === controller) {
        verificationControllerRef.current = null;
      }
    };
  }, [verificationKey]);

  function handleNoteCreated() {
    setNotesRefreshKey((currentKey) => currentKey + 1);
  }

  function handleAuthenticated(session) {
    try {
      setAuthToken(session.token);
      sessionStorage.setItem(AUTH_TOKEN_KEY, session.token);
    } catch {
      clearAuthToken();

      try {
        sessionStorage.removeItem(AUTH_TOKEN_KEY);
      } catch {
        // The in-memory session remains cleared even if storage is unavailable.
      }

      storedTokenRef.current = { initialized: true, value: null };
      setAuthMode('login');
      setAuthState({ status: 'anonymous', user: null, message: null });
      return false;
    }

    storedTokenRef.current = {
      initialized: true,
      value: session.token,
    };
    setAuthNotice(null);
    setAuthMode('login');
    setAuthState({
      status: 'authenticated',
      user: session.user,
      message: null,
    });
    return true;
  }

  function handleRetryVerification() {
    setAuthNotice(null);
    setAuthState({ status: 'checking', user: null, message: null });
    setVerificationKey((currentKey) => currentKey + 1);
  }

  function handleLogout() {
    verificationControllerRef.current?.abort();
    clearAuthToken();

    let storageWasCleared = true;

    try {
      sessionStorage.removeItem(AUTH_TOKEN_KEY);
    } catch {
      try {
        sessionStorage.setItem(AUTH_TOKEN_KEY, '');
      } catch {
        storageWasCleared = false;
      }
    }

    storedTokenRef.current = { initialized: true, value: null };
    setAuthNotice(null);
    setAuthMode('login');
    setAuthState({
      status: 'anonymous',
      user: null,
      message: storageWasCleared ? null : 'No se pudo iniciar sesión.',
    });
  }

  function handleShowRegister() {
    setAuthNotice(null);
    setAuthMode('register');
  }

  function handleShowLogin() {
    setAuthNotice(null);
    setAuthMode('login');
  }

  let authContent;

  if (authState.status === 'checking') {
    authContent = (
      <section className="session-section" aria-label="Verificación de sesión">
        <p className="session-message" role="status">
          Verificando sesión...
        </p>
      </section>
    );
  } else if (authState.status === 'verification-error') {
    authContent = (
      <section className="session-section" aria-label="Error de sesión">
        <p className="auth-message auth-message--error" role="alert">
          {authState.message}
        </p>
        <div className="session-actions">
          <button
            className="session-button"
            type="button"
            onClick={handleRetryVerification}
          >
            Reintentar
          </button>
          <button
            className="logout-button"
            type="button"
            onClick={handleLogout}
          >
            Cerrar sesión
          </button>
        </div>
      </section>
    );
  } else if (authState.status === 'anonymous') {
    authContent = (
      <>
        {authState.message && (
          <p className="auth-message auth-message--error auth-message--standalone" role="alert">
            {authState.message}
          </p>
        )}
        {authMode === 'login' ? (
          <LoginForm
            notice={authNotice}
            onAuthenticated={handleAuthenticated}
            onLoginAttempt={() => setAuthNotice(null)}
            onShowRegister={handleShowRegister}
          />
        ) : (
          <RegisterForm
            onAuthenticated={handleAuthenticated}
            onShowLogin={handleShowLogin}
          />
        )}
      </>
    );
  } else {
    authContent = (
      <>
        <CreateNoteForm onNoteCreated={handleNoteCreated} />
        <NotesList refreshKey={notesRefreshKey} />
      </>
    );
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="intro">
          <h1 id="app-title">QuickNotes</h1>
          <p className="description">
            Organiza tus notas de manera rápida y sencilla.
          </p>
          <p
            className={`status status--${connectionStatus}`}
            role="status"
            aria-live="polite"
          >
            {connectionMessages[connectionStatus]}
          </p>
        </div>
        {authState.status === 'authenticated' && (
          <div className="user-bar" aria-label="Sesión actual">
            <div className="user-details">
              <p className="user-name">{authState.user.nombre}</p>
              <p className="user-email">{authState.user.correo}</p>
            </div>
            <button
              className="logout-button"
              type="button"
              onClick={handleLogout}
            >
              Cerrar sesión
            </button>
          </div>
        )}
      </header>
      <main className="app-content" aria-labelledby="app-title">
        {authContent}
      </main>
    </div>
  );
}

export default App;
