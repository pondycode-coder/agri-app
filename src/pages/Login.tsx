import { useRef, useEffect, useState } from "react";
import { useAuth } from "../context/AuthProvider";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { AlertTriangle, Eye, EyeOff } from "lucide-react";
import { Alert } from "@/components/ui/alert";

const LoginPage: React.FC = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { signIn, resendConfirmation, user } = useAuth();
  const navigate = useNavigate();
  const submitSuccess = useRef(false);
  const [resending, setResending] = useState(false);
  const [resendMsg, setResendMsg] = useState<string | null>(null);

  // Session apply is async (profile fetch + farm activation), so the user is
  // not set the moment signIn resolves. Navigate once the user actually exists
  // to avoid the PrivateRoute bouncing the login attempt back.
  useEffect(() => {
    if (submitSuccess.current && user) {
      navigate("/dashboard", { replace: true });
    }
  }, [user, navigate]);

  const handleResend = async () => {
    if (!email) return;
    setResending(true);
    setResendMsg(null);
    try {
      await resendConfirmation(email);
      setResendMsg("Confirmation email sent. Please check your inbox.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not resend the confirmation email.");
    } finally {
      setResending(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await signIn(email, password);
      submitSuccess.current = true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
      submitSuccess.current = false;
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <Card className="w-full max-w-md space-y-6">
        <CardHeader className="pb-6">
          <CardTitle className="text-2xl font-bold">Welcome to AgriApp</CardTitle>
          <CardDescription className="text-muted-foreground">
            Sign in to manage your farm operations
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span className="ml-3">{error}</span>
            </Alert>
          )}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="font-medium">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="font-medium">
                Password
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={loading}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  disabled={loading}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4" />
                  Signing in...
                </>
              ) : (
                "Sign In"
              )}
            </Button>
            {resendMsg && (
              <p className="text-sm text-emerald-600 text-center">{resendMsg}</p>
            )}
            <div className="text-center text-sm">
              <button
                type="button"
                onClick={() => void handleResend()}
                disabled={resending || loading || !email}
                className="font-medium text-primary hover:underline disabled:opacity-50"
              >
                {resending ? "Sending..." : "Resend confirmation email"}
              </button>
            </div>
          </form>
        </CardContent>
        <CardFooter className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
          <div className="text-sm">
            Don't have an account?{" "}
            <a href="/register" className="font-medium text-primary hover:underline">
              Sign up
            </a>
          </div>
          <div className="text-sm">
            <a href="/forgot-password" className="font-medium text-primary hover:underline">
              Forgot password?
            </a>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
};

export default LoginPage;