import { ReactNode } from "react";
import { Sprout, Leaf, Users, TrendingUp, Zap } from "lucide-react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

const FEATURES = [
  { icon: Leaf, text: "Suivez vos parcelles et cultures en temps réel" },
  { icon: Users, text: "Gérez ouvriers, tâches et salaires" },
  { icon: TrendingUp, text: "Revenus, dépenses et ROI par hectare" },
  { icon: Zap, text: "Synchronisation en ligne et hors ligne" },
];

interface AuthShellProps {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer?: ReactNode;
}

export default function AuthShell({ title, subtitle, children, footer }: AuthShellProps) {
  return (
    <div className="min-h-screen grid lg:grid-cols-[1.1fr_0.9fr] bg-gradient-to-br from-[#1a0a0a] via-[#1c0e0e] to-[#0f0505] text-white">
      {/* Left panel — form */}
      <div className="flex min-h-screen items-center justify-center px-4 py-10">
        <div className="w-full max-w-md space-y-6">
          <div className="mb-2 flex items-center gap-2.5 lg:hidden">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500 text-white shadow-lg shadow-emerald-500/30">
              <Sprout className="h-5 w-5" />
            </div>
            <span className="text-lg font-bold tracking-tight">AgriApp</span>
          </div>

          <Card className="border-white/10 bg-white/[0.04] shadow-2xl shadow-black/40 backdrop-blur-xl">
            <CardHeader className="pb-2 pt-8">
              <CardTitle className="text-2xl font-bold text-white">{title}</CardTitle>
              <CardDescription className="text-white/50">{subtitle}</CardDescription>
            </CardHeader>
            <CardContent>{children}</CardContent>
            {footer && <CardFooter className="flex-col gap-3 px-6 pb-6 pt-0">{footer}</CardFooter>}
          </Card>
        </div>
      </div>

      {/* Right panel — brand + features */}
      <div className="relative hidden lg:flex flex-col justify-between overflow-hidden p-12">
        <div className="pointer-events-none absolute -top-32 -right-32 h-[500px] w-[500px] rounded-full bg-emerald-600/10 blur-[120px]" />
        <div className="pointer-events-none absolute bottom-20 -left-24 h-80 w-80 rounded-full bg-rose-500/8 blur-[100px]" />
        <div className="pointer-events-none absolute top-1/3 left-1/2 h-56 w-56 rounded-full bg-emerald-400/5 blur-[80px]" />

        <div className="relative flex items-center gap-2.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500 text-white shadow-lg shadow-emerald-500/25">
            <Sprout className="h-5 w-5" />
          </div>
          <span className="text-lg font-bold tracking-tight">AgriApp</span>
        </div>

        <div className="relative space-y-8">
          {/* Speech bubble */}
          <div className="rounded-2xl bg-white/[0.07] backdrop-blur-md border border-white/[0.08] px-6 py-5 shadow-lg shadow-black/20">
            <p className="text-[15px] leading-relaxed text-white/80">
              Gérez vos exploitations agricoles en un seul endroit. Suivez vos cultures, vos ouvriers et vos finances — en ligne ou hors ligne.
            </p>
            <div className="absolute -bottom-2 left-10 h-4 w-4 rotate-45 bg-white/[0.07] backdrop-blur-md border-r border-b border-white/[0.08]" />
          </div>

          {/* User avatar placeholder */}
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 text-white text-sm font-bold shadow-lg shadow-emerald-500/20">
              AG
            </div>
            <span className="text-sm text-white/60">Administrateur</span>
          </div>

          {/* Features */}
          <ul className="space-y-3.5">
            {FEATURES.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/[0.06] border border-white/[0.06]">
                  <Icon className="h-4 w-4 text-emerald-400" />
                </span>
                <span className="text-sm text-white/70">{text}</span>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-white/25">© 2026 AgriApp — Gestion agricole intelligente</p>
      </div>
    </div>
  );
}