import { useEffect, useState } from 'react';
import { MainLayout } from '@/components/MainLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useI18n } from '@/context/I18nProvider';
import { dbStore } from '@/services/store';
import { formatFCFA } from '@/types/database';
import { Link } from 'react-router-dom';
import {
  Tractor,
  Sprout,
  CheckSquare,
  Package,
  TrendingUp,
  TrendingDown,
  DollarSign,
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Users,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

export default function Dashboard() {
  const { t } = useI18n();
  const [, setTick] = useState(0);

  const roleLabels: Record<string, string> = {
    field_worker: 'Ouvrier', agronomist: 'Agronome', machine_operator: 'Conducteur', supervisor: 'Chef d\'équipe',
  };

  useEffect(() => {
    return dbStore.subscribe(() => setTick((prev) => prev + 1));
  }, []);

  const farms = dbStore.getFarms();
  const plots = dbStore.getPlots();
  const crops = dbStore.getCropCycles();
  const inventory = dbStore.getInventory();
  const workers = dbStore.getWorkers();
  const tasks = dbStore.getTasks();
  const financials = dbStore.getFinancials();

  const activeWorkersCount = workers.filter((w) => w.is_active).length;
  const inactiveWorkersCount = workers.length - activeWorkersCount;

  // Calculations
  const activeCropsCount = crops.filter((c) => c.status === 'planted' || c.status === 'growing').length;
  const pendingTasksCount = tasks.filter((t) => t.status === 'pending' || t.status === 'in_progress').length;
  
  const totalInventoryValue = inventory.reduce((sum, item) => sum + item.quantity * item.price_per_unit, 0);

  const totalIncome = financials
    .filter((f) => f.type === 'income')
    .reduce((sum, f) => sum + f.amount, 0);

  const totalExpenses = financials
    .filter((f) => f.type === 'expense')
    .reduce((sum, f) => sum + f.amount, 0);

  const netProfit = totalIncome - totalExpenses;

  const totalWagesPaid =
    tasks
      .filter((t) => t.status !== 'cancelled')
      .reduce((sum, task) => sum + (task.advance_amount || 0), 0) +
    tasks
      .filter((t) => t.wage_paid)
      .reduce((sum, task) => sum + Math.max(0, (task.wage_amount || 0) - (task.advance_amount || 0)), 0);

  const totalWagesPending = tasks
    .filter((t) => !t.wage_paid && t.status !== 'cancelled')
    .reduce((sum, task) => sum + Math.max(0, (task.wage_amount || 0) - (task.advance_amount || 0)), 0);

  const recentTasks = [...tasks].sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));

  // Financial Chart Data
  const chartData = [
    { name: 'Novembre', Recettes: 4800000, Dépenses: 350000 },
    { name: 'Décembre', Recettes: 1200000, Dépenses: 250000 },
    { name: 'Janvier', Recettes: 800000, Dépenses: 180000 },
    { name: 'Février', Recettes: 2550000, Dépenses: 532500 },
  ];

  // Pie Chart for Crop Breakdown
  const cropDistribution = [
    { name: 'Cacao', value: 45 },
    { name: 'Tomate', value: 25 },
    { name: 'Plantain', value: 20 },
    { name: 'Maïs', value: 10 },
  ];
  const COLORS = ['#16a34a', '#ef4444', '#f59e0b', '#3b82f6'];

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Banner */}
        <div className="bg-gradient-to-r from-emerald-800 via-emerald-700 to-teal-800 rounded-2xl p-6 text-white shadow-xl relative overflow-hidden">
          <div className="absolute -right-10 -bottom-10 opacity-10 text-9xl select-none">
            🌾
          </div>
          <div className="relative z-10 space-y-2">
            <div className="flex items-center space-x-2">
              <Badge className="bg-yellow-400 text-slate-900 font-extrabold hover:bg-yellow-300">
                XAF / FCFA
              </Badge>
              <span className="text-xs text-emerald-200">Système de Gestion Agricole</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              {t('dashboard.welcome')}
            </h1>
            <p className="text-emerald-100 text-sm max-w-xl">
              {t('dashboard.subtitle')}
            </p>
          </div>
        </div>

        {/* High Level Stat Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="border-l-4 border-l-emerald-500 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                {t('dashboard.totalFarms')}
              </CardTitle>
              <Tractor className="h-5 w-5 text-emerald-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-slate-900 dark:text-white">
                {farms.length}
              </div>
              <p className="text-xs text-slate-500 mt-1">
                {plots.length} {t('dashboard.totalPlots').toLowerCase()}
              </p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-blue-500 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                {t('dashboard.activeCropCycles')}
              </CardTitle>
              <Sprout className="h-5 w-5 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-slate-900 dark:text-white">
                {activeCropsCount}
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Sur {crops.length} cycles déclarés
              </p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-amber-500 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                {t('dashboard.pendingTasks')}
              </CardTitle>
              <CheckSquare className="h-5 w-5 text-amber-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-slate-900 dark:text-white">
                {pendingTasksCount}
              </div>
              <p className="text-xs text-slate-500 mt-1">
                {workers.length} {t('dashboard.totalWorkers').toLowerCase()}
              </p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-teal-500 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                {t('dashboard.totalWorkers')}
              </CardTitle>
              <Users className="h-5 w-5 text-teal-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-slate-900 dark:text-white">
                {workers.length}
              </div>
              <p className="text-xs text-slate-500 mt-1">
                {activeWorkersCount} actifs · {inactiveWorkersCount} inactifs
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <Card className="border-l-4 border-l-indigo-500 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                {t('dashboard.inventoryValue')}
              </CardTitle>
              <Package className="h-5 w-5 text-indigo-600" />
            </CardHeader>
            <CardContent>
              <div className="text-lg font-bold text-slate-900 dark:text-white truncate">
                {formatFCFA(totalInventoryValue)}
              </div>
              <p className="text-xs text-slate-500 mt-1">
                {inventory.length} références d'intrants
              </p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-emerald-500 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                {t('dashboard.totalWagesPaid')}
              </CardTitle>
              <DollarSign className="h-5 w-5 text-emerald-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-slate-900 dark:text-white">
                {formatFCFA(totalWagesPaid)}
              </div>
              <p className="text-xs text-slate-500 mt-1">
                {t('dashboard.paidWagesDetail')}
              </p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-amber-500 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                {t('dashboard.totalOutstandingWages')}
              </CardTitle>
              <AlertTriangle className="h-5 w-5 text-amber-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-slate-900 dark:text-white">
                {formatFCFA(totalWagesPending)}
              </div>
              <p className="text-xs text-slate-500 mt-1">
                {t('dashboard.outstandingWagesDetail')}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Financial Summary Banner Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800">
            <CardContent className="p-5 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-emerald-800 dark:text-emerald-300 uppercase">
                  {t('dashboard.monthlyIncome')}
                </p>
                <p className="text-2xl font-extrabold text-emerald-700 dark:text-emerald-400 mt-1">
                  {formatFCFA(totalIncome)}
                </p>
              </div>
              <div className="p-3 bg-emerald-500 text-white rounded-xl shadow-md">
                <TrendingUp className="h-6 w-6" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800">
            <CardContent className="p-5 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-rose-800 dark:text-rose-300 uppercase">
                  {t('dashboard.monthlyExpenses')}
                </p>
                <p className="text-2xl font-extrabold text-rose-700 dark:text-rose-400 mt-1">
                  {formatFCFA(totalExpenses)}
                </p>
              </div>
              <div className="p-3 bg-rose-500 text-white rounded-xl shadow-md">
                <TrendingDown className="h-6 w-6" />
              </div>
            </CardContent>
          </Card>

          <Card className={`border ${netProfit >= 0 ? 'bg-blue-50 border-blue-200' : 'bg-amber-50 border-amber-200'}`}>
            <CardContent className="p-5 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-700 uppercase">
                  {t('dashboard.netCashFlow')}
                </p>
                <p className={`text-2xl font-extrabold mt-1 ${netProfit >= 0 ? 'text-blue-700' : 'text-amber-700'}`}>
                  {formatFCFA(netProfit)}
                </p>
              </div>
              <div className={`p-3 text-white rounded-xl shadow-md ${netProfit >= 0 ? 'bg-blue-600' : 'bg-amber-600'}`}>
                <DollarSign className="h-6 w-6" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Charts & Interactive Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Financial Bar Chart */}
          <Card className="lg:col-span-2 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div>
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-emerald-600" />
                  {t('dashboard.financialChartTitle')}
                </CardTitle>
                <CardDescription>
                  Comparatif des revenus de vente vs dépenses opérationnelles
                </CardDescription>
              </div>
              <Button variant="outline" size="sm" asChild>
                <Link to="/dashboard/financials">
                  Voir Détails <ArrowRight className="ml-1 h-3.5 w-3.5" />
                </Link>
              </Button>
            </CardHeader>
            <CardContent>
              <div className="h-72 w-full pt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <XAxis dataKey="name" stroke="#888888" fontSize={12} tickLine={false} />
                    <YAxis
                      stroke="#888888"
                      fontSize={11}
                      tickLine={false}
                      tickFormatter={(value) => `${(value / 1000000).toFixed(1)}M`}
                    />
                    <Tooltip
                      formatter={(value: number | string) => [formatFCFA(Number(value)), '']}
                      contentStyle={{ backgroundColor: '#0f172a', borderRadius: '8px', color: '#fff' }}
                    />
                    <Legend />
                    <Bar dataKey="Recettes" fill="#16a34a" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Dépenses" fill="#ef4444" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Crop Distribution Pie Chart */}
          <Card className="shadow-sm flex flex-col">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Sprout className="h-5 w-5 text-emerald-600" />
                {t('dashboard.cropProductionTitle')}
              </CardTitle>
              <CardDescription>Part de superficie cultivée (%)</CardDescription>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col items-center justify-center">
              <div className="h-52 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={cropDistribution}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {cropDistribution.map((_entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex flex-wrap justify-center gap-3 mt-2 text-xs">
                {cropDistribution.map((item, idx) => (
                  <div key={item.name} className="flex items-center space-x-1.5">
                    <span className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[idx] }} />
                    <span className="font-medium text-slate-700 dark:text-slate-300">
                      {item.name} ({item.value}%)
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Recent Tasks & Workers Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Recent Tasks List */}
          <Card className="shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <CheckSquare className="h-5 w-5 text-emerald-600" />
                {t('dashboard.recentTasks')}
              </CardTitle>
              <Button variant="ghost" size="sm" asChild>
                <Link to="/dashboard/tasks">Voir Tout</Link>
              </Button>
            </CardHeader>
            <CardContent className="divide-y divide-slate-100 dark:divide-slate-800">
              {recentTasks.slice(0, 4).map((task) => (
                <div key={task.id} className="py-3 flex items-center justify-between">
                  <div className="space-y-0.5 max-w-[70%]">
                    <p className="font-semibold text-sm text-slate-800 dark:text-slate-200 truncate">
                      {task.title}
                    </p>
                    <p className="text-xs text-slate-500">
                      Limite: {task.due_date}
                    </p>
                  </div>
                  <Badge
                    variant={
                      task.status === 'completed'
                        ? 'default'
                        : task.status === 'in_progress'
                        ? 'secondary'
                        : 'outline'
                    }
                  >
                    {task.status === 'completed'
                      ? 'Terminée'
                      : task.status === 'in_progress'
                      ? 'En Cours'
                      : 'En Attente'}
                  </Badge>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Workers Overview */}
          <Card className="shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Users className="h-5 w-5 text-teal-600" />
                {t('dashboard.totalWorkers')}
              </CardTitle>
              <Button variant="ghost" size="sm" asChild>
                <Link to="/dashboard/workers">Gérer les ouvriers</Link>
              </Button>
            </CardHeader>
            <CardContent>
              {workers.length === 0 ? (
                <p className="text-sm text-slate-500 py-4 text-center">Aucun ouvrier enregistré.</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nom</TableHead>
                        <TableHead>Rôle</TableHead>
                        <TableHead>Téléphone</TableHead>
                        <TableHead>Tâches</TableHead>
                        <TableHead>Statut</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {workers.map((w) => (
                        <TableRow key={w.id}>
                          <TableCell className="font-medium text-slate-800 dark:text-slate-200">{w.name}</TableCell>
                          <TableCell>
                            <Badge variant="secondary">{roleLabels[w.role] || w.role}</Badge>
                          </TableCell>
                          <TableCell className="text-slate-500">{w.phone_number}</TableCell>
                          <TableCell className="text-slate-500">{w.total_tasks_completed}</TableCell>
                          <TableCell>
                            <Badge className={w.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'}>
                              {w.is_active ? 'Actif' : 'Inactif'}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </MainLayout>
  );
}
