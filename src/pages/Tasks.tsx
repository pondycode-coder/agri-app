import { Fragment, useEffect, useState } from 'react';
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
import { FarmTask, TaskAdvanceBatch } from '@/types/database';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CheckSquare, Plus, Pencil, Trash2, ChevronDown, Search, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Pagination, PAGE_SIZE, clampPage } from '@/components/Pagination';
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
    farm_id: '', title: '', description: '', worker_ids: [] as string[], worker_wages: {} as Record<string, number>, advance_batches: [] as TaskAdvanceBatch[], plot_id: '',
    wage_amount: 0, wage_paid: false,
    status: 'pending' as FarmTask['status'], assigned_date: new Date().toISOString().split('T')[0],
    due_date: '',
  });
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | FarmTask['status']>('all');
  const [dueDateFilter, setDueDateFilter] = useState('');
  const [page, setPage] = useState(1);

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
    setForm({ farm_id: farms[0]?.id || '', title: '', description: '', worker_ids: [], worker_wages: {}, advance_batches: [], plot_id: '', wage_amount: 0, wage_paid: false, status: 'pending', assigned_date: new Date().toISOString().split('T')[0], due_date: '' });
    setDialogOpen(true);
  };

  const workerAdvanceBatches = (task: FarmTask): TaskAdvanceBatch[] => {
    const workerIds = task.worker_ids?.length ? task.worker_ids : task.worker_id ? [task.worker_id] : [];
    if (task.advance_batches && task.advance_batches.length > 0) {
      return task.advance_batches.map((b) => ({ ...b, amounts: { ...b.amounts } }));
    }
    const amts: Record<string, number> =
      task.worker_advances && Object.keys(task.worker_advances).length > 0
        ? { ...task.worker_advances }
        : workerIds.length
          ? Object.fromEntries(workerIds.map((id) => [id, Math.round((task.advance_amount ?? 0) / workerIds.length)]))
          : {};
    const total = Object.values(amts).reduce((s, v) => s + (Number(v) || 0), 0);
    if (total <= 0) return [];
    return [{ id: 'legacy-' + task.id, date: task.assigned_date || '', amounts: amts }];
  };

  const openEdit = (task: FarmTask) => {
    const workerIds = task.worker_ids?.length ? task.worker_ids : task.worker_id ? [task.worker_id] : [];
    const workerWages =
      task.worker_wages && Object.keys(task.worker_wages).length > 0
        ? { ...task.worker_wages }
        : workerIds.length
          ? Object.fromEntries(workerIds.map((id) => [id, Math.round((task.wage_amount ?? 0) / workerIds.length)]))
          : {};
    setEditing(task);
    setForm({
      farm_id: task.farm_id,
      title: task.title,
      description: task.description || '',
      worker_ids: workerIds,
      worker_wages: workerWages,
      advance_batches: workerAdvanceBatches(task),
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
      let advance_batches = prev.advance_batches.map((b) => ({ ...b, amounts: { ...b.amounts } }));
      if (included) {
        delete worker_wages[workerId];
        advance_batches = advance_batches
          .map((b) => {
            const amounts = { ...b.amounts };
            delete amounts[workerId];
            return { ...b, amounts };
          })
          .filter((b) => Object.keys(b.amounts).length > 0);
        return { ...prev, worker_ids: prev.worker_ids.filter((id) => id !== workerId), worker_wages, advance_batches };
      }
      worker_wages[workerId] = 0;
      if (advance_batches.length === 0) {
        advance_batches = [
          { id: crypto.randomUUID(), date: prev.assigned_date || new Date().toISOString().split('T')[0], amounts: { [workerId]: 0 } },
        ];
      } else {
        advance_batches = advance_batches.map((b) => ({ ...b, amounts: { ...b.amounts, [workerId]: 0 } }));
      }
      return { ...prev, worker_ids: [...prev.worker_ids, workerId], worker_wages, advance_batches };
    });
  };

  const batchAmountSum = (b: TaskAdvanceBatch) => Object.values(b.amounts).reduce((s, v) => s + (Number(v) || 0), 0);
  const addAdvanceBatch = () => {
    setForm((prev) => ({
      ...prev,
      advance_batches: [
        ...prev.advance_batches,
        { id: crypto.randomUUID(), date: new Date().toISOString().split('T')[0], amounts: Object.fromEntries(prev.worker_ids.map((wid) => [wid, 0])) },
      ],
    }));
  };
  const updateAdvanceBatch = (bi: number, patch: Partial<TaskAdvanceBatch>) => {
    setForm((prev) => ({ ...prev, advance_batches: prev.advance_batches.map((b, i) => (i === bi ? { ...b, ...patch } : b)) }));
  };
  const updateAdvanceBatchAmount = (bi: number, wid: string, value: number) => {
    setForm((prev) => ({ ...prev, advance_batches: prev.advance_batches.map((b, i) => (i === bi ? { ...b, amounts: { ...b.amounts, [wid]: value } } : b)) }));
  };
  const removeAdvanceBatch = (bi: number) => {
    setForm((prev) => ({ ...prev, advance_batches: prev.advance_batches.filter((_, i) => i !== bi) }));
  };
  const getWorkerName = (id?: string | null) => (id ? workers.find((w) => w.id === id)?.name || id : '—');
  const getAdvanceBatches = (task: FarmTask): TaskAdvanceBatch[] => {
    if (task.advance_batches && task.advance_batches.length > 0) return task.advance_batches;
    return workerAdvanceBatches(task);
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
  const totalAdvances = form.advance_batches.reduce((s, b) => s + Object.values(b.amounts).reduce((a, v) => a + (Number(v) || 0), 0), 0);

  const filteredTasks = tasks
    .filter((task) => {
      const q = search.trim().toLowerCase();
      const workerNames = getWorkerWageBreakdown(task).map((w) => w.name.toLowerCase()).join(' ');
      const matchesSearch = !q || task.title.toLowerCase().includes(q) || workerNames.includes(q);
      const matchesStatus = statusFilter === 'all' || task.status === statusFilter;
      const matchesDate = !dueDateFilter || (task.due_date || '') === dueDateFilter;
      return matchesSearch && matchesStatus && matchesDate;
    })
    .sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, dueDateFilter]);

  const cp = clampPage(page, filteredTasks.length);
  const paginatedTasks = filteredTasks.slice((cp - 1) * PAGE_SIZE, cp * PAGE_SIZE);


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
            <div className="flex flex-col sm:flex-row gap-3 p-4 border-b">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  placeholder={t('common.searchPlaceholder')}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
                <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('common.filterAll')}</SelectItem>
                  <SelectItem value="pending">{t('tasks.statusPending')}</SelectItem>
                  <SelectItem value="in_progress">{t('tasks.statusInProgress')}</SelectItem>
                  <SelectItem value="completed">{t('tasks.statusCompleted')}</SelectItem>
                  <SelectItem value="cancelled">{t('tasks.statusCancelled')}</SelectItem>
                </SelectContent>
              </Select>
              <div className="relative">
                <Input
                  type="date"
                  value={dueDateFilter}
                  onChange={(e) => setDueDateFilter(e.target.value)}
                  className="w-full sm:w-44"
                  title={t('tasks.filterByDueDate')}
                />
                {dueDateFilter && (
                  <Button type="button" variant="ghost" size="icon" className="absolute right-0 top-0 h-full w-8"
                    onClick={() => setDueDateFilter('')}>
                    <X className="h-4 w-4 text-slate-400" />
                  </Button>
                )}
              </div>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8" />
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
                {paginatedTasks.length === 0 ? (
                  <TableRow><TableCell colSpan={10} className="text-center py-8 text-slate-500">{t('common.noData')}</TableCell></TableRow>
                ) : paginatedTasks.map((task) => {
                  const batches = getAdvanceBatches(task);
                  const isExpanded = expandedTaskId === task.id;
                  return (
                    <Fragment key={task.id}>
                      <TableRow className="cursor-pointer" onClick={() => setExpandedTaskId(isExpanded ? null : task.id)}>
                        <TableCell className="w-8">
                          <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${isExpanded ? '' : '-rotate-90'}`} />
                        </TableCell>
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
                          <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); openEdit(task); }}><Pencil className="h-4 w-4" /></Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); setDeleteId(task.id); }}><Trash2 className="h-4 w-4 text-red-500" /></Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader><AlertDialogTitle>{t('common.confirm')}</AlertDialogTitle><AlertDialogDescription>{t('common.areYouSure')}</AlertDialogDescription></AlertDialogHeader>
                              <AlertDialogFooter><AlertDialogCancel onClick={() => setDeleteId(null)}>{t('common.cancel')}</AlertDialogCancel><AlertDialogAction onClick={handleDelete}>{t('common.delete')}</AlertDialogAction></AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </TableCell>
                      </TableRow>
                      {isExpanded && (
                        <TableRow>
                          <TableCell className="py-1" />
                          <TableCell colSpan={9} className="py-1 bg-slate-50/70">
                            <div className="py-2 space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="text-sm font-semibold text-slate-700">{t('tasks.advances')}</span>
                                <span className="text-xs text-slate-500">{t('tasks.netToPay')} : {formatFCFA(Math.max(0, (task.wage_amount ?? 0) - (task.advance_amount ?? 0)))}</span>
                              </div>
                              {batches.length === 0 ? (
                                <p className="text-sm text-slate-400">{t('tasks.noAdvances')}</p>
                              ) : (
                                <div className="grid gap-2 sm:grid-cols-3">
                                  {batches.map((b) => (
                                    <div key={b.id} className="rounded-md border border-slate-200 bg-white p-2">
                                      <div className="flex items-center justify-between mb-1">
                                        <span className="text-xs font-semibold text-slate-500">{t('tasks.advanceBatch')} #{batches.findIndex((x) => x.id === b.id) + 1}</span>
                                        <span className="text-xs text-slate-500">{b.date || '—'}</span>
                                      </div>
                                      {Object.entries(b.amounts).map(([wid, amt]) => (
                                        <div key={wid} className="flex items-center justify-between text-sm">
                                          <span className="text-slate-700">{getWorkerName(wid)}</span>
                                          <span className="text-amber-600 font-medium">{formatFCFA(Number(amt) || 0)}</span>
                                        </div>
                                      ))}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </Fragment>
                  );
                })}
              </TableBody>
            </Table>
            <Pagination total={filteredTasks.length} page={cp} onPageChange={setPage} />
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
                  <Label>Salaires par ouvrier (F)</Label>
                  <div className="grid gap-2 rounded-md border border-slate-200 bg-slate-50 p-3">
                    <div className="grid grid-cols-[1fr_150px] items-center gap-2 text-xs font-medium text-slate-500">
                      <span>Ouvrier</span>
                      <span>{t('tasks.wageAmount')}</span>
                    </div>
                    {form.worker_ids.map((id) => (
                      <div key={id} className="grid grid-cols-[1fr_150px] items-center gap-2">
                        <span className="text-sm text-slate-700">
                          {workers.find((w) => w.id === id)?.name || '—'}
                        </span>
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
                    <div className="mt-1">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-sm font-medium text-slate-700">{t('tasks.advances')}</span>
                        <Button type="button" variant="outline" size="sm" onClick={addAdvanceBatch} disabled={form.worker_ids.length === 0}>
                          <Plus className="h-3.5 w-3.5 mr-1" />{t('tasks.addAdvance')}
                        </Button>
                      </div>
                      {form.advance_batches.length === 0 ? (
                        <p className="text-sm text-slate-400">{t('tasks.noAdvances')}</p>
                      ) : (
                        <div className="space-y-2">
                          {form.advance_batches.map((batch, bi) => (
                            <div key={batch.id} className="rounded-md border border-slate-200 bg-white p-2 space-y-1.5">
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-semibold text-slate-600">
                                  {t('tasks.advanceBatch')} #{bi + 1} · {batch.date || '—'} · {batchAmountSum(batch) > 0 ? formatFCFA(batchAmountSum(batch)) : t('tasks.noAdvances')}
                                </span>
                                {form.advance_batches.length > 1 && (
                                  <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeAdvanceBatch(bi)}>
                                    <X className="h-3.5 w-3.5 text-red-500" />
                                  </Button>
                                )}
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-slate-500 w-20 shrink-0">{t('tasks.advanceDate')}</span>
                                <Input type="date" value={batch.date} onChange={(e) => updateAdvanceBatch(bi, { date: e.target.value })} className="h-8 w-44" />
                              </div>
                              <div className="grid grid-cols-[1fr_150px] items-center gap-2 text-xs font-medium text-slate-500">
                                <span>{t('tasks.assignedWorker')}</span>
                                <span>{t('tasks.advance')}</span>
                              </div>
                              {form.worker_ids.map((wid) => (
                                <div key={wid} className="grid grid-cols-[1fr_150px] items-center gap-2">
                                  <span className="text-sm text-slate-700">{workers.find((w) => w.id === wid)?.name || '—'}</span>
                                  <Input
                                    type="number"
                                    min={0}
                                    placeholder="Avance"
                                    title={t('tasks.advance')}
                                    value={batch.amounts[wid] ?? 0}
                                    onChange={(e) => updateAdvanceBatchAmount(bi, wid, Number(e.target.value))}
                                    className="h-8"
                                  />
                                </div>
                              ))}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
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
