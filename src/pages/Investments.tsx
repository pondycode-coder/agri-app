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
import { Investment } from '@/types/database';
import { formatFCFA } from '@/types/database';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { MobileListContainer, MobileListItem, MobileEmptyState } from '@/components/MobileList';
import { PageHeader } from '@/components/PageHeader';
import { TrendingUp, Plus, Pencil, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Pagination, PAGE_SIZE, clampPage } from '@/components/Pagination';

const typeLabels: Record<string, string> = {
  equipment: 'Équipement', infrastructure: 'Infrastructure', irrigation: 'Irrigation', land: 'Foncier', other: 'Autre',
};

const statusColors: Record<string, string> = {
  active: 'bg-emerald-100 text-emerald-800',
  matured: 'bg-blue-100 text-blue-800',
  cancelled: 'bg-slate-100 text-slate-600',
};

export default function Investments() {
  const { t } = useI18n();
  const { toast } = useToast();
  const [, setTick] = useState(0);
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Investment | null>(null);
  const [form, setForm] = useState({
    name: '', type: 'equipment' as Investment['type'], amount: 0, date: new Date().toISOString().split('T')[0],
    description: '', expected_return: 0, return_date: '', status: 'active' as Investment['status'],
  });
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const cp = clampPage(page, investments.length);
  const paginatedInvestments = investments.slice((cp - 1) * PAGE_SIZE, cp * PAGE_SIZE);

  useEffect(() => {
    const unsub = dbStore.subscribe(() => setTick((p) => p + 1));
    setInvestments(dbStore.getInvestments());
    return unsub;
  }, []);

  useEffect(() => { setInvestments(dbStore.getInvestments()); }, [dialogOpen, deleteId]);

  const openCreate = () => {
    setEditing(null);
    setForm({ name: '', type: 'equipment', amount: 0, date: new Date().toISOString().split('T')[0], description: '', expected_return: 0, return_date: '', status: 'active' });
    setDialogOpen(true);
  };

  const openEdit = (inv: Investment) => {
    setEditing(inv);
    setForm({ name: inv.name, type: inv.type, amount: inv.amount, date: inv.date, description: inv.description || '', expected_return: inv.expected_return || 0, return_date: inv.return_date || '', status: inv.status });
    setDialogOpen(true);
  };

  const handleSave = () => {
    dbStore.saveInvestment({ ...form, id: editing?.id });
    setDialogOpen(false);
    toast({ title: editing ? t('common.successUpdated') : t('common.successCreated') });
  };

  const handleDelete = () => {
    if (deleteId) { doDelete(deleteId); }
  };

  const doDelete = (id: string) => {
    dbStore.deleteInvestment(id);
    setDeleteId(null);
    toast({ title: t('common.successDeleted') });
  };

  const statusLabel = (s: string) => {
    const map: Record<string, string> = { active: t('investments.statusActive'), matured: t('investments.statusMatured'), cancelled: t('investments.statusCancelled') };
    return map[s] || s;
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <PageHeader icon={TrendingUp} title={t('investments.title')} subtitle={t('investments.subtitle')}>
          <Button onClick={openCreate} className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700"><Plus className="h-4 w-4 mr-2" />{t('investments.addInvestment')}</Button>
        </PageHeader>

        <Card>
          <CardContent className="p-0">
            <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('investments.name')}</TableHead>
                  <TableHead>{t('investments.type')}</TableHead>
                  <TableHead>{t('investments.amount')}</TableHead>
                  <TableHead>{t('investments.date')}</TableHead>
                  <TableHead>{t('investments.expectedReturn')}</TableHead>
                  <TableHead>{t('investments.status')}</TableHead>
                  <TableHead className="text-right">{t('common.actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedInvestments.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-8 text-slate-500">{t('common.noData')}</TableCell></TableRow>
                ) : paginatedInvestments.map((inv) => (
                  <TableRow key={inv.id}>
                    <TableCell className="font-medium">{inv.name}</TableCell>
                    <TableCell><Badge variant="secondary">{typeLabels[inv.type] || inv.type}</Badge></TableCell>
                    <TableCell>{formatFCFA(inv.amount)}</TableCell>
                    <TableCell>{inv.date}</TableCell>
                    <TableCell>{inv.expected_return ? formatFCFA(inv.expected_return) : '—'}</TableCell>
                    <TableCell><Badge className={statusColors[inv.status] || ''}>{statusLabel(inv.status)}</Badge></TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(inv)}><Pencil className="h-4 w-4" /></Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" onClick={() => setDeleteId(inv.id)}><Trash2 className="h-4 w-4 text-red-500" /></Button>
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
            </div>
            <MobileListContainer>
              {paginatedInvestments.map((inv) => (
                <MobileListItem key={inv.id} onEdit={() => openEdit(inv)} onDelete={() => doDelete(inv.id)}>
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-semibold text-sm text-slate-800 dark:text-slate-200 truncate">{inv.name}</p>
                    <span className="shrink-0 text-sm font-semibold text-slate-800 dark:text-slate-200">{formatFCFA(inv.amount)}</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 pt-1 text-xs text-slate-500">
                    <Badge variant="secondary">{typeLabels[inv.type] || inv.type}</Badge>
                    <Badge className={statusColors[inv.status] || ''}>{statusLabel(inv.status)}</Badge>
                    <span>{inv.date}</span>
                    {inv.expected_return ? <span className="text-slate-500">· Retour attendu : {formatFCFA(inv.expected_return)}</span> : null}
                  </div>
                </MobileListItem>
              ))}
            </MobileListContainer>
            {paginatedInvestments.length === 0 && <MobileEmptyState message={t('common.noData')} />}
            <Pagination total={investments.length} page={cp} onPageChange={setPage} />
          </CardContent>
        </Card>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>{editing ? t('investments.editInvestment') : t('investments.addInvestment')}</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div><Label>{t('investments.name')}</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label>{t('investments.type')}</Label>
                  <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v as Investment['type'] })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{Object.entries(typeLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>{t('investments.status')}</Label>
                  <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as Investment['status'] })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{(['active', 'matured', 'cancelled'] as const).map((s) => <SelectItem key={s} value={s}>{statusLabel(s)}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label>{t('investments.amount')}</Label><Input type="number" min={0} value={form.amount} onChange={(e) => setForm({ ...form, amount: parseInt(e.target.value) || 0 })} /></div>
                <div><Label>{t('investments.date')}</Label><Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label>{t('investments.expectedReturn')}</Label><Input type="number" min={0} value={form.expected_return} onChange={(e) => setForm({ ...form, expected_return: parseInt(e.target.value) || 0 })} /></div>
                <div><Label>{t('investments.returnDate')}</Label><Input type="date" value={form.return_date} onChange={(e) => setForm({ ...form, return_date: e.target.value })} /></div>
              </div>
              <div><Label>{t('common.details')}</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
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
