import { useRef, useEffect, useState } from "react";
import { useAuth } from "../context/AuthProvider";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert } from "@/components/ui/alert";
import AuthShell from "@/components/AuthShell";
import { Loader2, AlertTriangle, Eye, EyeOff, Mail, Lock } from "lucide-react";

const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour >= 6 && hour < 12) return "Bonjour";
  if (hour >= 12 && hour < 18) return "Bon après-midi";
  return "Bonsoir";
};

const GoogleIcon = () => (
  <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
  </svg>
);

const XIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);

const LoginPage: React.FC = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { signIn, signInWithGoogle, signInWithX, resendConfirmation, user, loginAsDemo } = useAuth();
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
      setResendMsg("Email de confirmation envoyé. Vérifiez votre boîte de réception.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible de renvoyer l'email.");
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
      setError(err instanceof Error ? err.message : "Une erreur est survenue");
      submitSuccess.current = false;
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    try {
      await signInWithGoogle();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible de se connecter avec Google");
    }
  };

  const handleX = async () => {
    try {
      await signInWithX();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible de se connecter avec X");
    }
  };

  return (
    <AuthShell
      title={getGreeting()}
      subtitle="Sign in to manage your farm operations"
      footer={
        <>
          <div className="flex w-full gap-3">
            <Button
              type="button"
              variant="outline"
              className="flex-1 border-white/10 bg-white/[0.04] text-white hover:bg-white/[0.08] hover:text-white"
              onClick={() => void handleGoogle()}
            >
              <GoogleIcon />
            </Button>
            <Button
              type="button"
              variant="outline"
              className="flex-1 border-white/10 bg-white/[0.04] text-white hover:bg-white/[0.08] hover:text-white"
              onClick={() => void handleX()}
            >
              <XIcon />
            </Button>
          </div>
          <Button
            type="button"
            variant="ghost"
            className="w-full text-white/50 hover:text-white/80 hover:bg-white/[0.04]"
            onClick={() => { loginAsDemo('admin'); navigate('/dashboard', { replace: true }); }}
          >
            Continuer en mode démo
          </Button>
          <div className="w-full flex items-center gap-3 text-white/20">
            <div className="flex-1 h-px bg-white/10" />
            <span className="text-xs">ou continuer avec</span>
            <div className="flex-1 h-px bg-white/10" />
          </div>
        </>
      }
    >
      {error && (
        <Alert variant="destructive" className="mb-4 border-red-500/30 bg-red-500/10 text-red-300">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span className="ml-3">{error}</span>
        </Alert>
      )}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email" className="font-medium text-white/70">
            Email
          </Label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
            <Input
              id="email"
              type="email"
              placeholder="votre@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={loading}
              className="h-11 pl-10 border-white/10 bg-white/[0.05] text-white placeholder:text-white/25 focus-visible:ring-emerald-500/50"
              autoComplete="email"
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="password" className="font-medium text-white/70">
            Mot de passe
          </Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={loading}
              className="h-11 pl-10 pr-10 border-white/10 bg-white/[0.05] text-white placeholder:text-white/25 focus-visible:ring-emerald-500/50"
              autoComplete="current-password"
            />
            <button
              type="button"
              onClick={() => setShowPassword((s) => !s)}
              disabled={loading}
              aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-white/30 hover:text-white/70"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>
        <Button type="submit" className="w-full h-11 bg-emerald-500 hover:bg-emerald-600 text-white font-medium shadow-lg shadow-emerald-500/25" disabled={loading}>
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Connexion...
            </>
          ) : (
            "Se connecter"
          )}
        </Button>
        {resendMsg && <p className="text-sm text-emerald-400 text-center">{resendMsg}</p>}
        <div className="text-center text-sm">
          <button
            type="button"
            onClick={() => void handleResend()}
            disabled={resending || loading || !email}
            className="font-medium text-white/40 hover:text-white/70 disabled:opacity-50 transition-colors"
          >
            {resending ? "Envoi en cours..." : "Renvoyer l'email de confirmation"}
          </button>
        </div>
        <div className="text-center text-sm text-white/40 pt-2">
          Pas encore de compte ?{" "}
          <a href="/register" className="font-medium text-emerald-400 hover:text-emerald-300 transition-colors">
            Créer un compte
          </a>
        </div>
      </form>
    </AuthShell>
  );
};

export default LoginPage;