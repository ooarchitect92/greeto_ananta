import React from 'react';

// Without this, an uncaught render error anywhere in the tree unmounts the
// whole app and leaves a blank white page with no clue why.
export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary] Render crash:', error, info?.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f4f1fb', padding: 24 }}>
          <div style={{ maxWidth: 640, width: '100%', background: 'white', borderRadius: 24, padding: 32, boxShadow: '0 10px 40px rgba(0,0,0,0.08)' }}>
            <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: '#8B2CF5', margin: 0 }}>Something broke</p>
            <h1 style={{ fontSize: 22, fontWeight: 800, margin: '8px 0 12px', color: '#0f172a' }}>This page hit an error</h1>
            <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: 12, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, padding: 16, color: '#334155', maxHeight: 260, overflow: 'auto' }}>
              {String(this.state.error?.message || this.state.error)}
            </pre>
            <button
              type="button"
              onClick={() => { this.setState({ error: null }); window.location.reload(); }}
              style={{ marginTop: 16, background: '#8B2CF5', color: 'white', border: 'none', borderRadius: 12, padding: '10px 18px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
            >
              Reload
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
