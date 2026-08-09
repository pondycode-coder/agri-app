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
import { Plot } from '@/types/database';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Grid as GridIcon, Plus, Pencil, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const statusColors: Record<string, string> = {
  active: 'bg-emerald-100 text-emerald-800',
  fallow: 'bg-amber-100 text-amber-800',
  preparing: 'bg-blue-100 text-blue-800',
  inactive: 'bg-slate-100 text-slate-600',
};

export default function Plots() {
  const { t } = useI18n();
  const { toast } = useToast();
  const [, setTick] = useState(0);
  const [plots, setPlots] = useState<Plot[]>([]);
  const [farms, setFarms] = useState<ReturnType<typeof dbStore.getFarms>>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPlot, setEditingPlot] = useState<Plot | null>(null);
  const [form, setForm] = useState({ farm_id: '', name: '', size_in_hectares: 1, soil_type: 'Volcanique', status: 'active' as Plot['status'] });
  const [deleteId, setDeleteId] = useState<string | null>(null);

  useEffect(() => {
    const unsub = dbStore.subscribe(() => setTick((p) => p + 1));
    setPlots(dbStore.getPlots());
    setFarms(dbStore.getFarms());
    return unsub;
  }, []);

  useEffect(() => {
    setPlots(dbStore.getPlots());
    setFarms(dbStore.getFarms());
  }, [dialogOpen, deleteId]);

  const openCreate = () => {
    setEditingPlot(null);
    setForm({ farm_id: farms[0]?.id || '', name: '', size_in_hectares: 1, soil_type: 'Volcanique', status: 'active' });
    setDialogOpen(true);
  };

  const openEdit = (plot: Plot) => {
    setEditingPlot(plot);
    setForm({ farm_id: plot.farm_id, name: plot.name, size_in_hectares: plot.size_in_hectares, soil_type: plot.soil_type, status: plot.status });
    setDialogOpen(true);
  };

  const handleSave = () => {
    if (!form.farm_id) return;
    dbStore.savePlot({ ...form, id: editingPlot?.id });
    setDialogOpen(false);
    toast({ title: editingPlot ? t('common.successUpdated') : t('common.successCreated') });
  };

  const handleDelete = () => {
    if (deleteId) {
      dbStore.deletePlot(deleteId);
      setDeleteId(null);
      toast({ title: t('common.successDeleted') });
    }
  };

  const getFarmName = (farmId: string) => farms.find((f) => f.id === farmId)?.name || '—';

  const statusLabel = (s: string) => {
    const map: Record<string, string> = { active: t('plots.statusActive'), fallow: t('plots.statusFallow'), preparing: t('plots.statusPreparing'), inactive: t('plots.statusInactive') };
    return map[s] || s;
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <GridIcon className="h-6 w-6 text-emerald-600" />
              {t('plots.title')}
            </h1>
            <p className="text-sm text-slate-500 mt-1">{t('plots.subtitle')}</p>
          </div>
          <Button onClick={openCreate} className="bg-emerald-600 hover:bg-emerald-700">
            <Plus className="h-4 w-4 mr-2" />
            {t('plots.addPlot')}
          </Button>
        </div>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('plots.name')}</TableHead>
                  <TableHead>{t('plots.farm')}</TableHead>
                  <TableHead>{t('plots.size')}</TableHead>
                  <TableHead>{t('plots.soilType')}</TableHead>
                  <TableHead>{t('plots.status')}</TableHead>
                  <TableHead className="text-right">{t('common.actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {plots.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-slate-500">{t('common.noData')}</TableCell>
                  </TableRow>
                ) : (
                  plots.map((plot) => (
                    <TableRow key={plot.id}>
                      <TableCell className="font-medium">{plot.name}</TableCell>
                      <TableCell>{getFarmName(plot.farm_id)}</TableCell>
                      <TableCell>{plot.size_in_hectares} ha</TableCell>
                      <TableCell>{plot.soil_type}</TableCell>
                      <TableCell><Badge className={statusColors[plot.status] || ''}>{statusLabel(plot.status)}</Badge></TableCell>
                      <TableCell className="text-right space-x-2">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(plot)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" onClick={() => setDeleteId(plot.id)}>
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
              <DialogTitle>{editingPlot ? t('plots.editPlot') : t('plots.addPlot')}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>{t('plots.farm')}</Label>
                <Select value={form.farm_id} onValueChange={(v) => setForm({ ...form, farm_id: v })}>
                  <SelectTrigger><SelectValue placeholder={t('plots.farm')} /></SelectTrigger>
                  <SelectContent>
                    {farms.map((f) => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>{t('plots.name')}</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>{t('plots.size')}</Label>
                  <Input type="number" min={0.1} step={0.1} value={form.size_in_hectares} onChange={(e) => setForm({ ...form, size_in_hectares: parseFloat(e.target.value) || 0 })} />
                </div>
                <div>
                  <Label>{t('plots.soilType')}</Label>
                  <Select value={form.soil_type} onValueChange={(v) => setForm({ ...form, soil_type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {['Volcanique', 'Ferrallitique', 'Argilo-limoneux', 'Sablonneux', 'Alluvial'].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>{t('plots.status')}</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as Plot['status'] })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(['active', 'fallow', 'preparing', 'inactive'] as const).map((s) => <SelectItem key={s} value={s}>{statusLabel(s)}</SelectItem>)}
                  </SelectContent>
                </Select>
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
