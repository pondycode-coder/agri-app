import { useEffect, useState } from 'react';
import { MainLayout } from '@/components/MainLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuCheckboxItem, DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { useI18n } from '@/context/I18nProvider';
import { dbStore } from '@/services/store';
import { FarmTask } from '@/types/database';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CheckSquare, Plus, Pencil, Trash2, ChevronDown } from 'lucide-react';
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
    farm_id: '', title: '', description: '', worker_ids: [] as string[], worker_wages: {} as Record<string, number>, worker_advances: {} as Record<string, number>, plot_id: '',
    wage_amount: 0, wage_paid: false,
    status: 'pending' as FarmTask['status'], assigned_date: new Date().toISOString().split('T')[0],
    due_date: '',
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
    setForm({ farm_id: farms[0]?.id || '', title: '', description: '', worker_ids: [], worker_wages: {}, worker_advances: {}, plot_id: '', wage_amount: 0, wage_paid: false, status: 'pending', assigned_date: new Date().toISOString().split('T')[0], due_date: '' });
    setDialogOpen(true);
  };

  const openEdit = (task: FarmTask) => {
    const workerIds = task.worker_ids?.length ? task.worker_ids : task.worker_id ? [task.worker_id] : [];
    const workerWages =
      task.worker_wages && Object.keys(task.worker_wages).length > 0
        ? { ...task.worker_wages }
        : workerIds.length
          ? Object.fromEntries(workerIds.map((id) => [id, Math.round((task.wage_amount ?? 0) / workerIds.length)]))
          : {};
    const workerAdvances =
      task.worker_advances && Object.keys(task.worker_advances).length > 0
        ? { ...task.worker_advances }
        : workerIds.length
          ? Object.fromEntries(workerIds.map((id) => [id, Math.round((task.advance_amount ?? 0) / workerIds.length)]))
          : {};
    setEditing(task);
    setForm({
      farm_id: task.farm_id,
      title: task.title,
      description: task.description || '',
      worker_ids: workerIds,
      worker_wages: workerWages,
      worker_advances: workerAdvances,
      plot_id: task.plot_id || '',
      wage_amount: task.wage_amount ?? 0,
      wage_paid: task.wage_paid ?? false,
      status: task.status,
      assigned_date: task.assigned_date,
      due_date: task.due_date,
    });
    setDialogOpen(true);
  };

  const toggleWorkerAssignment = (workerId: string) => {
    setForm((prev) => {
      const included = prev.worker_ids.includes(workerId);
      const worker_wages = { ...prev.worker_wages };
      const worker_advances = { ...prev.worker_advances };
      if (included) {
        delete worker_wages[workerId];
        delete worker_advances[workerId];
        return { ...prev, worker_ids: prev.worker_ids.filter((id) => id !== workerId), worker_wages, worker_advances };
      }
      worker_wages[workerId] = 0;
      worker_advances[workerId] = 0;
      return { ...prev, worker_ids: [...prev.worker_ids, workerId], worker_wages, worker_advances };
    });
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

  const getPlotName = (id?: string | null) => id ? plots.find((p) => p.id === id)?.name || '—' : '—';

  const getWorkerWageBreakdown = (task: FarmTask) => {
    const workerIds = task.worker_ids?.length ? task.worker_ids : task.worker_id ? [task.worker_id] : [];
    const total = task.wage_amount ?? 0;
    return workerIds.map((id) => ({
      id,
      name: workers.find((w) => w.id === id)?.name || '—',
      wage: task.worker_wages?.[id] != null ? task.worker_wages[id] : Math.round(total / workerIds.length),
      advance: task.worker_advances?.[id] != null ? task.worker_advances[id] : Math.round((task.advance_amount ?? 0) / workerIds.length),
    }));
  };

  const totalWages = Object.values(form.worker_wages).reduce((s, v) => s + (Number(v) || 0), 0);
  const totalAdvances = Object.values(form.worker_advances).reduce((s, v) => s + (Number(v) || 0), 0);


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
                  <TableHead>{t('tasks.wageAmount')}</TableHead>
                  <TableHead>{t('tasks.advanceAmount')}</TableHead>
                  <TableHead>{t('tasks.paid')}</TableHead>
                  <TableHead className="text-right">{t('common.actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tasks.length === 0 ? (
                  <TableRow><TableCell colSpan={9} className="text-center py-8 text-slate-500">{t('common.noData')}</TableCell></TableRow>
                ) : tasks.map((task) => (
                  <TableRow key={task.id}>
                    <TableCell className="font-medium">{task.title}</TableCell>
                    <TableCell>
                      {getWorkerWageBreakdown(task).length === 0 ? (
                        <span className="text-slate-400">—</span>
                      ) : (
                        <div className="space-y-0.5">
                          {getWorkerWageBreakdown(task).map(({ id, name, wage, advance }) => (
                            <div key={id} className="flex items-center justify-between gap-3 text-sm">
                              <span>{name}</span>
                              <span className="flex items-center gap-2 text-slate-500">
                                {advance > 0 && <span className="text-amber-600">(-{formatFCFA(advance)})</span>}
                                <span>{formatFCFA(wage)}</span>
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>{getPlotName(task.plot_id)}</TableCell>
                    <TableCell>{task.due_date}</TableCell>
                    <TableCell><Badge className={statusColors[task.status] || ''}>{statusLabel(task.status)}</Badge></TableCell>
                    <TableCell>{formatFCFA(task.wage_amount ?? 0)}</TableCell>
                    <TableCell>{formatFCFA(task.advance_amount ?? 0)}</TableCell>
                    <TableCell><Badge className={task.wage_paid ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'}>{task.wage_paid ? t('tasks.paid') : t('tasks.unpaid')}</Badge></TableCell>
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
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <Label>{t('tasks.assignedWorker')}</Label>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" className="w-full justify-between h-9 font-normal">
                        <span className="truncate text-sm">
                          {form.worker_ids.length
                            ? form.worker_ids
                                .map((id) => workers.find((w) => w.id === id)?.name || '—')
                                .join(', ')
                            : <span className="text-slate-400">Sélectionner des ouvriers…</span>}
                        </span>
                        <ChevronDown className="h-4 w-4 opacity-50 shrink-0" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-72 max-h-64 overflow-y-auto">
                      {workers.length === 0 && (
                        <DropdownMenuItem disabled>Aucun ouvrier disponible</DropdownMenuItem>
                      )}
                      {workers.map((w) => (
                        <DropdownMenuCheckboxItem
                          key={w.id}
                          checked={form.worker_ids.includes(w.id)}
                          onCheckedChange={() => toggleWorkerAssignment(w.id)}
                        >
                          {w.name} ({w.role.replace('_', ' ')})
                        </DropdownMenuCheckboxItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
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
              {form.worker_ids.length > 0 && (
                <div>
                  <Label>Salaires par ouvrier (FCFA)</Label>
                  <div className="grid gap-2 rounded-md border border-slate-200 bg-slate-50 p-3">
                    <div className="grid grid-cols-[1fr_110px_110px] items-center gap-2 text-xs font-medium text-slate-500">
                      <span>Ouvrier</span>
                      <span>{t('tasks.advance')} / {t('tasks.wageAmount')}</span>
                    </div>
                    {form.worker_ids.map((id) => (
                      <div key={id} className="grid grid-cols-[1fr_110px_110px] items-center gap-2">
                        <span className="text-sm text-slate-700">
                          {workers.find((w) => w.id === id)?.name || '—'}
                        </span>
                        <Input
                          type="number"
                          min={0}
                          placeholder="Avance"
                          title={t('tasks.advance')}
                          value={form.worker_advances[id] ?? 0}
                          onChange={(e) =>
                            setForm((prev) => ({
                              ...prev,
                              worker_advances: { ...prev.worker_advances, [id]: Number(e.target.value) },
                            }))
                          }
                          className="h-8"
                        />
                        <Input
                          type="number"
                          min={0}
                          placeholder="Salaire"
                          title={t('tasks.wageAmount')}
                          value={form.worker_wages[id] ?? 0}
                          onChange={(e) =>
                            setForm((prev) => ({
                              ...prev,
                              worker_wages: { ...prev.worker_wages, [id]: Number(e.target.value) },
                            }))
                          }
                          className="h-8"
                        />
                      </div>
                    ))}
                    <div className="border-t border-slate-200 pt-2 space-y-1 text-sm">
                      <div className="flex items-center justify-between font-semibold text-slate-700">
                        <span>{t('tasks.totalWage')}</span>
                        <span>{formatFCFA(totalWages)}</span>
                      </div>
                      <div className="flex items-center justify-between text-slate-600">
                        <span>{t('tasks.totalAdvance')}</span>
                        <span>{formatFCFA(totalAdvances)}</span>
                      </div>
                      <div className="flex items-center justify-between font-semibold text-emerald-700">
                        <span>{t('tasks.netToPay')}</span>
                        <span>{formatFCFA(Math.max(0, totalWages - totalAdvances))}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-end">
                  <label className="flex items-center gap-2 text-sm text-slate-700">
                    <Checkbox checked={form.wage_paid} onCheckedChange={(checked) => setForm({ ...form, wage_paid: Boolean(checked) })} />
                    <span>{t('tasks.paid')}</span>
                  </label>
                </div>
                <div>
                  <Label>{t('tasks.status')}</Label>
                  <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as FarmTask['status'] })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{(['pending', 'in_progress', 'completed', 'cancelled'] as const).map((s) => <SelectItem key={s} value={s}>{statusLabel(s)}</SelectItem>)}</SelectContent>
                  </Select>
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
