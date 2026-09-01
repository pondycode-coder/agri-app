import { useCallback, useEffect, useState } from 'react';
import { MainLayout } from '@/components/MainLayout';
import { useAuth } from '@/context/AuthProvider';
import { Card, CardContent } from '@/components/ui/card';
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
} from '@/lib/remoteSync';
import { AdminFarm, AdminStats, AdminUser, AppRole, AuthEvent, formatFCFA } from '@/types/database';
import { ShieldCheck, Building2, Users, LandPlot, ListChecks, Wallet, Trash2, RefreshCw, Ban, Check, LogIn, LogOut, Key, Edit3 } from 'lucide-react';
import { isSupabaseConfigured } from '@/lib/supabase';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { PinInput } from '@/components/PinInput';

export default function SaasAdmin() {
  const { user } = useAuth();
  const { toast } = useToast();
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

  const load = useCallback(async () => {
    setLoading(true);
    const [s, f, u, e] = await Promise.all([adminStats(), adminListFarms(), adminListUsers(), adminListAuthEvents()]);
    setStats(s);
    setFarms(f);
    setUsers(u);
    setEvents(e);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const runAction = async (action: () => Promise<boolean>, okTitle: string) => {
    setBusy(true);
    try {
      const ok = await action();
      toast(ok ? { title: okTitle } : { title: 'Action refusée', variant: 'destructive' });
      await load();
    } finally {
      setBusy(false);
    }
  };

  const handleRoleChange = (userId: string, role: AppRole) =>
    runAction(() => adminSetRole(userId, role), 'Rôle mis à jour');

  const handleSuperadminToggle = (u: AdminUser) =>
    runAction(() => adminSetSuperadmin(u.id, !u.is_superadmin), u.is_superadmin ? 'Super-admin révoqué' : 'Super-admin accordé');

  const handleMoveUser = (userId: string, farmId: string) =>
    runAction(() => adminMoveUser(userId, farmId), 'Utilisateur déplacé');

  const handleDeleteFarm = (farmId: string) =>
    runAction(() => adminDeleteFarm(farmId), 'Ferme supprimée');

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
        toast({ title: `PIN mis à jour pour ${pinTargetUser.name}` });
        setPinDialogOpen(false);
        await load();
      }
    } catch (err) {
      toast({ title: 'Impossible de mettre à jour le PIN', description: err instanceof Error ? err.message : undefined, variant: 'destructive' });
    } finally {
      setPinSaving(false);
    }
  };

  if (!user?.is_superadmin) {
    return (
      <MainLayout>
        <Card className="max-w-xl mx-auto mt-10">
          <CardContent className="pt-6 text-center space-y-3">
            <ShieldCheck className="h-10 w-10 mx-auto text-slate-400" />
            <h2 className="text-xl font-bold">Accès réservé aux super-administrateurs</h2>
            <p className="text-sm text-slate-500">
              La première exploitation qui s'inscrit sur la plateforme reçoit le statut super-admin.
              Votre compte n'a pas (encore) ce rôle.
            </p>
          </CardContent>
        </Card>
      </MainLayout>
    );
  }

  const statCards: Array<{ label: string; value: string; icon: typeof Building2 }> = [
    { label: 'Fermes', value: String(stats?.total_farms ?? 0), icon: Building2 },
    { label: 'Utilisateurs', value: String(stats?.total_users ?? 0), icon: Users },
    { label: 'Parcelles', value: String(stats?.total_plots ?? 0), icon: LandPlot },
    { label: 'Ouvriers', value: String(stats?.total_workers ?? 0), icon: Users },
    { label: 'Tâches', value: String(stats?.total_tasks ?? 0), icon: ListChecks },
    { label: 'Revenus', value: formatFCFA(stats?.total_income ?? 0), icon: Wallet },
    { label: 'Dépenses', value: formatFCFA(stats?.total_expenses ?? 0), icon: Wallet },
  ];

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <ShieldCheck className="h-6 w-6 text-amber-500" />
              SaaS Admin
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Vue plateforme : toutes les exploitations et tous les comptes.
            </p>
          </div>
          <Button variant="outline" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Actualiser
          </Button>
        </div>

        {!isSupabaseConfigured() && (
          <Card className="border-amber-300 bg-amber-50 dark:bg-amber-950/30">
            <CardContent className="pt-6 text-sm text-amber-800 dark:text-amber-200">
              Ces outils nécessitent une connexion Supabase. En mode démo local, le rôle super-admin
              n'est pas appliqué.
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
            <TabsTrigger value="farms">Exploitations ({farms.length})</TabsTrigger>
            <TabsTrigger value="users">Comptes ({users.length})</TabsTrigger>
            <TabsTrigger value="activity">Activité ({events.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="farms" className="space-y-4">
            <Card>
              <CardContent className="pt-6">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Ferme</TableHead>
                      <TableHead>Localisation</TableHead>
                      <TableHead>Ha</TableHead>
                      <TableHead>Parcelles</TableHead>
                      <TableHead>Membres</TableHead>
                      <TableHead>Revenus</TableHead>
                      <TableHead>Dépenses</TableHead>
                      <TableHead>Créée le</TableHead>
                      <TableHead className="text-right">Action</TableHead>
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
                        <TableCell>{new Date(farm.created_at).toLocaleDateString('fr-FR')}</TableCell>
                        <TableCell className="text-right">
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-600 hover:bg-red-50" disabled={busy}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Supprimer « {farm.name} » ?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Toutes les données liées à cette exploitation seront supprimées définitivement.
                                  Cette action est irréversible.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel disabled={busy}>Annuler</AlertDialogCancel>
                                <AlertDialogAction onClick={() => void handleDeleteFarm(farm.id)} disabled={busy} className="bg-red-600 hover:bg-red-700">
                                  Supprimer
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
                          Aucune exploitation.
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
                      <TableHead>Nom</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Rôle</TableHead>
                      <TableHead>Exploitation</TableHead>
                      <TableHead>Super-admin</TableHead>
                      <TableHead>PIN</TableHead>
                      <TableHead>Inscrit le</TableHead>
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
                              <SelectItem value="admin">Admin</SelectItem>
                              <SelectItem value="manager">Manager</SelectItem>
                              <SelectItem value="worker">Ouvrier</SelectItem>
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
                              <SelectValue placeholder={u.farm_name || 'Aucune ferme'} />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none" disabled>
                                {u.farm_name || 'Aucune ferme'}
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
                            {u.is_superadmin ? 'Super-admin' : 'Promouvoir'}
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
                              {u.pin ? 'Modifier' : 'Définir'}
                            </Button>
                          </div>
                        </TableCell>
                        <TableCell>{new Date(u.created_at).toLocaleDateString('fr-FR')}</TableCell>
                      </TableRow>
                    ))}
                    {users.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-slate-400 py-6">
                          Aucun compte.
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
                      <TableHead>Utilisateur</TableHead>
                      <TableHead>Exploitation</TableHead>
                      <TableHead>Événement</TableHead>
                      <TableHead>Date / Heure</TableHead>
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
                              <LogIn className="h-3.5 w-3.5" /> Connexion
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-100 px-2 py-0.5 text-xs font-medium text-rose-700">
                              <LogOut className="h-3.5 w-3.5" /> Déconnexion
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-slate-500">
                          {new Date(ev.created_at).toLocaleString('fr-FR')}
                        </TableCell>
                      </TableRow>
                    ))}
                    {events.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-slate-400 py-6">
                          Aucune activité enregistrée.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <Dialog open={pinDialogOpen} onOpenChange={setPinDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Définir le PIN de {pinTargetUser?.name}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 py-2">
              <Label className="text-sm text-slate-500">Nouveau code PIN (4 chiffres)</Label>
              <PinInput value={newPin} onChange={setNewPin} />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setPinDialogOpen(false)} disabled={pinSaving}>
                Annuler
              </Button>
              <Button
                onClick={() => void handleSavePin()}
                disabled={pinSaving || newPin.length !== 4}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                {pinSaving ? 'Enregistrement...' : 'Enregistrer'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}
