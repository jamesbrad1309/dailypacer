import { Component, type ErrorInfo, type ReactNode } from "react";
import { AppCrash } from "#components/AppCrash";

interface State {
  error: unknown;
}

/**
 * The last line of defence, around Apollo and the router: anything that
 * throws outside a route shows a recovery page instead of a blank screen.
 */
export class AppErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: unknown): State {
    return { error: error ?? new Error("Unknown error") };
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    console.error("[DailyPacer Admin] uncaught render error", error, info.componentStack);
  }

  render() {
    return this.state.error ? <AppCrash error={this.state.error} /> : this.props.children;
  }
}
