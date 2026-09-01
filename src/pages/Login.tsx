import { useRef, useEffect, useState, useCallback } from "react";
import { useAuth } from "../context/AuthProvider";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Alert } from "@/components/ui/alert";
import AuthShell from "@/components/AuthShell";
import { PinInput } from "@/components/PinInput";
import { pinToEmail } from "@/lib/pinAuth";
import { Loader2, AlertTriangle, Hash } from "lucide-react";

const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour >= 6 && hour < 12) return "Bonjour";
  if (hour >= 12 && hour < 18) return "Bon après-midi";
  return "Bonsoir";
};

const LoginPage: React.FC = () => {
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { signIn, user, loginAsDemo } = useAuth();
  const navigate = useNavigate();
  const submitSuccess = useRef(false);

  useEffect(() => {
    if (submitSuccess.current && user) {
      navigate(user.is_superadmin ? "/dashboard/saas-admin" : "/dashboard", { replace: true });
    }
  }, [user, navigate]);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (pin.length !== 4) {
      setError("Le PIN doit contenir 4 chiffres.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await signIn(pinToEmail(pin), pin);
      submitSuccess.current = true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue");
      submitSuccess.current = false;
    } finally {
      setLoading(false);
    }
  }, [pin, signIn]);

  return (
    <AuthShell
      title={getGreeting()}
      subtitle="Connectez-vous avec votre PIN"
      footer={
        <>
          <Button
            type="button"
            variant="ghost"
            className="w-full text-white/50 hover:text-white/80 hover:bg-white/[0.04]"
            onClick={() => { loginAsDemo('admin'); navigate('/dashboard', { replace: true }); }}
          >
            Continuer en mode démo
          </Button>
          <div className="text-center text-sm text-white/40 pt-2">
            Pas encore de compte ?{" "}
            <a href="/register" className="font-medium text-emerald-400 hover:text-emerald-300 transition-colors">
              Créer un compte
            </a>
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
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-3">
          <Label className="font-medium text-white/70 flex items-center gap-2">
            <Hash className="h-4 w-4" />
            Code PIN
          </Label>
          <PinInput value={pin} onChange={setPin} disabled={loading} />
          <p className="text-xs text-center text-white/30">Entrez votre code à 4 chiffres</p>
        </div>
        <Button
          type="submit"
          className="w-full h-11 bg-emerald-500 hover:bg-emerald-600 text-white font-medium shadow-lg shadow-emerald-500/25"
          disabled={loading || pin.length !== 4}
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Connexion...
            </>
          ) : (
            "Se connecter"
          )}
        </Button>
      </form>
    </AuthShell>
  );
};

export default LoginPage;
