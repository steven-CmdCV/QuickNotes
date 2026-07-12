import { useEffect, useState } from 'react';
import { getHealth } from './services/api.js';
import './App.css';

const connectionMessages = {
  loading: 'Comprobando conexión con el servidor...',
  success: 'Backend conectado correctamente.',
  error: 'No se pudo conectar con el backend.',
};

function App() {
  const [connectionStatus, setConnectionStatus] = useState('loading');

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

  return (
    <main className="app-shell">
      <section className="intro" aria-labelledby="app-title">
        <p
          className={`status status--${connectionStatus}`}
          role="status"
          aria-live="polite"
        >
          {connectionMessages[connectionStatus]}
        </p>
        <h1 id="app-title">QuickNotes</h1>
        <p className="description">
          Organiza tus notas de manera rápida y sencilla.
        </p>
      </section>
    </main>
  );
}

export default App;
