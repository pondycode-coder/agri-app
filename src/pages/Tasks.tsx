import { useEffect, useState } from 'react';
import { MainLayout } from '@/components/MainLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useI18n } from '@/context/I18nProvider';
import { dbStore } from '@/services/store';
import { FarmTask } from '@/types/database';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CheckSquare, Plus, Pencil, Trash2, Wallet } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { formatFCFA } from '@/types/database';

const statusColors: Record<string, string> = {
  pending: 'bg-slate-100 text-slate-700',
  in_progress: 'bg-blue-100 text-blue-800',
  completed: 'bg-emerald-100 text-emerald-800',
  cancelled: 'bg-red-100 text-red-800',
};

export default function Tasks() {
  const { t } = useI18n();
  const { toast } = useToast();
  const [tick, setTick] = useState(0);
  const [tasks, setTasks] = useState<FarmTask[]>([]);
  const [workers, setWorkers] = useState<ReturnType<typeof dbStore.getWorkers>>([]);
  const [plots, setPlots] = useState<ReturnType<typeof dbStore.getPlots>>([]);
  const [farms, setFarms] = useState<ReturnType<typeof dbStore.getFarms>>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<FarmTask | null>(null);
  const [form, setForm] = useState({
    farm_id: '', title: '', description: '', worker_id: '', plot_id: '',
    status: 'pending' as FarmTask['status'], assigned_date: new Date().toISOString().split('T')[0],
    due_date: '', wage_amount: 0, wage_paid: false,
  });
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const refresh = () => {
    setTasks(dbStore.getTasks());
    setWorkers(dbStore.getWorkers());
    setPlots(dbStore.getPlots());
    setFarms(dbStore.getFarms());
  };

  useEffect(() => {
    const unsub = dbStore.subscribe(() => setTick((p) => p + 1));
    refresh();
    return unsub;
  }, []);

  useEffect(() => {
    refresh();
  }, [dialogOpen, deleteId, tick]);

  const openCreate = () => {
    setEditing(null);
    setForm({ farm_id: farms[0]?.id || '', title: '', description: '', worker_id: '', plot_id: '', status: 'pending', assigned_date: new Date().toISOString().split('T')[0], due_date: '', wage_amount: 0, wage_paid: false });
    setDialogOpen(true);
  };

  const openEdit = (task: FarmTask) => {
    setEditing(task);
    setForm({ farm_id: task.farm_id, title: task.title, description: task.description || '', worker_id: task.worker_id || '', plot_id: task.plot_id || '', status: task.status, assigned_date: task.assigned_date, due_date: task.due_date, wage_amount: task.wage_amount ?? 0, wage_paid: task.wage_paid });
    setDialogOpen(true);
  };

  const onWorkerChange = (workerId: string) => {
    const wage = workers.find((w) => w.id === workerId)?.daily_wage || 0;
    setForm({ ...form, worker_id: workerId, wage_amount: wage });
  };

  const handleSave = () => {
    if (!form.farm_id) return;
    dbStore.saveTask({ ...form, id: editing?.id });
    setDialogOpen(false);
    toast({ title: editing ? t('common.successUpdated') : t('common.successCreated') });
  };

  const handleDelete = () => {
    if (deleteId) { dbStore.deleteTask(deleteId); setDeleteId(null); toast({ title: t('common.successDeleted') }); }
  };

  const statusLabel = (s: string) => {
    const map: Record<string, string> = { pending: t('tasks.statusPending'), in_progress: t('tasks.statusInProgress'), completed: t('tasks.statusCompleted'), cancelled: t('tasks.statusCancelled') };
    return map[s] || s;
  };

  const getWorkerName = (id?: string | null) => id ? workers.find((w) => w.id === id)?.name || '—' : '—';
  const getPlotName = (id?: string | null) => id ? plots.find((p) => p.id === id)?.name || '—' : '—';

  const getWage = (task: FarmTask) => task.wage_amount ?? workers.find((w) => w.id === task.worker_id)?.daily_wage ?? 0;

  const toggleWagePaid = (task: FarmTask) => {
    const newPaid = !task.wage_paid;
    dbStore.saveTask({
      ...task,
      wage_paid: newPaid,
      wage_amount: getWage(task),
      status: task.status === 'pending' && newPaid ? 'completed' : task.status,
    });
    toast({
      title: newPaid ? `Salaire ${formatFCFA(getWage(task))} marqué payé` : 'Salaire marqué non payé',
    });
  };

  const paidAmount = tasks.reduce((s, task) => s + (task.wage_paid ? getWage(task) : 0), 0);
  const pendingAmount = tasks.filter((task) => !task.wage_paid && task.status !== 'cancelled')
    .reduce((s, task) => s + getWage(task), 0);

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2"><CheckSquare className="h-6 w-6 text-emerald-600" />{t('tasks.title')}</h1>
            <p className="text-sm text-slate-500 mt-1">{t('tasks.subtitle')}</p>
          </div>
          <Button onClick={openCreate} className="bg-emerald-600 hover:bg-emerald-700"><Plus className="h-4 w-4 mr-2" />{t('tasks.addTask')}</Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="bg-emerald-50 border-emerald-200">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-emerald-800 uppercase">Salaires Payés (Tâches)</p>
                <p className="text-xl font-bold text-emerald-700 mt-1">{formatFCFA(paidAmount)}</p>
              </div>
              <Wallet className="h-6 w-6 text-emerald-600" />
            </CardContent>
          </Card>
          <Card className="bg-amber-50 border-amber-200">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-amber-800 uppercase">Salaires Restants à Payer</p>
                <p className="text-xl font-bold text-amber-700 mt-1">{formatFCFA(pendingAmount)}</p>
              </div>
              <Wallet className="h-6 w-6 text-amber-600" />
            </CardContent>
          </Card>
          <Card className="bg-blue-50 border-blue-200">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-blue-800 uppercase">Tâches en attente de paiement</p>
                <p className="text-xl font-bold text-blue-700 mt-1">{tasks.filter((task) => !task.wage_paid && task.status !== 'cancelled').length}</p>
              </div>
              <CheckSquare className="h-6 w-6 text-blue-600" />
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('tasks.taskTitle')}</TableHead>
                  <TableHead>{t('tasks.assignedWorker')}</TableHead>
                  <TableHead>{t('tasks.assignedPlot')}</TableHead>
                  <TableHead>{t('tasks.dueDate')}</TableHead>
                  <TableHead>{t('tasks.status')}</TableHead>
                  <TableHead>Salaire (FCFA)</TableHead>
                  <TableHead>{t('tasks.wagePaid')}</TableHead>
                  <TableHead className="text-right">{t('common.actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tasks.length === 0 ? (
                  <TableRow><TableCell colSpan={8} className="text-center py-8 text-slate-500">{t('common.noData')}</TableCell></TableRow>
                ) : tasks.map((task) => (
                  <TableRow key={task.id}>
                    <TableCell className="font-medium">{task.title}</TableCell>
                    <TableCell>{getWorkerName(task.worker_id)}</TableCell>
                    <TableCell>{getPlotName(task.plot_id)}</TableCell>
                    <TableCell>{task.due_date}</TableCell>
                    <TableCell><Badge className={statusColors[task.status] || ''}>{statusLabel(task.status)}</Badge></TableCell>
                    <TableCell className="font-mono">{formatFCFA(getWage(task))}</TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        className={task.wage_paid ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200' : 'bg-amber-100 text-amber-800 hover:bg-amber-200'}
                        onClick={() => toggleWagePaid(task)}
                      >
                        <Wallet className="h-3.5 w-3.5 mr-1.5" />
                        {task.wage_paid ? t('tasks.paid') : t('tasks.unpaid')}
                      </Button>
                    </TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(task)}><Pencil className="h-4 w-4" /></Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" onClick={() => setDeleteId(task.id)}><Trash2 className="h-4 w-4 text-red-500" /></Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader><AlertDialogTitle>{t('common.confirm')}</AlertDialogTitle><AlertDialogDescription>{t('common.areYouSure')}</AlertDialogDescription></AlertDialogHeader>
                          <AlertDialogFooter><AlertDialogCancel onClick={() => setDeleteId(null)}>{t('common.cancel')}</AlertDialogCancel><AlertDialogAction onClick={handleDelete}>{t('common.delete')}</AlertDialogAction></AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader><DialogTitle>{editing ? t('tasks.editTask') : t('tasks.addTask')}</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div><Label>{t('tasks.taskTitle')}</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
              <div><Label>{t('tasks.description')}</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label>{t('tasks.assignedWorker')}</Label>
                  <Select value={form.worker_id} onValueChange={onWorkerChange}>
                    <SelectTrigger><SelectValue placeholder={t('tasks.assignedWorker')} /></SelectTrigger>
                    <SelectContent>{workers.map((w) => <SelectItem key={w.id} value={w.id}>{w.name} — {formatFCFA(w.daily_wage)}/j</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>{t('tasks.assignedPlot')}</Label>
                  <Select value={form.plot_id} onValueChange={(v) => setForm({ ...form, plot_id: v })}>
                    <SelectTrigger><SelectValue placeholder={t('tasks.assignedPlot')} /></SelectTrigger>
                    <SelectContent>{plots.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label>{t('tasks.assignedDate')}</Label><Input type="date" value={form.assigned_date} onChange={(e) => setForm({ ...form, assigned_date: e.target.value })} /></div>
                <div><Label>{t('tasks.dueDate')}</Label><Input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label>{t('tasks.status')}</Label>
                  <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as FarmTask['status'] })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{(['pending', 'in_progress', 'completed', 'cancelled'] as const).map((s) => <SelectItem key={s} value={s}>{statusLabel(s)}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>{t('tasks.wagePaid')}</Label>
                  <Select value={form.wage_paid ? 'true' : 'false'} onValueChange={(v) => setForm({ ...form, wage_paid: v === 'true' })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="true">{t('tasks.paid')}</SelectItem><SelectItem value="false">{t('tasks.unpaid')}</SelectItem></SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label>Salaire de la Tâche (FCFA)</Label><Input type="number" min={0} value={form.wage_amount} onChange={(e) => setForm({ ...form, wage_amount: parseInt(e.target.value) || 0 })} /></div>
                <div className="flex items-end pb-0.5">
                  <Button variant="outline" className="w-full" onClick={() => { const w = workers.find((x) => x.id === form.worker_id); if (w) setForm({ ...form, wage_amount: w.daily_wage }); }}>
                    <Wallet className="h-4 w-4 mr-2" />Repo. salaire journalier
                  </Button>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>{t('common.cancel')}</Button>
              <Button onClick={handleSave} className="bg-emerald-600 hover:bg-emerald-700">{t('common.save')}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}
