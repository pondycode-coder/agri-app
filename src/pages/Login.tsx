import { useRef, useEffect, useState } from "react";
import { useAuth } from "../context/AuthProvider";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert } from "@/components/ui/alert";
import AuthShell from "@/components/AuthShell";
import { Loader2, AlertTriangle, Eye, EyeOff, Mail, Lock } from "lucide-react";

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
    <AuthShell
      title="Welcome back"
      subtitle="Sign in to manage your farm operations"
      footer={
        <div className="flex w-full flex-col sm:flex-row sm:justify-between sm:items-center gap-3 text-sm">
          <div className="text-slate-500">
            Don't have an account?{" "}
            <a href="/register" className="font-medium text-primary hover:underline">
              Sign up
            </a>
          </div>
          <div>
            <a href="/forgot-password" className="font-medium text-primary hover:underline">
              Forgot password?
            </a>
          </div>
        </div>
      }
    >
      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span className="ml-3">{error}</span>
        </Alert>
      )}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email" className="font-medium">
            Email
          </Label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              id="email"
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={loading}
              className="pl-10"
              autoComplete="email"
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="password" className="font-medium">
            Password
          </Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={loading}
              className="pl-10 pr-10"
              autoComplete="current-password"
            />
            <button
              type="button"
              onClick={() => setShowPassword((s) => !s)}
              disabled={loading}
              aria-label={showPassword ? "Hide password" : "Show password"}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Signing in...
            </>
          ) : (
            "Sign In"
          )}
        </Button>
        {resendMsg && <p className="text-sm text-emerald-600 text-center">{resendMsg}</p>}
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
    </AuthShell>
  );
};

export default LoginPage;