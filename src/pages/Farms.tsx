import { useEffect, useState } from 'react';
import { MainLayout } from '@/components/MainLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useI18n } from '@/context/I18nProvider';
import { dbStore } from '@/services/store';
import { Farm } from '@/types/database';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tractor, Plus, Pencil, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function Farms() {
  const { t } = useI18n();
  const { toast } = useToast();
  const [, setTick] = useState(0);
  const [farms, setFarms] = useState<Farm[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingFarm, setEditingFarm] = useState<Farm | null>(null);
  const [form, setForm] = useState({ name: '', location: '', size_in_hectares: 1, description: '' });
  const [deleteId, setDeleteId] = useState<string | null>(null);

  useEffect(() => {
    const unsub = dbStore.subscribe(() => setTick((p) => p + 1));
    setFarms(dbStore.getFarms());
    return unsub;
  }, []);

  useEffect(() => {
    setFarms(dbStore.getFarms());
  }, [dialogOpen, deleteId]);

  const openCreate = () => {
    setEditingFarm(null);
    setForm({ name: '', location: '', size_in_hectares: 1, description: '' });
    setDialogOpen(true);
  };

  const openEdit = (farm: Farm) => {
    setEditingFarm(farm);
    setForm({ name: farm.name, location: farm.location, size_in_hectares: farm.size_in_hectares, description: farm.description || '' });
    setDialogOpen(true);
  };

  const handleSave = () => {
    dbStore.saveFarm({ ...form, id: editingFarm?.id });
    setDialogOpen(false);
    toast({ title: editingFarm ? t('common.successUpdated') : t('common.successCreated') });
  };

  const handleDelete = () => {
    if (deleteId) {
      dbStore.deleteFarm(deleteId);
      setDeleteId(null);
      toast({ title: t('common.successDeleted') });
    }
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Tractor className="h-6 w-6 text-emerald-600" />
              {t('farms.title')}
            </h1>
            <p className="text-sm text-slate-500 mt-1">{t('farms.subtitle')}</p>
          </div>
          <Button onClick={openCreate} className="bg-emerald-600 hover:bg-emerald-700">
            <Plus className="h-4 w-4 mr-2" />
            {t('farms.addFarm')}
          </Button>
        </div>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('farms.name')}</TableHead>
                  <TableHead>{t('farms.location')}</TableHead>
                  <TableHead>{t('farms.hectares')}</TableHead>
                  <TableHead>{t('farms.plotsCount')}</TableHead>
                  <TableHead className="text-right">{t('common.actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {farms.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-slate-500">{t('common.noData')}</TableCell>
                  </TableRow>
                ) : (
                  farms.map((farm) => (
                    <TableRow key={farm.id}>
                      <TableCell className="font-medium">{farm.name}</TableCell>
                      <TableCell>{farm.location}</TableCell>
                      <TableCell>{farm.size_in_hectares} ha</TableCell>
                      <TableCell><Badge variant="secondary">{farm.plots}</Badge></TableCell>
                      <TableCell className="text-right space-x-2">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(farm)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" onClick={() => setDeleteId(farm.id)}>
                              <Trash2 className="h-4 w-4 text-red-500" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>{t('common.confirm')}</AlertDialogTitle>
                              <AlertDialogDescription>{t('common.areYouSure')}</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel onClick={() => setDeleteId(null)}>{t('common.cancel')}</AlertDialogCancel>
                              <AlertDialogAction onClick={handleDelete}>{t('common.delete')}</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingFarm ? t('farms.editFarm') : t('farms.addFarm')}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>{t('farms.name')}</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder={t('farms.name')} />
              </div>
              <div>
                <Label>{t('farms.location')}</Label>
                <Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder={t('farms.locationPlaceholder')} />
              </div>
              <div>
                <Label>{t('farms.hectares')}</Label>
                <Input type="number" min={0.1} step={0.1} value={form.size_in_hectares} onChange={(e) => setForm({ ...form, size_in_hectares: parseFloat(e.target.value) || 0 })} />
              </div>
              <div>
                <Label>{t('farms.description')}</Label>
                <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
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
