import React, { useState } from 'react';
import { useI18n } from '@/context/I18nProvider';
import { useAuth } from '@/context/AuthProvider';
import { hasPermission, Resource } from '@/utils/rbac';
import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Tractor,
  Grid as GridIcon,
  Sprout,
  Package,
  Users,
  CheckSquare,
  Receipt,
  BookUser,
  TrendingUp,
  UserCircle,
  LogOut,
  Menu,
  X,
  Globe,
  ShieldCheck,
  ChevronDown,
  Building2,
  Check,
  Plus,
  Link2,
  ServerCog,
  type LucideIcon,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { AppRole } from '@/types/database';

export const MainLayout = ({ children }: { children: React.ReactNode }) => {
  const { t, locale, setLocale } = useI18n();
  const { user, isSuperAdmin, signOut, effectiveRole, farms, activeFarmId, switchFarm, createFarm, joinFarm } = useAuth();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [createForm, setCreateForm] = useState({ name: '', location: '', size_in_hectares: '1', description: '' });
  const [joinId, setJoinId] = useState('');
  const { toast } = useToast();

  const activeFarm = farms.find((f) => f.id === activeFarmId) || null;

  const navItems: Array<{ path: string; label: string; icon: LucideIcon; resource: Resource | 'saas-admin' }> = [
    { path: '/dashboard', label: t('layout.sidebar.dashboard'), icon: LayoutDashboard, resource: 'dashboard' as const },
    { path: '/dashboard/farms', label: t('layout.sidebar.farms'), icon: Tractor, resource: 'farms' as const },
    { path: '/dashboard/plots', label: t('layout.sidebar.plots'), icon: GridIcon, resource: 'plots' as const },
    { path: '/dashboard/crops', label: t('layout.sidebar.crops'), icon: Sprout, resource: 'crops' as const },
    { path: '/dashboard/inventory', label: t('layout.sidebar.inventory'), icon: Package, resource: 'inventory' as const },
    { path: '/dashboard/workers', label: t('layout.sidebar.workers'), icon: Users, resource: 'workers' as const },
    { path: '/dashboard/tasks', label: t('layout.sidebar.tasks'), icon: CheckSquare, resource: 'tasks' as const },
    { path: '/dashboard/financials', label: t('layout.sidebar.financials'), icon: Receipt, resource: 'financials' as const },
    { path: '/dashboard/contacts', label: t('layout.sidebar.contacts'), icon: BookUser, resource: 'contacts' as const },
    { path: '/dashboard/investments', label: t('layout.sidebar.investments'), icon: TrendingUp, resource: 'investments' as const },
    { path: '/dashboard/profile', label: t('layout.sidebar.profile'), icon: UserCircle, resource: 'profile' as const },
    ...(isSuperAdmin
      ? [{ path: '/dashboard/saas-admin', label: 'SaaS Admin', icon: ServerCog, resource: 'saas-admin' as const }]
      : []),
  ];

  const getRoleBadge = (role?: AppRole) => {
    switch (role) {
      case 'admin':
        return <Badge className="bg-emerald-600 text-white hover:bg-emerald-700">Admin</Badge>;
      case 'manager':
        return <Badge className="bg-amber-600 text-white hover:bg-amber-700">Manager</Badge>;
      case 'worker':
        return <Badge className="bg-blue-600 text-white hover:bg-blue-700">Ouvrier</Badge>;
      default:
        return <Badge variant="outline">Guest</Badge>;
    }
  };

  const currentRole = effectiveRole || user?.role;

  const handleCreateFarm = async () => {
    if (!createForm.name.trim()) {
      toast({ title: 'Nom requis', variant: 'destructive' });
      return;
    }
    setBusy(true);
    try {
      const created = await createFarm({
        name: createForm.name.trim(),
        location: createForm.location.trim(),
        size_in_hectares: parseFloat(createForm.size_in_hectares) || 1,
        description: createForm.description.trim(),
      });
      if (created) {
        setCreateOpen(false);
        setCreateForm({ name: '', location: '', size_in_hectares: '1', description: '' });
        toast({ title: `Ferme « ${created.name} » créée et activée` });
      } else {
        toast({ title: 'Échec de la création', variant: 'destructive' });
      }
    } finally {
      setBusy(false);
    }
  };

  const handleJoinFarm = async () => {
    if (!joinId.trim()) {
      toast({ title: 'ID de ferme requis', variant: 'destructive' });
      return;
    }
    setBusy(true);
    try {
      const joined = await joinFarm(joinId.trim());
      if (joined) {
        setJoinOpen(false);
        setJoinId('');
        toast({ title: `Ferme « ${joined.name} » rejointe et activée` });
      } else {
        toast({ title: 'Ferme introuvable', variant: 'destructive' });
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col md:flex-row">
      {/* Mobile Top Header */}
      <div className="md:hidden flex items-center justify-between bg-white dark:bg-slate-900 border-b px-4 py-3 sticky top-0 z-30 shadow-sm">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center text-white font-bold text-lg shadow-sm">
            🌾
          </div>
          <span className="font-bold text-lg text-slate-900 dark:text-white">
            Agri<span className="text-emerald-600">App</span>
          </span>
          <span className="text-xs bg-slate-100 text-slate-700 font-semibold px-1.5 py-0.5 rounded border border-slate-200">
            XAF
          </span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        >
          {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </Button>
      </div>

      {/* Sidebar Navigation */}
      <aside
        className={`
          fixed md:static inset-y-0 left-0 z-40 w-64 bg-slate-900 text-slate-100 flex flex-col justify-between transition-transform duration-200 ease-in-out border-r border-slate-800
          ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        `}
      >
        <div>
          {/* Logo Branding */}
          <div className="h-16 flex items-center justify-between px-5 border-b border-slate-800 bg-slate-950/50">
            <Link to="/dashboard" className="flex items-center space-x-2.5">
              <div className="w-9 h-9 rounded-xl bg-emerald-600 flex items-center justify-center text-white text-xl shadow-md">
                🌱
              </div>
              <div>
                <div className="font-extrabold text-lg text-white leading-tight flex items-center gap-1.5">
                  Agri<span className="text-emerald-400">App</span>
                  <span className="text-[10px] bg-emerald-300 text-slate-900 font-bold px-1 py-0.2 rounded">
                    AG
                  </span>
                </div>
                <div className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">
                  Agribusiness Management
                </div>
              </div>
            </Link>
          </div>

          {/* Navigation Links */}
          <nav className="p-3 space-y-1 overflow-y-auto max-h-[calc(100vh-14rem)]">
            {navItems
              .filter((item) =>
                item.resource === 'dashboard' || item.resource === 'saas-admin'
                  ? isSuperAdmin || item.resource === 'dashboard'
                  : hasPermission(currentRole, 'view', item.resource as Resource)
              )
              .map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.path;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`
                      flex items-center px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 group
                      ${
                        isActive
                          ? 'bg-emerald-600 text-white shadow-md shadow-emerald-900/30 font-semibold'
                          : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                      }
                    `}
                  >
                    <Icon
                      className={`mr-3 h-4 w-4 transition-transform group-hover:scale-110 ${
                        isActive ? 'text-white' : 'text-slate-400 group-hover:text-emerald-400'
                      }`}
                    />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
          </nav>
        </div>

        {/* Sidebar Footer & User Info */}
        <div className="p-3 border-t border-slate-800 bg-slate-950/40 space-y-3">
          {/* Farm Switcher */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                className="w-full justify-start text-xs border-slate-700 bg-slate-800/60 text-slate-200 hover:bg-slate-700 h-9 px-2"
              >
                <Building2 className="h-4 w-4 mr-2 text-emerald-400" />
                <span className="truncate">{activeFarm?.name || user?.farm_id || 'Exploitation'}</span>
                <ChevronDown className="h-3 w-3 ml-auto opacity-60" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="bg-slate-900 text-slate-100 border-slate-800 w-64">
              <DropdownMenuLabel className="text-slate-400 text-xs uppercase tracking-wider">Fermes</DropdownMenuLabel>
              <DropdownMenuSeparator className="bg-slate-800" />
              {(farms.length > 0 ? farms : activeFarm ? [activeFarm] : []).map((farm) => (
                <DropdownMenuItem
                  key={farm.id}
                  onClick={() => void switchFarm(farm.id)}
                  className="cursor-pointer hover:bg-slate-800"
                >
                  <span className="truncate">{farm.name}</span>
                  {farm.id === activeFarmId && <Check className="h-3.5 w-3.5 ml-auto text-emerald-400" />}
                </DropdownMenuItem>
              ))}
              {farms.length === 0 && !activeFarm && (
                <DropdownMenuItem disabled className="text-slate-500">Aucune ferme</DropdownMenuItem>
              )}
              <DropdownMenuSeparator className="bg-slate-800" />
              <DropdownMenuItem onClick={() => setCreateOpen(true)} className="cursor-pointer hover:bg-slate-800">
                <Plus className="h-3.5 w-3.5 mr-2 text-emerald-400" />
                <span>Créer une ferme</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setJoinOpen(true)} className="cursor-pointer hover:bg-slate-800">
                <Link2 className="h-3.5 w-3.5 mr-2 text-emerald-400" />
                <span>Rejoindre une ferme</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <div className="flex items-center justify-between px-2 py-1">
            <div className="flex items-center space-x-2">
              <ShieldCheck className="h-4 w-4 text-emerald-400" />
              <span className="text-xs text-slate-400">Rôle:</span>
            </div>
            <div className="flex items-center space-x-1.5">
              {isSuperAdmin && (
                <Badge className="bg-amber-500 text-white hover:bg-amber-600">Super Admin</Badge>
              )}
              {getRoleBadge(currentRole)}
            </div>
          </div>

          <div className="flex items-center justify-between pt-1 border-t border-slate-800/80">
            {/* Language Switcher */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="text-xs text-slate-300 hover:text-white px-2 h-8">
                  <Globe className="h-3.5 w-3.5 mr-1.5 text-emerald-400" />
                  {locale.toUpperCase()}
                  <ChevronDown className="h-3 w-3 ml-1 opacity-60" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="bg-slate-900 text-slate-100 border-slate-800">
                <DropdownMenuItem onClick={() => setLocale('fr')} className="cursor-pointer hover:bg-slate-800">
                  🇫🇷 Français (FR)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setLocale('en')} className="cursor-pointer hover:bg-slate-800">
                  🇬🇧 English (EN)
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <Button
            variant="ghost"
            onClick={signOut}
            className="w-full justify-start text-red-400 hover:text-red-300 hover:bg-red-950/30 text-xs h-9"
          >
            <LogOut className="mr-2 h-3.5 w-3.5" />
            {t('layout.header.signOut')}
          </Button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Desktop Bar */}
        <header className="hidden md:flex h-16 items-center justify-between bg-white dark:bg-slate-900 border-b px-8 shadow-sm">
          <div className="flex items-center space-x-3">
            <Badge variant="outline" className="border-emerald-600/30 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 font-semibold px-2.5 py-1">
              XAF / FCFA
            </Badge>
            <span className="text-slate-400 text-sm">|</span>
            <Badge variant="outline" className="border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-medium px-2.5 py-1">
              <Building2 className="h-3.5 w-3.5 mr-1.5 text-emerald-600 dark:text-emerald-400" />
              {activeFarm?.name || 'Exploitation Agricole'}
            </Badge>
            <span className="text-slate-400 text-sm">|</span>
            <span className="text-sm font-medium text-slate-600 dark:text-slate-400">
              {user?.name || 'Pondycode'}
            </span>
          </div>

          <div className="flex items-center space-x-4">
            <div className="text-right">
              <p className="text-sm font-bold text-slate-900 dark:text-white leading-tight">
                {user?.name}
              </p>
              <p className="text-xs text-slate-500">{user?.email}</p>
            </div>
            <div className="w-9 h-9 rounded-full bg-emerald-600 text-white font-bold flex items-center justify-center text-sm shadow-sm ring-2 ring-emerald-500/30">
              {user?.name ? user.name.charAt(0).toUpperCase() : 'P'}
            </div>
          </div>
        </header>

        {/* Page Container */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>

      {/* Create Farm Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="bg-slate-900 text-slate-100 border-slate-800">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-emerald-400" />
              Créer une ferme
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              La ferme sera créée et vous en serez l'administrateur.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-slate-300">Nom de la ferme</Label>
              <Input
                value={createForm.name}
                onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                placeholder="ex: Plantation Nord-Ouest Kumbo"
                className="border-slate-700 bg-slate-800 text-slate-100"
              />
            </div>
            <div>
              <Label className="text-slate-300">Localisation / Région</Label>
              <Input
                value={createForm.location}
                onChange={(e) => setCreateForm({ ...createForm, location: e.target.value })}
                placeholder="ex: Kumbo, Nord-Ouest Cameroun"
                className="border-slate-700 bg-slate-800 text-slate-100"
              />
            </div>
            <div>
              <Label className="text-slate-300">Superficie (ha)</Label>
              <Input
                type="number"
                min={0.1}
                step={0.1}
                value={createForm.size_in_hectares}
                onChange={(e) => setCreateForm({ ...createForm, size_in_hectares: e.target.value })}
                className="border-slate-700 bg-slate-800 text-slate-100"
              />
            </div>
            <div>
              <Label className="text-slate-300">Description</Label>
              <Input
                value={createForm.description}
                onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                placeholder="Culture principale, objectifs…"
                className="border-slate-700 bg-slate-800 text-slate-100"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={busy} className="border-slate-700 text-slate-200 hover:bg-slate-800">
              Annuler
            </Button>
            <Button onClick={handleCreateFarm} disabled={busy} className="bg-emerald-600 hover:bg-emerald-700">
              {busy ? 'Création…' : 'Créer et activer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Join Farm Dialog */}
      <Dialog open={joinOpen} onOpenChange={setJoinOpen}>
        <DialogContent className="bg-slate-900 text-slate-100 border-slate-800">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Link2 className="h-5 w-5 text-emerald-400" />
              Rejoindre une ferme
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              Entrez l'ID de la ferme partagé par son administrateur pour y être ajouté.
            </DialogDescription>
          </DialogHeader>
          <div>
            <Label className="text-slate-300">ID de la ferme</Label>
            <Input
              value={joinId}
              onChange={(e) => setJoinId(e.target.value)}
              placeholder="farm-… ou UUID"
              className="border-slate-700 bg-slate-800 text-slate-100"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setJoinOpen(false)} disabled={busy} className="border-slate-700 text-slate-200 hover:bg-slate-800">
              Annuler
            </Button>
            <Button onClick={handleJoinFarm} disabled={busy} className="bg-emerald-600 hover:bg-emerald-700">
              {busy ? 'Connexion…' : 'Rejoindre et activer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
