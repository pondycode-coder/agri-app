import { useEffect, useState } from 'react';
import { MainLayout } from '@/components/MainLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useI18n } from '@/context/I18nProvider';
import { dbStore } from '@/services/store';
import { Worker } from '@/types/database';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Users, Plus, Pencil, Trash2, Search } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const roleLabels: Record<string, string> = {
  field_worker: 'Ouvrier', agronomist: 'Agronome', machine_operator: 'Conducteur', supervisor: 'Chef d\'équipe',
};

export default function Workers() {
  const { t } = useI18n();
  const { toast } = useToast();
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [farms, setFarms] = useState<ReturnType<typeof dbStore.getFarms>>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Worker | null>(null);
  const [form, setForm] = useState({ farm_id: '', name: '', role: 'field_worker' as Worker['role'], phone_number: '', is_active: true });
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [roleFilter, setRoleFilter] = useState<'all' | Worker['role']>('all');

  useEffect(() => {
    const refresh = () => {
      setWorkers(dbStore.getWorkers());
      setFarms(dbStore.getFarms());
    };
    const unsub = dbStore.subscribe(refresh);
    refresh();
    return unsub;
  }, []);

  const openCreate = () => {
    setEditing(null);
    setForm({ farm_id: farms[0]?.id || '', name: '', role: 'field_worker', phone_number: '', is_active: true });
    setDialogOpen(true);
  };

  const openEdit = (w: Worker) => {
    setEditing(w);
    setForm({ farm_id: w.farm_id, name: w.name, role: w.role, phone_number: w.phone_number, is_active: w.is_active });
    setDialogOpen(true);
  };

  const handleSave = () => {
    if (!form.farm_id) return;
    dbStore.saveWorker({ ...form, id: editing?.id });
    setDialogOpen(false);
    toast({ title: editing ? t('common.successUpdated') : t('common.successCreated') });
  };

  const handleDelete = () => {
    if (deleteId) { dbStore.deleteWorker(deleteId); setDeleteId(null); toast({ title: t('common.successDeleted') }); }
  };

  const handleToggleActive = (w: Worker) => {
    dbStore.saveWorker({ ...w, is_active: !w.is_active });
    toast({ title: w.is_active ? t('workers.inactive') : t('workers.active') });
  };

  const filteredWorkers = workers.filter((w) => {
    const q = search.trim().toLowerCase();
    const matchesSearch = !q || w.name.toLowerCase().includes(q) || w.phone_number.toLowerCase().includes(q);
    const matchesStatus = statusFilter === 'all' || (statusFilter === 'active' ? w.is_active : !w.is_active);
    const matchesRole = roleFilter === 'all' || w.role === roleFilter;
    return matchesSearch && matchesStatus && matchesRole;
  });

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2"><Users className="h-6 w-6 text-emerald-600" />{t('workers.title')}</h1>
            <p className="text-sm text-slate-500 mt-1">{t('workers.subtitle')}</p>
          </div>
          <Button onClick={openCreate} className="bg-emerald-600 hover:bg-emerald-700"><Plus className="h-4 w-4 mr-2" />{t('workers.addWorker')}</Button>
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
              <div className="flex gap-3">
                <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
                  <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('common.filterAll')}</SelectItem>
                    <SelectItem value="active">{t('workers.active')}</SelectItem>
                    <SelectItem value="inactive">{t('workers.inactive')}</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={roleFilter} onValueChange={(v) => setRoleFilter(v as typeof roleFilter)}>
                  <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('common.filterAll')}</SelectItem>
                    {Object.entries(roleLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('workers.name')}</TableHead>
                  <TableHead>{t('workers.role')}</TableHead>
                  <TableHead>{t('workers.phone')}</TableHead>
                  <TableHead>{t('workers.tasksCompleted')}</TableHead>
                  <TableHead>{t('workers.status')}</TableHead>
                  <TableHead className="text-right">{t('common.actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredWorkers.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-8 text-slate-500">{t('common.noData')}</TableCell></TableRow>
                ) : filteredWorkers.map((w) => (
                  <TableRow key={w.id}>
                    <TableCell className="font-medium">{w.name}</TableCell>
                    <TableCell><Badge variant="secondary">{roleLabels[w.role] || w.role}</Badge></TableCell>
                    <TableCell>{w.phone_number}</TableCell>
                    <TableCell>{w.total_tasks_completed}</TableCell>
                    <TableCell><Badge className={w.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'}>{w.is_active ? t('workers.active') : t('workers.inactive')}</Badge></TableCell>
                    <TableCell className="text-right space-x-2">
                      <Switch
                        checked={w.is_active}
                        onCheckedChange={() => handleToggleActive(w)}
                        aria-label={t('workers.status')}
                        className="mr-1 data-[state=checked]:bg-emerald-600"
                      />
                      <Button variant="ghost" size="icon" onClick={() => openEdit(w)}><Pencil className="h-4 w-4" /></Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" onClick={() => setDeleteId(w.id)}><Trash2 className="h-4 w-4 text-red-500" /></Button>
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
          <DialogContent>
            <DialogHeader><DialogTitle>{editing ? t('workers.editWorker') : t('workers.addWorker')}</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div><Label>{t('workers.name')}</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label>{t('workers.role')}</Label>
                  <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v as Worker['role'] })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{Object.entries(roleLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>{t('plots.farm')}</Label>
                  <Select value={form.farm_id} onValueChange={(v) => setForm({ ...form, farm_id: v })}>
                    <SelectTrigger><SelectValue placeholder={t('plots.farm')} /></SelectTrigger>
                    <SelectContent>{farms.map((f) => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-4">
                <div><Label>{t('workers.phone')}</Label><Input value={form.phone_number} onChange={(e) => setForm({ ...form, phone_number: e.target.value })} placeholder="+237 6XX XXX XXX" /></div>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-slate-200 px-4 py-3">
                <div>
                  <Label className="font-medium">{t('workers.status')}</Label>
                  <p className="text-xs text-slate-500">{form.is_active ? t('workers.active') : t('workers.inactive')}</p>
                </div>
                <Switch
                  checked={form.is_active}
                  onCheckedChange={(v) => setForm({ ...form, is_active: v })}
                  className="data-[state=checked]:bg-emerald-600"
                />
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
