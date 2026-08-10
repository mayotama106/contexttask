import { Component, type ErrorInfo, type ReactNode } from "react";

interface State {
  error: Error | null;
}

/**
 * Inside a WebView there is no console to check, so a render failure must
 * present itself on screen rather than as an unexplained black rectangle.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("[app] render failed", error, info.componentStack);
  }

  render(): ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <div
        style={{
          padding: "64px 24px",
          fontFamily: "var(--font-mono)",
          fontSize: 12,
          color: "var(--red-300)",
          lineHeight: 1.6,
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
        }}
      >
        <div style={{ color: "var(--gold-500)", fontSize: 16, marginBottom: 12 }}>
          描画に失敗しました
        </div>
        {error.message}
        {"\n\n"}
        {error.stack?.slice(0, 800)}
      </div>
    );
  }
}
