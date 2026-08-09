import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  message?: string;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  private reload = () => {
    window.location.href = "/dashboard";
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
          <Card className="max-w-md w-full text-center">
            <CardHeader>
              <CardTitle className="text-2xl">Oups ! Une erreur est survenue</CardTitle>
              <CardDescription>
                L'application a rencontré un problème inattendu. Vos données locales restent en sécurité.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {this.state.message && (
                <pre className="text-xs text-left bg-slate-100 text-slate-700 rounded-lg p-3 overflow-auto">
                  {this.state.message}
                </pre>
              )}
              <Button onClick={this.reload}>Recharger l'application</Button>
            </CardContent>
          </Card>
        </div>
      );
    }
    return this.props.children;
  }
}
