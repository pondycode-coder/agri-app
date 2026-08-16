import { useEffect, useState } from 'react';
import { MainLayout } from '@/components/MainLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useI18n } from '@/context/I18nProvider';
import { useAuth } from '@/context/AuthProvider';
import { dbStore } from '@/services/store';
import { UserCircle, Database, ShieldCheck } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

import initSql from '../../supabase/migrations/20260809000000_init.sql?raw';
import userFarmsSql from '../../supabase/migrations/20260809000002_user_farms.sql?raw';
import joinFarmSql from '../../supabase/migrations/20260809000003_create_join_farm.sql?raw';
import seedSql from '../../supabase/migrations/20260809000004_seed_demo.sql?raw';
import superadminSql from '../../supabase/migrations/20260809000005_superadmin.sql?raw';
import workerWagesSql from '../../supabase/migrations/20260809000006_task_worker_wages.sql?raw';
import ensureProfileSql from '../../supabase/migrations/20260809000007_ensure_profile.sql?raw';
import ensureProfileIdempotentSql from '../../supabase/migrations/20260809000008_ensure_profile_idempotent.sql?raw';
import taskAdvancesSql from '../../supabase/migrations/20260809000009_task_advances.sql?raw';
import authEventsSql from '../../supabase/migrations/20260816000010_auth_events.sql?raw';

// The full, current schema (every migration in order) so "Copy SQL" bootstraps
// a complete database — including workers, farm_tasks, contacts, financials, etc.
const MIGRATION_SQL = [
  initSql,
  userFarmsSql,
  joinFarmSql,
  seedSql,
  superadminSql,
  workerWagesSql,
  ensureProfileSql,
  ensureProfileIdempotentSql,
  taskAdvancesSql,
  authEventsSql,
].join('\n\n-- ------------------------------------------------------------------\n\n');

export default function Profile() {
  const { t } = useI18n();
  const { user, switchRole } = useAuth();
  const { toast } = useToast();
  const [, setTick] = useState(0);
  const [sqlCopied, setSqlCopied] = useState(false);

  useEffect(() => {
    const unsub = dbStore.subscribe(() => setTick((p) => p + 1));
    return unsub;
  }, []);

  const isSupabaseConfigured = !!(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY);

  const handleCopySql = () => {
    navigator.clipboard.writeText(MIGRATION_SQL);
    setSqlCopied(true);
    toast({ title: t('profile.sqlCopied') });
    setTimeout(() => setSqlCopied(false), 2000);
  };

  const roleLabels: Record<string, { label: string; color: string }> = {
    admin: { label: 'Administrateur', color: 'bg-emerald-100 text-emerald-800' },
    manager: { label: 'Manager Ferme', color: 'bg-amber-100 text-amber-800' },
    worker: { label: 'Ouvrier', color: 'bg-blue-100 text-blue-800' },
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <UserCircle className="h-6 w-6 text-emerald-600" />
            {t('profile.title')}
          </h1>
          <p className="text-sm text-slate-500 mt-1">{t('profile.subtitle')}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* User Info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserCircle className="h-5 w-5 text-emerald-600" />
                {t('profile.userInfo')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center space-x-4">
                <div className="w-16 h-16 rounded-full bg-emerald-600 text-white font-bold flex items-center justify-center text-2xl">
                  {user?.name ? user.name.charAt(0).toUpperCase() : 'P'}
                </div>
                <div>
                  <p className="text-lg font-bold">{user?.name || 'Pondycode'}</p>
                  <p className="text-sm text-slate-500">{user?.email || 'pondycode@gmail.com'}</p>
                </div>
              </div>
              <div className="pt-2 border-t">
                <p className="text-xs text-slate-500 uppercase mb-2">{t('profile.activeRole')}</p>
                <Badge className={roleLabels[user?.role || 'admin']?.color || ''}>
                  {roleLabels[user?.role || 'admin']?.label || user?.role}
                </Badge>
              </div>
            </CardContent>
          </Card>

          {/* Role Switcher */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-emerald-600" />
                {t('profile.rolePermissions')}
              </CardTitle>
              <CardDescription>{t('profile.switchRoleToTest')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button variant="outline" className="w-full justify-start" onClick={() => switchRole('admin')}>
                <ShieldCheck className="h-4 w-4 mr-2" /> Administrateur — Accès complet
              </Button>
              <Button variant="outline" className="w-full justify-start" onClick={() => switchRole('manager')}>
                <Database className="h-4 w-4 mr-2" /> Manager Ferme — Gestion opérationnelle
              </Button>
              <Button variant="outline" className="w-full justify-start" onClick={() => switchRole('worker')}>
                <UserCircle className="h-4 w-4 mr-2" /> Ouvrier — Consultation limitée
              </Button>
            </CardContent>
          </Card>

          {/* Supabase Config */}
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5 text-emerald-600" />
                {t('profile.supabaseConfig')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                {isSupabaseConfigured ? (
                  <Badge className="bg-emerald-100 text-emerald-800">{t('profile.supabaseConnected')}</Badge>
                ) : (
                  <Badge className="bg-amber-100 text-amber-800">{t('profile.supabaseDemoMode')}</Badge>
                )}
              </div>
              <div>
                <Button variant="outline" onClick={handleCopySql} className="mb-3">
                  {sqlCopied ? '✓ Copié !' : t('profile.copySql')}
                </Button>
                <pre className="bg-slate-900 text-slate-100 rounded-lg p-4 text-xs overflow-auto max-h-64 font-mono">
                  {MIGRATION_SQL}
                </pre>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </MainLayout>
  );
}
