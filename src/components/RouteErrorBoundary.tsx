import { Component, ReactNode } from "react";
import * as Sentry from "@sentry/react";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

interface Props {
  children: ReactNode;
  resetKey?: string;
}
interface State {
  error: Error | null;
}

export default class RouteErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidUpdate(prevProps: Props) {
    if (this.state.error && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ error: null });
    }
  }

  componentDidCatch(error: Error, info: unknown) {
    try {
      Sentry.captureException(error, { extra: { info } });
    } catch {
      /* noop */
    }
    console.error("[RouteErrorBoundary]", error);
  }

  reset = () => this.setState({ error: null });

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="container mx-auto py-24 flex flex-col items-center text-center gap-4">
        <div className="h-14 w-14 rounded-full bg-destructive/10 flex items-center justify-center text-destructive">
          <AlertTriangle className="h-7 w-7" />
        </div>
        <h1 className="font-heading text-2xl">Something went wrong</h1>
        <p className="text-muted-foreground max-w-md">
          This page hit an unexpected error. Our team was notified. You can try again or head home.
        </p>
        <div className="flex gap-2">
          <Button onClick={this.reset} variant="outline">
            Try again
          </Button>
          <Button onClick={() => (window.location.href = "/")}>Go home</Button>
        </div>
      </div>
    );
  }
}
