import { Component, type ReactNode } from "react";
import { ErrorFallback } from "@/components/error-fallback";
import { logError } from "@/lib/feedback";

export class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false };

  static getDerivedStateFromError(): { hasError: boolean } {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    logError("error-boundary", error);
  }

  render() {
    if (this.state.hasError) return <ErrorFallback />;
    return this.props.children;
  }
}
