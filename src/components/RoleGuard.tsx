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
  const { user, switchRole } = useAuth();
  const allowed = hasPermission(user?.role, action, resource);

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
            Votre rôle actuel (<Badge className="capitalize font-mono">{user?.role || 'Guest'}</Badge>) n'a pas les autorisations nécessaires pour accéder à ce module ({resource}).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 pt-2 text-center">
          <p className="text-xs text-slate-600">
            Pour la démonstration, vous pouvez passer sur un rôle Administrateur ou Manager ci-dessous :
          </p>
          <div className="flex justify-center gap-2">
            <Button
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs"
              onClick={() => switchRole('admin')}
            >
              👑 Passer Administrateur
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="border-amber-600 text-amber-700 hover:bg-amber-100 text-xs"
              onClick={() => switchRole('manager')}
            >
              📊 Passer Manager
            </Button>
          </div>
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
