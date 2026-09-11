import { useState, useMemo } from 'react';
import { MainLayout } from '@/components/MainLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import {
  BookOpen,
  Search,
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
  CircleHelp,
  ShieldCheck,
  RefreshCw,
  ListOrdered,
} from 'lucide-react';
import { useI18n } from '@/context/I18nProvider';
import type { LucideIcon } from 'lucide-react';

interface ManualStep {
  key: string;
  icon: LucideIcon;
}
interface ManualSection {
  id: string;
  icon: LucideIcon;
  subtitle: string;
  steps: ManualStep[];
}

export default function HelpPage() {
  const { t, locale } = useI18n();
  const [search, setSearch] = useState('');

  const sections: ManualSection[] = [
    { id: 'gettingStarted', icon: BookOpen, subtitle: 'help.gettingStartedSub', steps: [
      { key: 'gettingStarted.1', icon: CircleHelp },
      { key: 'gettingStarted.2', icon: BookOpen },
      { key: 'gettingStarted.3', icon: ShieldCheck },
      { key: 'gettingStarted.4', icon: RefreshCw },
    ]},
    { id: 'dashboard', icon: LayoutDashboard, subtitle: 'help.dashboardSub', steps: [
      { key: 'dashboard.1', icon: LayoutDashboard },
      { key: 'dashboard.2', icon: LayoutDashboard },
      { key: 'dashboard.3', icon: LayoutDashboard },
      { key: 'dashboard.4', icon: LayoutDashboard },
      { key: 'dashboard.5', icon: LayoutDashboard },
      { key: 'dashboard.6', icon: LayoutDashboard },
      { key: 'dashboard.7', icon: LayoutDashboard },
    ]},
    { id: 'farms', icon: Tractor, subtitle: 'help.farmsSub', steps: [
      { key: 'farms.1', icon: Tractor },
      { key: 'farms.2', icon: Tractor },
      { key: 'farms.3', icon: Tractor },
      { key: 'farms.4', icon: Tractor },
      { key: 'farms.5', icon: Tractor },
    ]},
    { id: 'plots', icon: GridIcon, subtitle: 'help.plotsSub', steps: [
      { key: 'plots.1', icon: GridIcon },
      { key: 'plots.2', icon: GridIcon },
      { key: 'plots.3', icon: GridIcon },
      { key: 'plots.4', icon: GridIcon },
      { key: 'plots.5', icon: GridIcon },
    ]},
    { id: 'crops', icon: Sprout, subtitle: 'help.cropsSub', steps: [
      { key: 'crops.1', icon: Sprout },
      { key: 'crops.2', icon: Sprout },
      { key: 'crops.3', icon: Sprout },
      { key: 'crops.4', icon: Sprout },
      { key: 'crops.5', icon: Sprout },
      { key: 'crops.6', icon: Sprout },
      { key: 'crops.7', icon: Sprout },
      { key: 'crops.8', icon: Sprout },
      { key: 'crops.9', icon: Sprout },
    ]},
    { id: 'inventory', icon: Package, subtitle: 'help.inventorySub', steps: [
      { key: 'inventory.1', icon: Package },
      { key: 'inventory.2', icon: Package },
      { key: 'inventory.3', icon: Package },
      { key: 'inventory.4', icon: Package },
      { key: 'inventory.5', icon: Package },
    ]},
    { id: 'workers', icon: Users, subtitle: 'help.workersSub', steps: [
      { key: 'workers.1', icon: Users },
      { key: 'workers.2', icon: Users },
      { key: 'workers.3', icon: Users },
      { key: 'workers.4', icon: Users },
      { key: 'workers.5', icon: Users },
      { key: 'workers.6', icon: Users },
    ]},
    { id: 'tasks', icon: CheckSquare, subtitle: 'help.tasksSub', steps: [
      { key: 'tasks.1', icon: CheckSquare },
      { key: 'tasks.2', icon: CheckSquare },
      { key: 'tasks.3', icon: CheckSquare },
      { key: 'tasks.4', icon: CheckSquare },
      { key: 'tasks.5', icon: CheckSquare },
      { key: 'tasks.6', icon: CheckSquare },
      { key: 'tasks.7', icon: CheckSquare },
    ]},
    { id: 'financials', icon: Receipt, subtitle: 'help.financialsSub', steps: [
      { key: 'financials.1', icon: Receipt },
      { key: 'financials.2', icon: Receipt },
      { key: 'financials.3', icon: Receipt },
      { key: 'financials.4', icon: Receipt },
      { key: 'financials.5', icon: Receipt },
      { key: 'financials.6', icon: Receipt },
      { key: 'financials.7', icon: Receipt },
      { key: 'financials.8', icon: Receipt },
      { key: 'financials.9', icon: Receipt },
    ]},
    { id: 'contacts', icon: BookUser, subtitle: 'help.contactsSub', steps: [
      { key: 'contacts.1', icon: BookUser },
      { key: 'contacts.2', icon: BookUser },
      { key: 'contacts.3', icon: BookUser },
      { key: 'contacts.4', icon: BookUser },
    ]},
    { id: 'investments', icon: TrendingUp, subtitle: 'help.investmentsSub', steps: [
      { key: 'investments.1', icon: TrendingUp },
      { key: 'investments.2', icon: TrendingUp },
      { key: 'investments.3', icon: TrendingUp },
      { key: 'investments.4', icon: TrendingUp },
    ]},
    { id: 'profile', icon: UserCircle, subtitle: 'help.profileSub', steps: [
      { key: 'profile.1', icon: UserCircle },
      { key: 'profile.2', icon: UserCircle },
      { key: 'profile.3', icon: UserCircle },
      { key: 'profile.4', icon: UserCircle },
      { key: 'profile.5', icon: UserCircle },
    ]},
    { id: 'roles', icon: ShieldCheck, subtitle: 'help.rolesSub', steps: [
      { key: 'roles.1', icon: ShieldCheck },
      { key: 'roles.2', icon: ShieldCheck },
      { key: 'roles.3', icon: ShieldCheck },
    ]},
    { id: 'sync', icon: RefreshCw, subtitle: 'help.syncSub', steps: [
      { key: 'sync.1', icon: RefreshCw },
      { key: 'sync.2', icon: RefreshCw },
      { key: 'sync.3', icon: RefreshCw },
      { key: 'sync.4', icon: RefreshCw },
    ]},
  ];

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return sections;
    return sections.filter(
      (s) =>
        t(`help.${s.id}.title`).toLowerCase().includes(q) ||
        t(s.subtitle).toLowerCase().includes(q) ||
        s.steps.some((st) => t(`help.${st.key}`).toLowerCase().includes(q)),
    );
  }, [search, sections, t]);

  const read = (key: string) => t(key as never);

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2"><BookOpen className="h-6 w-6 text-emerald-600" />{t('help.title')}</h1>
            <p className="text-sm text-slate-500 mt-1">{t('help.subtitle')}</p>
          </div>
          <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 self-start">
            {locale === 'fr' ? 'Version 2.0' : 'Version 2.0'}
          </Badge>
        </div>

        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder={t('help.searchPlaceholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>

        <Card>
          <CardContent className="p-4 sm:p-6 space-y-2">
            {filtered.length === 0 && (
              <p className="text-sm text-slate-500 py-6 text-center">{t('help.noResults')}</p>
            )}
            {filtered.map((section) => {
              const Icon = section.icon;
              return (
                <Accordion key={section.id} type="single" collapsible>
                  <AccordionItem value={section.id} className="border-slate-200 dark:border-slate-700">
                    <AccordionTrigger className="hover:no-underline">
                      <div className="flex items-center gap-3 text-left">
                        <div className="w-9 h-9 rounded-lg bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 flex items-center justify-center shrink-0">
                          <Icon className="h-4.5 w-4.5 h-5 w-5" />
                        </div>
                        <div>
                          <div className="font-semibold">{read(`help.${section.id}.title`)}</div>
                          <div className="text-xs text-slate-500 font-normal">{read(section.subtitle)}</div>
                        </div>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-3 pl-12">
                        {section.steps.map((step) => {
                          const StepIcon = step.icon;
                          return (
                            <div key={step.key} className="flex items-start gap-3">
                              <div className="mt-0.5 w-6 h-6 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 flex items-center justify-center shrink-0">
                                <StepIcon className="h-3.5 w-3.5" />
                              </div>
                              <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                                {read(`help.${step.key}`)}
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              );
            })}
          </CardContent>
        </Card>

        <div className="flex items-center gap-2 text-xs text-slate-400">
          <ListOrdered className="h-3.5 w-3.5" />
          <span>{t('help.footerTip')}</span>
        </div>
      </div>
    </MainLayout>
  );
}