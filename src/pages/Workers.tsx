import { useEffect, useState } from 'react';
import { MainLayout } from '@/components/MainLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useI18n } from '@/context/I18nProvider';
import { dbStore } from '@/services/store';
import { Worker } from '@/types/database';
import { formatFCFA } from '@/types/database';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Users, Plus, Pencil, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const roleLabels: Record<string, string> = {
  field_worker: 'Ouvrier', agronomist: 'Agronome', machine_operator: 'Conducteur', supervisor: 'Chef d\'équipe',
};

export default function Workers() {
  const { t } = useI18n();
  const { toast } = useToast();
  const [, setTick] = useState(0);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [farms, setFarms] = useState<ReturnType<typeof dbStore.getFarms>>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Worker | null>(null);
  const [form, setForm] = useState({ farm_id: '', name: '', role: 'field_worker' as Worker['role'], phone_number: '', daily_wage: 3500 });
  const [deleteId, setDeleteId] = useState<string | null>(null);

  useEffect(() => {
    const unsub = dbStore.subscribe(() => setTick((p) => p + 1));
    setWorkers(dbStore.getWorkers());
    setFarms(dbStore.getFarms());
    return unsub;
  }, []);

  useEffect(() => { setWorkers(dbStore.getWorkers()); setFarms(dbStore.getFarms()); }, [dialogOpen, deleteId]);

  const openCreate = () => {
    setEditing(null);
    setForm({ farm_id: farms[0]?.id || '', name: '', role: 'field_worker', phone_number: '', daily_wage: 3500 });
    setDialogOpen(true);
  };

  const openEdit = (w: Worker) => {
    setEditing(w);
    setForm({ farm_id: w.farm_id, name: w.name, role: w.role, phone_number: w.phone_number, daily_wage: w.daily_wage });
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
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('workers.name')}</TableHead>
                  <TableHead>{t('workers.role')}</TableHead>
                  <TableHead>{t('workers.phone')}</TableHead>
                  <TableHead>{t('workers.dailyWage')}</TableHead>
                  <TableHead>{t('workers.tasksCompleted')}</TableHead>
                  <TableHead>{t('workers.status')}</TableHead>
                  <TableHead className="text-right">{t('common.actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {workers.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-8 text-slate-500">{t('common.noData')}</TableCell></TableRow>
                ) : workers.map((w) => (
                  <TableRow key={w.id}>
                    <TableCell className="font-medium">{w.name}</TableCell>
                    <TableCell><Badge variant="secondary">{roleLabels[w.role] || w.role}</Badge></TableCell>
                    <TableCell>{w.phone_number}</TableCell>
                    <TableCell>{formatFCFA(w.daily_wage)}</TableCell>
                    <TableCell>{w.total_tasks_completed}</TableCell>
                    <TableCell><Badge className={w.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'}>{w.is_active ? t('workers.active') : t('workers.inactive')}</Badge></TableCell>
                    <TableCell className="text-right space-x-2">
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
              <div className="grid grid-cols-2 gap-4">
                <div><Label>{t('workers.phone')}</Label><Input value={form.phone_number} onChange={(e) => setForm({ ...form, phone_number: e.target.value })} placeholder="+237 6XX XXX XXX" /></div>
                <div><Label>{t('workers.dailyWage')}</Label><Input type="number" min={0} value={form.daily_wage} onChange={(e) => setForm({ ...form, daily_wage: parseInt(e.target.value) || 0 })} /></div>
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
