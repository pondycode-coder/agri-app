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
import { CropCycle } from '@/types/database';
import { formatFCFA } from '@/types/database';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Sprout, Plus, Pencil, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const statusColors: Record<string, string> = {
  planted: 'bg-blue-100 text-blue-800',
  growing: 'bg-emerald-100 text-emerald-800',
  harvested: 'bg-amber-100 text-amber-800',
  failed: 'bg-red-100 text-red-800',
};

export default function CropCycles() {
  const { t } = useI18n();
  const { toast } = useToast();
  const [, setTick] = useState(0);
  const [crops, setCrops] = useState<CropCycle[]>([]);
  const [plots, setPlots] = useState<ReturnType<typeof dbStore.getPlots>>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCrop, setEditingCrop] = useState<CropCycle | null>(null);
  const [form, setForm] = useState({
    plot_id: '', crop_name: 'Cacao', variety: '', season: '', planting_date: '', expected_harvest_date: '',
    status: 'planted' as CropCycle['status'], estimated_cost_fcfa: 0, revenue_fcfa: 0,
  });
  const [deleteId, setDeleteId] = useState<string | null>(null);

  useEffect(() => {
    const unsub = dbStore.subscribe(() => setTick((p) => p + 1));
    setCrops(dbStore.getCropCycles());
    setPlots(dbStore.getPlots());
    return unsub;
  }, []);

  useEffect(() => {
    setCrops(dbStore.getCropCycles());
    setPlots(dbStore.getPlots());
  }, [dialogOpen, deleteId]);

  const openCreate = () => {
    setEditingCrop(null);
    setForm({ plot_id: plots[0]?.id || '', crop_name: 'Cacao', variety: '', season: '', planting_date: new Date().toISOString().split('T')[0], expected_harvest_date: '', status: 'planted', estimated_cost_fcfa: 0, revenue_fcfa: 0 });
    setDialogOpen(true);
  };

  const openEdit = (crop: CropCycle) => {
    setEditingCrop(crop);
    setForm({ plot_id: crop.plot_id, crop_name: crop.crop_name, variety: crop.variety, season: crop.season, planting_date: crop.planting_date, expected_harvest_date: crop.expected_harvest_date, status: crop.status, estimated_cost_fcfa: crop.estimated_cost_fcfa, revenue_fcfa: crop.revenue_fcfa || 0 });
    setDialogOpen(true);
  };

  const handleSave = () => {
    if (!form.plot_id) return;
    dbStore.saveCropCycle({ ...form, id: editingCrop?.id });
    setDialogOpen(false);
    toast({ title: editingCrop ? t('common.successUpdated') : t('common.successCreated') });
  };

  const handleDelete = () => {
    if (deleteId) { dbStore.deleteCropCycle(deleteId); setDeleteId(null); toast({ title: t('common.successDeleted') }); }
  };

  const statusLabel = (s: string) => {
    const map: Record<string, string> = { planted: t('crops.statusPlanted'), growing: t('crops.statusGrowing'), harvested: t('crops.statusHarvested'), failed: t('crops.statusFailed') };
    return map[s] || s;
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2"><Sprout className="h-6 w-6 text-emerald-600" />{t('crops.title')}</h1>
            <p className="text-sm text-slate-500 mt-1">{t('crops.subtitle')}</p>
          </div>
          <Button onClick={openCreate} className="bg-emerald-600 hover:bg-emerald-700"><Plus className="h-4 w-4 mr-2" />{t('crops.addCrop')}</Button>
        </div>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('crops.cropName')}</TableHead>
                  <TableHead>{t('crops.variety')}</TableHead>
                  <TableHead>{t('crops.plantingDate')}</TableHead>
                  <TableHead>{t('crops.costFcfa')}</TableHead>
                  <TableHead>{t('crops.revenueFcfa')}</TableHead>
                  <TableHead>{t('crops.status')}</TableHead>
                  <TableHead className="text-right">{t('common.actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {crops.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-8 text-slate-500">{t('common.noData')}</TableCell></TableRow>
                ) : crops.map((crop) => (
                  <TableRow key={crop.id}>
                    <TableCell className="font-medium">{crop.crop_name}</TableCell>
                    <TableCell>{crop.variety}</TableCell>
                    <TableCell>{crop.planting_date}</TableCell>
                    <TableCell>{formatFCFA(crop.estimated_cost_fcfa)}</TableCell>
                    <TableCell>{crop.revenue_fcfa ? formatFCFA(crop.revenue_fcfa) : '-'}</TableCell>
                    <TableCell><Badge className={statusColors[crop.status] || ''}>{statusLabel(crop.status)}</Badge></TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(crop)}><Pencil className="h-4 w-4" /></Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" onClick={() => setDeleteId(crop.id)}><Trash2 className="h-4 w-4 text-red-500" /></Button>
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
            <DialogHeader><DialogTitle>{editingCrop ? t('crops.editCrop') : t('crops.addCrop')}</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>{t('plots.farm')}</Label>
                <Select value={form.plot_id} onValueChange={(v) => setForm({ ...form, plot_id: v })}>
                  <SelectTrigger><SelectValue placeholder={t('tasks.assignedPlot')} /></SelectTrigger>
                  <SelectContent>{plots.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label>{t('crops.cropName')}</Label><Input value={form.crop_name} onChange={(e) => setForm({ ...form, crop_name: e.target.value })} /></div>
                <div><Label>{t('crops.variety')}</Label><Input value={form.variety} onChange={(e) => setForm({ ...form, variety: e.target.value })} /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label>{t('crops.season')}</Label><Input value={form.season} onChange={(e) => setForm({ ...form, season: e.target.value })} /></div>
                <div><Label>{t('crops.status')}</Label>
                  <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as CropCycle['status'] })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{(['planted', 'growing', 'harvested', 'failed'] as const).map((s) => <SelectItem key={s} value={s}>{statusLabel(s)}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label>{t('crops.plantingDate')}</Label><Input type="date" value={form.planting_date} onChange={(e) => setForm({ ...form, planting_date: e.target.value })} /></div>
                <div><Label>{t('crops.harvestDate')}</Label><Input type="date" value={form.expected_harvest_date} onChange={(e) => setForm({ ...form, expected_harvest_date: e.target.value })} /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label>{t('crops.costFcfa')}</Label><Input type="number" min={0} value={form.estimated_cost_fcfa} onChange={(e) => setForm({ ...form, estimated_cost_fcfa: parseInt(e.target.value) || 0 })} /></div>
                <div><Label>{t('crops.revenueFcfa')}</Label><Input type="number" min={0} value={form.revenue_fcfa} onChange={(e) => setForm({ ...form, revenue_fcfa: parseInt(e.target.value) || 0 })} /></div>
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
