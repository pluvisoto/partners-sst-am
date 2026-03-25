import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ minHeight: '100vh', background: '#0a0a0a', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
          <div style={{ maxWidth: '480px', textAlign: 'center' }}>
            <h1 style={{ color: '#ef4444', fontSize: '1.5rem', marginBottom: '1rem' }}>Algo deu errado</h1>
            <p style={{ color: '#9ca3af', marginBottom: '1.5rem' }}>
              Ocorreu um erro inesperado. Recarregue a pagina para tentar novamente.
            </p>
            <button
              onClick={() => window.location.reload()}
              style={{
                padding: '0.75rem 2rem', borderRadius: '10px', border: 'none',
                background: '#d4af37', color: '#121212', fontWeight: 700, cursor: 'pointer'
              }}
            >
              Recarregar pagina
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
