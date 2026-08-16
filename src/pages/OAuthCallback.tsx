import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { Sprout } from "lucide-react";

export default function OAuthCallback() {
  const navigate = useNavigate();
  const [status, setStatus] = useState("Connexion en cours...");

  useEffect(() => {
    const handleCallback = async () => {
      try {
        const { search, hash } = window.location;
        const params = new URLSearchParams(search);
        const hashParams = new URLSearchParams(hash.substring(1));
        const code = params.get("code");
        const error = params.get("error");
        const errorDescription = params.get("error_description");

        if (error) {
          setStatus(`Erreur: ${errorDescription || error}`);
          setTimeout(() => navigate("/login", { replace: true }), 3000);
          return;
        }

        if (code) {
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          if (exchangeError) {
            setStatus("Échec de l'authentification");
            setTimeout(() => navigate("/login", { replace: true }), 3000);
            return;
          }
          navigate("/dashboard", { replace: true });
          return;
        }

        const accessToken = hashParams.get("access_token");
        if (accessToken) {
          const refreshToken = hashParams.get("refresh_token");
          await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken || "",
          });
          navigate("/dashboard", { replace: true });
          return;
        }

        setStatus("Aucun token reçu. Redirection...");
        setTimeout(() => navigate("/login", { replace: true }), 3000);
      } catch {
        setStatus("Erreur de connexion");
        setTimeout(() => navigate("/login", { replace: true }), 3000);
      }
    };

    void handleCallback();
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#1a0a0a] via-[#1c0e0e] to-[#0f0505]">
      <div className="flex flex-col items-center gap-4">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500 text-white shadow-xl shadow-emerald-500/30 animate-pulse">
          <Sprout className="h-7 w-7" />
        </div>
        <div className="text-center">
          <p className="text-white/90 font-medium">{status}</p>
          <p className="text-sm text-white/40 mt-1">Veuillez patienter...</p>
        </div>
        <div className="h-1 w-32 rounded-full bg-white/10 overflow-hidden mt-2">
          <div className="h-full w-1/3 rounded-full bg-emerald-500 animate-[shimmer_1.5s_infinite]" />
        </div>
      </div>
    </div>
  );
}