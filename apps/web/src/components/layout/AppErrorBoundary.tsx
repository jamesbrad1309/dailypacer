import { Component, type ErrorInfo, type ReactNode } from "react";
import { AppCrash } from "#components/layout/AppCrash";

interface State {
  error: unknown;
}

/**
 * The last line of defence, around the router and Apollo: anything that
 * throws outside a route (a provider, the router itself) shows a recovery
 * page instead of a blank screen. Errors inside routes never reach this;
 * the router catches them first (RouteError, and AppCrash for the shell).
 */
export class AppErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: unknown): State {
    return { error: error ?? new Error("Unknown error") };
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    console.error("[LifeOS] uncaught render error", error, info.componentStack);
  }

  render() {
    return this.state.error ? <AppCrash error={this.state.error} /> : this.props.children;
  }
}
