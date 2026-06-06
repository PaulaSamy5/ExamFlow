import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, info: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    this.setState({ info });
    console.error('[ErrorBoundary] Caught crash:', error.message);
    console.error('[ErrorBoundary] Component stack:', info?.componentStack);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback(this.state.error);
      return (
        <div className="rounded-2xl border border-rose-500/30 bg-rose-500/5 p-6 space-y-3">
          <p className="text-sm font-black text-rose-400 uppercase tracking-widest">Render Error</p>
          <p className="text-xs text-slate-400 font-mono break-all">
            {this.state.error?.message || 'Unknown error'}
          </p>
          <button
            onClick={() => this.setState({ hasError: false, error: null, info: null })}
            className="text-xs font-bold text-indigo-400 hover:text-indigo-300 underline"
          >
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
