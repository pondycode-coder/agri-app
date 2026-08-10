import React, { useState } from 'react';
import { useI18n } from '@/context/I18nProvider';
import { useAuth } from '@/context/AuthProvider';
import { hasPermission } from '@/utils/rbac';
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
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AppRole } from '@/types/database';

export const MainLayout = ({ children }: { children: React.ReactNode }) => {
  const { t, locale, setLocale } = useI18n();
  const { user, signOut, switchRole } = useAuth();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navItems = [
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
                item.resource === 'dashboard' || hasPermission(user?.role, 'view', item.resource)
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
          <div className="flex items-center justify-between px-2 py-1">
            <div className="flex items-center space-x-2">
              <ShieldCheck className="h-4 w-4 text-emerald-400" />
              <span className="text-xs text-slate-400">Rôle:</span>
            </div>
            {getRoleBadge(user?.role)}
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

            {/* Role Switcher */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="text-xs border-slate-700 bg-slate-800/80 text-slate-200 hover:bg-slate-700 h-8">
                  Switch Rôle
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-slate-900 text-slate-100 border-slate-800">
                <DropdownMenuItem onClick={() => switchRole('admin')} className="cursor-pointer hover:bg-slate-800">
                  👑 Administrateur
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => switchRole('manager')} className="cursor-pointer hover:bg-slate-800">
                  📊 Manager Ferme
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => switchRole('worker')} className="cursor-pointer hover:bg-slate-800">
                  🌾 Ouvrier Agricole
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
            <span className="text-sm font-medium text-slate-600 dark:text-slate-400">
              {user?.name || 'Exploitation Agricole'}
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
              {user?.name ? user.name.charAt(0).toUpperCase() : 'A'}
            </div>
          </div>
        </header>

        {/* Page Container */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
};
