import { useState } from "react";
import { useAuth } from "../context/AuthProvider";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert } from "@/components/ui/alert";
import AuthShell from "@/components/AuthShell";
import { PinInput } from "@/components/PinInput";
import { pinToEmail } from "@/lib/pinAuth";
import { Loader2, AlertTriangle, CheckCircle, User, Hash } from "lucide-react";

const RegisterPage: React.FC = () => {
  const [name, setName] = useState("");
  const [pin, setPin] = useState("");
  const [pinConfirm, setPinConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const { signUp } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (pin.length !== 4) {
      setError("Le PIN doit contenir exactement 4 chiffres.");
      return;
    }
    if (pin !== pinConfirm) {
      setError("Les codes PIN ne correspondent pas.");
      return;
    }

    setLoading(true);
    try {
      await signUp(pinToEmail(pin), pin, name, "admin");
      setSuccess("Compte créé ! Redirection...");
      setTimeout(() => navigate("/dashboard", { replace: true }), 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title="Créez votre compte"
      subtitle="Choisissez votre code PIN à 4 chiffres"
      footer={
        <div className="text-center text-sm text-white/40 pt-2">
          Déjà un compte ?{" "}
          <a href="/login" className="font-medium text-emerald-400 hover:text-emerald-300 transition-colors">
            Se connecter
          </a>
        </div>
      }
    >
      {error && (
        <Alert variant="destructive" className="mb-4 border-red-500/30 bg-red-500/10 text-red-300">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span className="ml-3">{error}</span>
        </Alert>
      )}
      {success && (
        <Alert variant="default" className="mb-4 border-emerald-500/30 bg-emerald-500/10 text-emerald-300">
          <CheckCircle className="h-4 w-4 shrink-0" />
          <span className="ml-3">{success}</span>
        </Alert>
      )}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="name" className="font-medium text-white/70">
            Nom complet
          </Label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
            <Input
              id="name"
              type="text"
              placeholder="Votre nom"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              disabled={loading}
              className="h-11 pl-10 border-white/10 bg-white/[0.05] text-white placeholder:text-white/25 focus-visible:ring-emerald-500/50"
              autoComplete="name"
            />
          </div>
        </div>
        <div className="space-y-3">
          <Label className="font-medium text-white/70 flex items-center gap-2">
            <Hash className="h-4 w-4" />
            Code PIN (4 chiffres)
          </Label>
          <PinInput value={pin} onChange={setPin} disabled={loading} />
        </div>
        <div className="space-y-3">
          <Label className="font-medium text-white/70 flex items-center gap-2">
            <Hash className="h-4 w-4" />
            Confirmer le PIN
          </Label>
          <PinInput value={pinConfirm} onChange={setPinConfirm} disabled={loading} />
        </div>
        <Button
          type="submit"
          className="w-full h-11 bg-emerald-500 hover:bg-emerald-600 text-white font-medium shadow-lg shadow-emerald-500/25"
          disabled={loading || pin.length !== 4 || pinConfirm.length !== 4}
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Création du compte...
            </>
          ) : (
            "Créer un compte"
          )}
        </Button>
      </form>
    </AuthShell>
  );
};

export default RegisterPage;
