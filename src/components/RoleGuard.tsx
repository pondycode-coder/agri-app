import React from 'react';
import { useAuth } from '@/context/AuthProvider';
import { Resource, PermissionAction, hasPermission } from '@/utils/rbac';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ShieldAlert, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

interface RoleGuardProps {
  children: React.ReactNode;
  resource: Resource;
  action?: PermissionAction;
  fallback?: React.ReactNode;
}

export const RoleGuard: React.FC<RoleGuardProps> = ({
  children,
  resource,
  action = 'view',
  fallback,
}) => {
  const { effectiveRole } = useAuth();
  const allowed = hasPermission(effectiveRole, action, resource);

  if (allowed) {
    return <>{children}</>;
  }

  if (fallback) {
    return <>{fallback}</>;
  }

  return (
    <div className="py-12 px-4 max-w-lg mx-auto">
      <Card className="border-amber-200 bg-amber-50/50 shadow-md">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center text-amber-600 mb-2">
            <ShieldAlert className="h-6 w-6" />
          </div>
          <CardTitle className="text-lg font-bold text-slate-900">
            Accès Restreint par Rôle
          </CardTitle>
          <CardDescription>
            Votre rôle actuel (<Badge className="capitalize font-mono">{effectiveRole || 'Guest'}</Badge>) n'a pas les autorisations nécessaires pour accéder à ce module ({resource}). Contactez un administrateur si vous pensez que c'est une erreur.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 pt-2 text-center">
          <div className="pt-2">
            <Button variant="ghost" size="sm" asChild>
              <Link to="/dashboard">
                <ArrowLeft className="h-4 w-4 mr-1.5" />
                Retour au Tableau de bord
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
