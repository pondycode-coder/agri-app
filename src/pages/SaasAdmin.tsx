import { useCallback, useEffect, useState } from 'react';
import { MainLayout } from '@/components/MainLayout';
import { useAuth } from '@/context/AuthProvider';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { useI18n } from '@/context/I18nProvider';
import {
  adminStats,
  adminListFarms,
  adminListUsers,
  adminListAuthEvents,
  adminSetRole,
  adminSetSuperadmin,
  adminDeleteFarm,
  adminMoveUser,
  adminSetPin,
  adminListPermissions,
  adminSetPermission,
  adminResetPermissions,
} from '@/lib/remoteSync';
import { AdminFarm, AdminStats, AdminUser, AppRole, AuthEvent, formatFCFA } from '@/types/database';
import { ShieldCheck, Building2, Users, LandPlot, ListChecks, Wallet, Trash2, RefreshCw, Ban, Check, LogIn, LogOut, Key, Edit3 } from 'lucide-react';
import { isSupabaseConfigured } from '@/lib/supabase';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { PinInput } from '@/components/PinInput';
import { Checkbox } from '@/components/ui/checkbox';
import { ALL_RESOURCES, PermissionAction } from '@/utils/rbac';

type PermMap = Record<string, Record<string, Record<string, boolean>>>;

const EDITABLE_ROLES: AppRole[] = ['manager', 'worker'];
const EDITABLE_ACTIONS: PermissionAction[] = ['view', 'create', 'edit', 'delete'];

const buildEmptyPerms = (): PermMap =>
  Object.fromEntries(
    EDITABLE_ROLES.map((role) => [
      role,
      Object.fromEntries(
        ALL_RESOURCES.map((res) => [res, Object.fromEntries(EDITABLE_ACTIONS.map((a) => [a, false]))]),
      ),
    ]),
  );

export default function SaasAdmin() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { t, locale } = useI18n();

  const RESOURCE_LABELS: Record<string, string> = {
    farms: t('saas.resFarm'),
    plots: t('saas.resPlot'),
    crops: t('saas.resCrop'),
    inventory: t('saas.resInventory'),
    workers: t('saas.resWorker'),
    tasks: t('saas.resTask'),
    financials: t('saas.resFinancial'),
    contacts: t('saas.resContact'),
    investments: t('saas.resInvestment'),
    profile: t('saas.resProfile'),
    dashboard: t('saas.resDashboard'),
  };
  const ROLE_LABELS: Record<string, string> = { manager: t('saas.roleManager'), worker: t('saas.roleWorker') };
  const ACTION_LABELS: Record<string, string> = {
    view: t('saas.permsActionView'),
    create: t('saas.permsActionCreate'),
    edit: t('saas.permsActionEdit'),
    delete: t('saas.permsActionDelete'),
  };
  const localeTag = locale === 'en' ? 'en-US' : 'fr-FR';

  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [farms, setFarms] = useState<AdminFarm[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [events, setEvents] = useState<AuthEvent[]>([]);
  const [pinDialogOpen, setPinDialogOpen] = useState(false);
  const [pinTargetUser, setPinTargetUser] = useState<{ id: string; name: string } | null>(null);
  const [newPin, setNewPin] = useState('');
  const [pinSaving, setPinSaving] = useState(false);
  const [perms, setPerms] = useState<PermMap>(buildEmptyPerms);
  const [permsBase, setPermsBase] = useState<PermMap | null>(null);
  const [permsDirty, setPermsDirty] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [s, f, u, e] = await Promise.all([adminStats(), adminListFarms(), adminListUsers(), adminListAuthEvents()]);
    setStats(s);
    setFarms(f);
    setUsers(u);
    setEvents(e);
    void loadPerms();
    setLoading(false);
  }, []);

  const loadPerms = useCallback(async () => {
    const rows = await adminListPermissions();
    const map = buildEmptyPerms();
    for (const row of rows) {
      if (map[row.role]?.[row.resource]?.[row.action] !== undefined) {
        map[row.role][row.resource][row.action] = true;
      }
    }
    setPerms(map);
    setPermsBase(map);
    setPermsDirty(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const runAction = async (action: () => Promise<boolean>, okTitle: string) => {
    setBusy(true);
    try {
      const ok = await action();
      toast(ok ? { title: okTitle } : { title: t('saas.toast.denied'), variant: 'destructive' });
      await load();
    } finally {
      setBusy(false);
    }
  };

  const handleRoleChange = (userId: string, role: AppRole) =>
    runAction(() => adminSetRole(userId, role), t('saas.toast.roleUpdated'));

  const handleSuperadminToggle = (u: AdminUser) =>
    runAction(
      () => adminSetSuperadmin(u.id, !u.is_superadmin),
      u.is_superadmin ? t('saas.toast.superadminRevoked') : t('saas.toast.superadminGranted'),
    );

  const handleMoveUser = (userId: string, farmId: string) =>
    runAction(() => adminMoveUser(userId, farmId), t('saas.toast.userMoved'));

  const handleDeleteFarm = (farmId: string) =>
    runAction(() => adminDeleteFarm(farmId), t('saas.toast.farmDeleted'));

  const openPinDialog = (userId: string, userName: string) => {
    setPinTargetUser({ id: userId, name: userName });
    setNewPin('');
    setPinDialogOpen(true);
  };

  const handleSavePin = async () => {
    if (!pinTargetUser || newPin.length !== 4) return;
    setPinSaving(true);
    try {
      const ok = await adminSetPin(pinTargetUser.id, newPin);
      if (ok) {
        toast({ title: `${t('saas.toast.pinUpdated')} ${pinTargetUser.name}` });
        setPinDialogOpen(false);
        await load();
      }
    } catch (err) {
      toast({ title: t('saas.toast.pinUpdateFailed'), description: err instanceof Error ? err.message : undefined, variant: 'destructive' });
    } finally {
      setPinSaving(false);
    }
  };

  const togglePerm = (role: string, resource: string, action: string) => {
    const next = JSON.parse(JSON.stringify(perms)) as PermMap;
    const value = next[role]?.[resource]?.[action];
    if (value === undefined) return;
    next[role][resource][action] = !value;
    setPerms(next);
    setPermsDirty(true);
  };

  const savePerms = async () => {
    if (!permsBase) return;
    setBusy(true);
    try {
      const changes: Array<{ role: AppRole; resource: string; action: PermissionAction; allowed: boolean }> = [];
      for (const role of EDITABLE_ROLES) {
        for (const res of ALL_RESOURCES) {
          for (const action of EDITABLE_ACTIONS) {
            const now = perms[role]?.[res]?.[action] ?? false;
            const base = permsBase[role]?.[res]?.[action] ?? false;
            if (now !== base) changes.push({ role, resource: res, action, allowed: now });
          }
        }
      }
      if (changes.length === 0) {
        toast({ title: t('saas.toast.noPermChanges') });
        return;
      }
      for (const c of changes) {
        const ok = await adminSetPermission(c.role, c.resource, c.action, c.allowed);
        if (!ok) {
          toast({ title: t('saas.toast.permsUpdateFailed'), variant: 'destructive' });
          return;
        }
      }
      toast({ title: `${changes.length} ${t('saas.toast.permsUpdatedCount')}` });
      await loadPerms();
    } finally {
      setBusy(false);
    }
  };

  const resetPerms = async () => {
    setBusy(true);
    try {
      const ok = await adminResetPermissions();
      toast(
        ok
          ? { title: t('saas.toast.permsResetDone') }
          : { title: t('saas.toast.denied'), variant: 'destructive' },
      );
      await loadPerms();
    } finally {
      setBusy(false);
    }
  };

  if (!user?.is_superadmin) {
    return (
      <MainLayout>
        <Card className="max-w-xl mx-auto mt-10">
          <CardContent className="pt-6 text-center space-y-3">
            <ShieldCheck className="h-10 w-10 mx-auto text-slate-400" />
            <h2 className="text-xl font-bold">{t('saas.unauthorized')}</h2>
            <p className="text-sm text-slate-500">{t('saas.unauthorizedDesc')}</p>
          </CardContent>
        </Card>
      </MainLayout>
    );
  }

  const statCards: Array<{ label: string; value: string; icon: typeof Building2 }> = [
    { label: t('saas.statFarms'), value: String(stats?.total_farms ?? 0), icon: Building2 },
    { label: t('saas.statUsers'), value: String(stats?.total_users ?? 0), icon: Users },
    { label: t('saas.statPlots'), value: String(stats?.total_plots ?? 0), icon: LandPlot },
    { label: t('saas.statWorkers'), value: String(stats?.total_workers ?? 0), icon: Users },
    { label: t('saas.statTasks'), value: String(stats?.total_tasks ?? 0), icon: ListChecks },
    { label: t('saas.statIncome'), value: formatFCFA(stats?.total_income ?? 0), icon: Wallet },
    { label: t('saas.statExpenses'), value: formatFCFA(stats?.total_expenses ?? 0), icon: Wallet },
  ];

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <ShieldCheck className="h-6 w-6 text-amber-500" />
              {t('saas.title')}
            </h1>
            <p className="text-sm text-slate-500 mt-1">{t('saas.subtitle')}</p>
          </div>
          <Button variant="outline" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            {t('saas.refresh')}
          </Button>
        </div>

        {!isSupabaseConfigured() && (
          <Card className="border-amber-300 bg-amber-50 dark:bg-amber-950/30">
            <CardContent className="pt-6 text-sm text-amber-800 dark:text-amber-200">
              {t('saas.demoModeNotice')}
            </CardContent>
          </Card>
        )}

        {/* Platform stats */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
          {statCards.map(({ label, value, icon: Icon }) => (
            <Card key={label}>
              <CardContent className="pt-5 space-y-1">
                <Icon className="h-4 w-4 text-emerald-600" />
                <div className="text-lg font-bold">{value}</div>
                <div className="text-xs text-slate-500">{label}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Tabs defaultValue="farms">
          <TabsList>
            <TabsTrigger value="farms">{t('saas.tabFarms')} ({farms.length})</TabsTrigger>
            <TabsTrigger value="users">{t('saas.tabUsers')} ({users.length})</TabsTrigger>
            <TabsTrigger value="activity">{t('saas.tabActivity')} ({events.length})</TabsTrigger>
            <TabsTrigger value="permissions">{t('saas.tabPermissions')}</TabsTrigger>
          </TabsList>

          <TabsContent value="farms" className="space-y-4">
            <Card>
              <CardContent className="pt-6">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('saas.farmColName')}</TableHead>
                      <TableHead>{t('saas.farmColLocation')}</TableHead>
                      <TableHead>{t('saas.farmColHa')}</TableHead>
                      <TableHead>{t('saas.farmColPlots')}</TableHead>
                      <TableHead>{t('saas.farmColMembers')}</TableHead>
                      <TableHead>{t('saas.farmColIncome')}</TableHead>
                      <TableHead>{t('saas.farmColExpenses')}</TableHead>
                      <TableHead>{t('saas.farmColCreated')}</TableHead>
                      <TableHead className="text-right">{t('saas.farmColAction')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {farms.map((farm) => (
                      <TableRow key={farm.id}>
                        <TableCell className="font-medium">{farm.name}</TableCell>
                        <TableCell>{farm.location || '—'}</TableCell>
                        <TableCell>{farm.size_in_hectares}</TableCell>
                        <TableCell>{farm.plots}</TableCell>
                        <TableCell>{farm.users_count}</TableCell>
                        <TableCell>{formatFCFA(farm.total_income)}</TableCell>
                        <TableCell>{formatFCFA(farm.total_expenses)}</TableCell>
                        <TableCell>{new Date(farm.created_at).toLocaleDateString(localeTag)}</TableCell>
                        <TableCell className="text-right">
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-600 hover:bg-red-50" disabled={busy}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>
                                  {t('saas.farmDeleteTitle')} « {farm.name} » ?
                                </AlertDialogTitle>
                                <AlertDialogDescription>
                                  {t('saas.farmDeleteDesc')}
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel disabled={busy}>{t('common.cancel')}</AlertDialogCancel>
                                <AlertDialogAction onClick={() => void handleDeleteFarm(farm.id)} disabled={busy} className="bg-red-600 hover:bg-red-700">
                                  {t('common.delete')}
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </TableCell>
                      </TableRow>
                    ))}
                    {farms.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center text-slate-400 py-6">
                          {t('saas.emptyFarms')}
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="users" className="space-y-4">
            <Card>
              <CardContent className="pt-6">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('saas.userColName')}</TableHead>
                      <TableHead>{t('saas.userColEmail')}</TableHead>
                      <TableHead>{t('saas.userColRole')}</TableHead>
                      <TableHead>{t('saas.userColFarm')}</TableHead>
                      <TableHead>{t('saas.userColSuperadmin')}</TableHead>
                      <TableHead>{t('saas.userColPin')}</TableHead>
                      <TableHead>{t('saas.userColCreated')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((u) => (
                      <TableRow key={u.id}>
                        <TableCell className="font-medium">{u.name || '—'}</TableCell>
                        <TableCell>{u.email}</TableCell>
                        <TableCell>
                          <Select value={u.role} onValueChange={(v) => void handleRoleChange(u.id, v as AppRole)} disabled={busy}>
                            <SelectTrigger className="w-32 h-8 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="admin">{t('saas.roleAdmin')}</SelectItem>
                              <SelectItem value="manager">{t('saas.roleManager')}</SelectItem>
                              <SelectItem value="worker">{t('saas.roleWorker')}</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Select
                            value={u.farm_id || 'none'}
                            onValueChange={(v) => v !== 'none' && void handleMoveUser(u.id, v)}
                            disabled={busy}
                          >
                            <SelectTrigger className="w-44 h-8 text-xs">
                              <SelectValue placeholder={u.farm_name || t('saas.noFarm')} />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none" disabled>
                                {u.farm_name || t('saas.noFarm')}
                              </SelectItem>
                              {farms
                                .filter((f) => f.id !== u.farm_id)
                                .map((f) => (
                                  <SelectItem key={f.id} value={f.id}>
                                    {f.name}
                                  </SelectItem>
                                ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            variant={u.is_superadmin ? 'default' : 'outline'}
                            className={u.is_superadmin ? 'bg-amber-500 hover:bg-amber-600 text-white' : ''}
                            onClick={() => void handleSuperadminToggle(u)}
                            disabled={busy}
                          >
                            {u.is_superadmin ? <Check className="h-3.5 w-3.5 mr-1.5" /> : <Ban className="h-3.5 w-3.5 mr-1.5" />}
                            {u.is_superadmin ? t('saas.superadmin') : t('saas.promote')}
                          </Button>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className={`font-mono font-semibold ${u.pin ? 'text-slate-800 dark:text-slate-200' : 'text-slate-400'}`}>
                              {u.pin ?? '—'}
                            </span>
                            <Button
                              size="sm"
                              variant={u.pin ? 'ghost' : 'outline'}
                              className="h-8 text-xs"
                              onClick={() => openPinDialog(u.id, u.name || u.email)}
                              disabled={busy}
                            >
                              {u.pin ? <Edit3 className="h-3.5 w-3.5 mr-1" /> : <Key className="h-3.5 w-3.5 mr-1" />}
                              {u.pin ? t('saas.editPin') : t('saas.setPin')}
                            </Button>
                          </div>
                        </TableCell>
                        <TableCell>{new Date(u.created_at).toLocaleDateString(localeTag)}</TableCell>
                      </TableRow>
                    ))}
                    {users.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-slate-400 py-6">
                          {t('saas.emptyUsers')}
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="activity" className="space-y-4">
            <Card>
              <CardContent className="pt-6">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('saas.activityColUser')}</TableHead>
                      <TableHead>{t('saas.activityColFarm')}</TableHead>
                      <TableHead>{t('saas.activityColEvent')}</TableHead>
                      <TableHead>{t('saas.activityColDate')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {events.map((ev) => (
                      <TableRow key={ev.id}>
                        <TableCell>
                          <div className="font-medium">{ev.user_name || '—'}</div>
                          <div className="text-xs text-slate-500">{ev.user_email}</div>
                        </TableCell>
                        <TableCell>{ev.farm_name || '—'}</TableCell>
                        <TableCell>
                          {ev.event_type === 'login' ? (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                              <LogIn className="h-3.5 w-3.5" /> {t('saas.eventLogin')}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-100 px-2 py-0.5 text-xs font-medium text-rose-700">
                              <LogOut className="h-3.5 w-3.5" /> {t('saas.eventLogout')}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-slate-500">
                          {new Date(ev.created_at).toLocaleString(localeTag)}
                        </TableCell>
                      </TableRow>
                    ))}
                    {events.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-slate-400 py-6">
                          {t('saas.emptyActivity')}
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        <TabsContent value="permissions" className="space-y-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                  <div>
                    <p className="text-sm font-semibold">{t('saas.permsTitle')}</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {t('saas.permsDesc')} <b>{t('saas.roleAdmin')}</b> {t('saas.permsAdminNote')}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => void resetPerms()} disabled={busy}>
                      {t('saas.permsReset')}
                    </Button>
                    <Button
                      size="sm"
                      className="bg-emerald-600 hover:bg-emerald-700"
                      onClick={() => void savePerms()}
                      disabled={busy || !permsDirty}
                    >
                      {busy ? t('saas.permsSaving') : t('saas.permsSave')}
                    </Button>
                  </div>
                </div>

                {EDITABLE_ROLES.map((role) => (
                  <div key={role} className="mb-8 last:mb-0">
                    <Badge
                      className={`mb-2 text-white ${
                        role === 'manager' ? 'bg-amber-600 hover:bg-amber-700' : 'bg-blue-600 hover:bg-blue-700'
                      }`}
                    >
                      {ROLE_LABELS[role] || role}
                    </Badge>
                    <div className="rounded-lg border overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-48">{t('saas.permsModule')}</TableHead>
                            {EDITABLE_ACTIONS.map((a) => (
                              <TableHead key={a} className="text-center min-w-20">
                                {ACTION_LABELS[a]}
                              </TableHead>
                            ))}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {ALL_RESOURCES.map((res) => (
                            <TableRow key={res}>
                              <TableCell className="font-medium">{RESOURCE_LABELS[res] || res}</TableCell>
                              {EDITABLE_ACTIONS.map((a) => (
                                <TableCell key={a} className="text-center">
                                  {perms[role]?.[res]?.[a] !== undefined && (
                                    <Checkbox
                                      checked={perms[role]?.[res]?.[a]}
                                      onCheckedChange={() => togglePerm(role, res, a)}
                                    />
                                  )}
                                </TableCell>
                              ))}
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <Dialog open={pinDialogOpen} onOpenChange={setPinDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {t('saas.pinDialogTitle')} {pinTargetUser?.name}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3 py-2">
              <Label className="text-sm text-slate-500">{t('saas.pinDialogLabel')}</Label>
              <PinInput value={newPin} onChange={setNewPin} />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setPinDialogOpen(false)} disabled={pinSaving}>
                {t('common.cancel')}
              </Button>
              <Button
                onClick={() => void handleSavePin()}
                disabled={pinSaving || newPin.length !== 4}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                {pinSaving ? t('saas.permsSaving') : t('saas.permsSave')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}
