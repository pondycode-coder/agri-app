import { ReactNode } from "react";
import { Sprout, Leaf, TrendingUp, Users } from "lucide-react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

const FEATURES = [
  { icon: Leaf, text: "Suivez parcelles, cultures et récoltes" },
  { icon: Users, text: "Gérez ouvriers, tâches et salaires" },
  { icon: TrendingUp, text: "Analysez revenus et dépenses" },
];

interface AuthShellProps {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer?: ReactNode;
}

export default function AuthShell({ title, subtitle, children, footer }: AuthShellProps) {
  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-slate-50">
      <div className="relative hidden lg:flex flex-col justify-between overflow-hidden bg-gradient-to-br from-emerald-600 via-emerald-700 to-green-950 p-12 text-white">
        <div className="pointer-events-none absolute -top-24 -right-24 h-96 w-96 rounded-full bg-emerald-400/20 blur-3xl" />
        <div className="pointer-events-none absolute bottom-10 -left-20 h-72 w-72 rounded-full bg-lime-300/10 blur-3xl" />
        <div className="pointer-events-none absolute top-1/2 left-1/3 h-40 w-40 rounded-full bg-emerald-300/10 blur-2xl" />

        <div className="relative flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/25 backdrop-blur">
            <Sprout className="h-6 w-6" />
          </div>
          <span className="text-xl font-bold tracking-tight">AgriApp</span>
        </div>

        <div className="relative max-w-md">
          <h1 className="text-4xl font-bold leading-tight">Pilotez votre exploitation agricole</h1>
          <p className="mt-4 text-lg text-emerald-100/90">
            Gérez vos parcelles, vos équipes et vos finances au même endroit.
          </p>
          <ul className="mt-10 space-y-4">
            {FEATURES.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3 text-emerald-50/95">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10 ring-1 ring-white/20">
                  <Icon className="h-5 w-5" />
                </span>
                <span>{text}</span>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-sm text-emerald-200/70">© 2026 AgriApp — Gestion agricole intelligente</p>
      </div>

      <div className="flex min-h-screen items-center justify-center px-4 py-10">
        <div className="w-full max-w-md">
          <div className="mb-6 flex items-center justify-center gap-2 lg:hidden">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-lg shadow-emerald-600/25">
              <Sprout className="h-5 w-5" />
            </div>
            <span className="text-lg font-bold">AgriApp</span>
          </div>

          <Card className="border-slate-200/80 shadow-xl shadow-slate-200/60">
            <CardHeader className="pb-6 pt-8 text-center">
              <CardTitle className="text-2xl font-bold text-slate-900">{title}</CardTitle>
              <CardDescription className="text-muted-foreground">{subtitle}</CardDescription>
            </CardHeader>
            <CardContent>{children}</CardContent>
            {footer && <CardFooter className="flex-col gap-3 pt-0">{footer}</CardFooter>}
          </Card>
        </div>
      </div>
    </div>
  );
}