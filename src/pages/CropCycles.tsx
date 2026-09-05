import { Fragment, useEffect, useState } from 'react';
import { MainLayout } from '@/components/MainLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useI18n } from '@/context/I18nProvider';
import { dbStore } from '@/services/store';
import { CropCycle, Harvest } from '@/types/database';
import { formatFCFA } from '@/types/database';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Sprout, Plus, Pencil, Trash2, Search, Timer, TrendingUp, LandPlot, Wallet, ChevronRight, ChevronDown, StickyNote } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const statusColors: Record<string, string> = {
  planted: 'bg-blue-100 text-blue-800',
  growing: 'bg-emerald-100 text-emerald-800',
  harvested: 'bg-amber-100 text-amber-800',
  failed: 'bg-red-100 text-red-800',
};

const YIELD_UNITS = ['bunch', 'bag'] as const;
const todayIso = () => new Date().toISOString().split('T')[0];

export default function CropCycles() {
  const { t } = useI18n();
  const { toast } = useToast();
  const [crops, setCrops] = useState<CropCycle[]>([]);
  const [plots, setPlots] = useState<ReturnType<typeof dbStore.getPlots>>([]);
  const [harvests, setHarvests] = useState<Harvest[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCrop, setEditingCrop] = useState<CropCycle | null>(null);
  const [form, setForm] = useState({
    plot_id: '', crop_name: 'Cacao', variety: '', season: '', planting_date: '', expected_harvest_date: '',
    status: 'planted' as CropCycle['status'], estimated_cost_fcfa: 0,
  });
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'overdue' | CropCycle['status']>('all');
  const [harvestDialog, setHarvestDialog] = useState<{ open: boolean; cycleId: string; cycleName: string }>({ open: false, cycleId: '', cycleName: '' });
  const [harvestForm, setHarvestForm] = useState({ harvest_date: todayIso(), quantity: 0, unit: 'bunch' as string, revenue_fcfa: 0, notes: '' });

  useEffect(() => {
    const refresh = () => {
      setCrops(dbStore.getCropCycles());
      setPlots(dbStore.getPlots());
      setHarvests(dbStore.getHarvests());
    };
    const unsub = dbStore.subscribe(refresh);
    refresh();
    return unsub;
  }, []);

  const plotById = (id: string) => plots.find((p) => p.id === id);

  const isOverdue = (c: CropCycle) =>
    (c.status === 'planted' || c.status === 'growing') &&
    Boolean(c.expected_harvest_date) &&
    c.expected_harvest_date < todayIso();

  const cycleHarvests = (cycleId: string) => harvests.filter((h) => h.crop_cycle_id === cycleId);

  const totals = (c: CropCycle) => {
    const hs = cycleHarvests(c.id);
    const byUnit: Record<string, number> = { bunch: 0, bag: 0 };
    for (const h of hs) byUnit[h.unit] = (byUnit[h.unit] || 0) + h.quantity;
    if (hs.length > 0) {
      return {
        hasBatches: true,
        revenue: hs.reduce((sum, h) => sum + h.revenue_fcfa, 0),
        units: byUnit,
        latestDate: hs.map((h) => h.harvest_date).sort().at(-1) || null,
      };
    }
    return {
      hasBatches: false,
      revenue: c.revenue_fcfa || 0,
      units: c.yield_in_kg ? { [c.yield_unit || 'bunch']: c.yield_in_kg } : {},
      latestDate: c.actual_harvest_date || null,
    };
  };

  const yieldUnitLabel = (unit?: string) => (unit === 'bag' ? t('crops.unitBag') : t('crops.unitBunch'));

  const margin = (c: CropCycle) => totals(c).revenue - c.estimated_cost_fcfa;

  const filteredCrops = crops.filter((c) => {
    const q = search.trim().toLowerCase();
    const matchesSearch = !q || c.crop_name.toLowerCase().includes(q) || c.variety.toLowerCase().includes(q) || c.season.toLowerCase().includes(q);
    const matchesStatus =
      statusFilter === 'all' ? true : statusFilter === 'overdue' ? isOverdue(c) : c.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const sortedCrops = [...filteredCrops].sort((a, b) => {
    const order: Record<string, number> = { planted: 0, growing: 1, harvested: 2, failed: 3 };
    const diff = (order[a.status] ?? 4) - (order[b.status] ?? 4);
    if (diff !== 0) return diff;
    const da = a.expected_harvest_date || a.planting_date || '';
    const db = b.expected_harvest_date || b.planting_date || '';
    return da.localeCompare(db);
  });

  const activeCycles = crops.filter((c) => c.status === 'planted' || c.status === 'growing');
  const activeArea = [...new Set(activeCycles.map((c) => c.plot_id))].reduce(
    (sum, pid) => sum + (plotById(pid)?.size_in_hectares || 0),
    0,
  );
  const revenueCycles = crops.filter((c) => c.status === 'harvested' || cycleHarvests(c.id).length > 0);
  const harvestValue = revenueCycles.reduce((sum, c) => sum + totals(c).revenue, 0);
  const avgMargin = revenueCycles.length ? revenueCycles.reduce((sum, c) => sum + margin(c), 0) / revenueCycles.length : 0;

  const openCreate = () => {
    setEditingCrop(null);
    setForm({ plot_id: plots[0]?.id || '', crop_name: 'Cacao', variety: '', season: '', planting_date: todayIso(), expected_harvest_date: '', status: 'planted', estimated_cost_fcfa: 0 });
    setDialogOpen(true);
  };

  const openEdit = (crop: CropCycle) => {
    setEditingCrop(crop);
    setForm({ plot_id: crop.plot_id, crop_name: crop.crop_name, variety: crop.variety, season: crop.season, planting_date: crop.planting_date, expected_harvest_date: crop.expected_harvest_date, status: crop.status, estimated_cost_fcfa: crop.estimated_cost_fcfa });
    setDialogOpen(true);
  };

  const openHarvestDialog = (crop: CropCycle) => {
    const last = cycleHarvests(crop.id).at(-1);
    setHarvestForm({ harvest_date: todayIso(), quantity: 0, unit: last?.unit || crop.yield_unit || 'bunch', revenue_fcfa: 0, notes: '' });
    setHarvestDialog({ open: true, cycleId: crop.id, cycleName: crop.crop_name });
  };

  const handleSaveCycle = () => {
    if (!form.plot_id) return;
    dbStore.saveCropCycle({ ...form, id: editingCrop?.id });
    setDialogOpen(false);
    toast({ title: editingCrop ? t('common.successUpdated') : t('common.successCreated') });
  };

  const handleSaveHarvest = () => {
    if (!harvestDialog.cycleId) return;
    dbStore.saveHarvest({
      crop_cycle_id: harvestDialog.cycleId,
      harvest_date: harvestForm.harvest_date || todayIso(),
      quantity: harvestForm.quantity || 0,
      unit: (harvestForm.unit === 'bag' ? 'bag' : 'bunch'),
      revenue_fcfa: harvestForm.revenue_fcfa || 0,
      notes: harvestForm.notes?.trim() || null,
    });
    const cyc = crops.find((c) => c.id === harvestDialog.cycleId);
    if (cyc && (cyc.status === 'planted' || cyc.status === 'growing')) {
      dbStore.saveCropCycle({ id: cyc.id, plot_id: cyc.plot_id, status: 'harvested' });
    }
    setHarvestDialog({ open: false, cycleId: '', cycleName: '' });
    toast({ title: t('crops.harvestToast') });
  };

  const handleDeleteCycle = () => {
    if (deleteId) {
      cycleHarvests(deleteId).forEach((h) => dbStore.deleteHarvest(h.id));
      dbStore.deleteCropCycle(deleteId);
      setDeleteId(null);
      toast({ title: t('common.successDeleted') });
    }
  };

  const handleDeleteHarvest = (id: string) => {
    dbStore.deleteHarvest(id);
    toast({ title: t('common.successDeleted') });
  };

  const statusLabel = (s: string) => {
    const map: Record<string, string> = { planted: t('crops.statusPlanted'), growing: t('crops.statusGrowing'), harvested: t('crops.statusHarvested'), failed: t('crops.statusFailed') };
    return map[s] || s;
  };

  const kpiCards = [
    { label: t('crops.kpiActiveCycles'), value: String(activeCycles.length), icon: Sprout, accent: 'text-emerald-600' },
    { label: t('crops.kpiActiveArea'), value: `${activeArea}`, icon: LandPlot, accent: 'text-blue-600' },
    { label: t('crops.kpiHarvestValue'), value: formatFCFA(harvestValue), icon: Wallet, accent: 'text-amber-600' },
    { label: t('crops.kpiAvgMargin'), value: formatFCFA(Math.round(avgMargin)), icon: TrendingUp, accent: 'text-emerald-600' },
  ];

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

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {kpiCards.map(({ label, value, icon: Icon, accent }) => (
            <Card key={label}>
              <CardContent className="pt-5 space-y-1">
                <Icon className={`h-4 w-4 ${accent}`} />
                <div className="text-lg font-bold">{value}</div>
                <div className="text-xs text-slate-500">{label}</div>
              </CardContent>
            </Card>
          ))}
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
                  <SelectItem value="overdue">{t('crops.overdueFilter')}</SelectItem>
                  <SelectItem value="planted">{t('crops.statusPlanted')}</SelectItem>
                  <SelectItem value="growing">{t('crops.statusGrowing')}</SelectItem>
                  <SelectItem value="harvested">{t('crops.statusHarvested')}</SelectItem>
                  <SelectItem value="failed">{t('crops.statusFailed')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10"></TableHead>
                  <TableHead>{t('crops.cropName')}</TableHead>
                  <TableHead>{t('crops.plot')}</TableHead>
                  <TableHead>{t('crops.plantingDate')}</TableHead>
                  <TableHead>{t('crops.expectedHarvest')}</TableHead>
                  <TableHead>{t('crops.yieldKg')}</TableHead>
                  <TableHead>{t('crops.costFcfa')}</TableHead>
                  <TableHead>{t('crops.revenueFcfa')}</TableHead>
                  <TableHead className="text-right">{t('common.actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedCrops.length === 0 ? (
                  <TableRow><TableCell colSpan={9} className="text-center py-8 text-slate-500">{t('common.noData')}</TableCell></TableRow>
                ) : sortedCrops.map((crop) => {
                  const ts = totals(crop);
                  const unitsList = Object.entries(ts.units).filter(([, q]) => q > 0);
                  const expanded = expandedId === crop.id;
                  return (
                    <Fragment key={crop.id}>
                      <TableRow>
                        <TableCell>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setExpandedId(expanded ? null : crop.id)}>
                            {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                          </Button>
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">{crop.crop_name}</div>
                          <div className="text-xs text-slate-500">
                            {[crop.variety, crop.season].filter(Boolean).join(' · ') || '—'}
                          </div>
                          <Badge className={`mt-1 ${statusColors[crop.status] || ''}`}>{statusLabel(crop.status)}</Badge>
                        </TableCell>
                        <TableCell>{plotById(crop.plot_id)?.name || '—'}</TableCell>
                        <TableCell>{crop.planting_date}</TableCell>
                        <TableCell>
                          {crop.status === 'harvested' ? (
                            <div>
                              <div>{ts.latestDate || '—'}</div>
                              <div className="text-xs text-emerald-600">{t('crops.harvestedOn')}</div>
                            </div>
                          ) : (
                            <div className="space-y-1">
                              <div>{crop.expected_harvest_date || '—'}</div>
                              {isOverdue(crop) && (
                                <Badge className="bg-red-100 text-red-700">
                                  <Timer className="h-3 w-3 mr-1" />{t('crops.overdue')}
                                </Badge>
                              )}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          {unitsList.length > 0 ? (
                            <div>
                              {unitsList.map(([unit, qty]) => (
                                <div key={unit}>{qty} {yieldUnitLabel(unit)}</div>
                              ))}
                            </div>
                          ) : '—'}
                        </TableCell>
                        <TableCell>{formatFCFA(crop.estimated_cost_fcfa)}</TableCell>
                        <TableCell className="font-medium">{ts.revenue > 0 ? formatFCFA(ts.revenue) : '—'}</TableCell>
                        <TableCell className="text-right space-x-1 whitespace-nowrap">
                          <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => openHarvestDialog(crop)}>
                            <Sprout className="h-3.5 w-3.5 mr-1 text-emerald-600" />{t('crops.harvestBtn')}
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => openEdit(crop)}><Pencil className="h-4 w-4" /></Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" onClick={() => setDeleteId(crop.id)}><Trash2 className="h-4 w-4 text-red-500" /></Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader><AlertDialogTitle>{t('common.confirm')}</AlertDialogTitle><AlertDialogDescription>{t('common.areYouSure')}</AlertDialogDescription></AlertDialogHeader>
                              <AlertDialogFooter><AlertDialogCancel onClick={() => setDeleteId(null)}>{t('common.cancel')}</AlertDialogCancel><AlertDialogAction onClick={handleDeleteCycle}>{t('common.delete')}</AlertDialogAction></AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </TableCell>
                      </TableRow>
                      {expanded && (
                        <TableRow key={`${crop.id}-harvests`} className="bg-slate-50 dark:bg-slate-900/40">
                          <TableCell colSpan={9}>
                            <div className="p-3 space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="text-sm font-semibold">{t('crops.harvestsTitle')} ({cycleHarvests(crop.id).length})</span>
                                <Button variant="outline" size="sm" onClick={() => openHarvestDialog(crop)}>
                                  <Plus className="h-3.5 w-3.5 mr-1" />{t('crops.addHarvest')}
                                </Button>
                              </div>
                              {cycleHarvests(crop.id).length === 0 ? (
                                <p className="text-sm text-slate-500">{t('crops.noHarvests')}</p>
                              ) : (
                                <div className="divide-y divide-slate-200 dark:divide-slate-700">
                                  {cycleHarvests(crop.id).map((h) => (
                                    <div key={h.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                                      <div>
                                        <div className="font-medium">{h.harvest_date}</div>
                                        {h.notes && (
                                          <div className="text-xs text-slate-500 flex items-center gap-1">
                                            <StickyNote className="h-3 w-3" />{h.notes}
                                          </div>
                                        )}
                                      </div>
                                      <div className="flex items-center gap-3 whitespace-nowrap">
                                        <span>{h.quantity} {yieldUnitLabel(h.unit)}</span>
                                        <span className="font-medium">{formatFCFA(h.revenue_fcfa)}</span>
                                        <AlertDialog>
                                          <AlertDialogTrigger asChild>
                                            <Button variant="ghost" size="icon" className="h-7 w-7"><Trash2 className="h-3.5 w-3.5 text-red-500" /></Button>
                                          </AlertDialogTrigger>
                                          <AlertDialogContent>
                                            <AlertDialogHeader><AlertDialogTitle>{t('common.confirm')}</AlertDialogTitle><AlertDialogDescription>{t('crops.harvestDelete')}</AlertDialogDescription></AlertDialogHeader>
                                            <AlertDialogFooter><AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel><AlertDialogAction onClick={() => handleDeleteHarvest(h.id)}>{t('common.delete')}</AlertDialogAction></AlertDialogFooter>
                                          </AlertDialogContent>
                                        </AlertDialog>
                                      </div>
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
          </CardContent>
        </Card>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader><DialogTitle>{editingCrop ? t('crops.editCrop') : t('crops.addCrop')}</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>{t('plots.farm')}</Label>
                <Select value={form.plot_id} onValueChange={(v) => setForm({ ...form, plot_id: v })}>
                  <SelectTrigger><SelectValue placeholder={t('crops.plotPlaceholder')} /></SelectTrigger>
                  <SelectContent>{plots.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label>{t('crops.cropName')}</Label><Input placeholder={t('crops.cropNamePlaceholder')} value={form.crop_name} onChange={(e) => setForm({ ...form, crop_name: e.target.value })} /></div>
                <div><Label>{t('crops.variety')}</Label><Input placeholder={t('crops.varietyPlaceholder')} value={form.variety} onChange={(e) => setForm({ ...form, variety: e.target.value })} /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label>{t('crops.season')}</Label><Input placeholder={t('crops.seasonPlaceholder')} value={form.season} onChange={(e) => setForm({ ...form, season: e.target.value })} /></div>
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
              <p className="text-xs text-slate-500">{t('crops.expectedHarvestHint')}</p>
              <div className="grid grid-cols-2 gap-4">
                <div><Label>{t('crops.costFcfa')}</Label><Input type="number" min={0} placeholder={t('crops.costPlaceholder')} value={form.estimated_cost_fcfa} onChange={(e) => setForm({ ...form, estimated_cost_fcfa: parseInt(e.target.value) || 0 })} /></div>
              </div>
              <p className="text-xs text-slate-500">{t('crops.revenueViaHarvests')}</p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>{t('common.cancel')}</Button>
              <Button onClick={handleSaveCycle} className="bg-emerald-600 hover:bg-emerald-700">{t('common.save')}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={harvestDialog.open} onOpenChange={(o) => setHarvestDialog({ ...harvestDialog, open: o })}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Sprout className="h-5 w-5 text-emerald-600" />{t('crops.addHarvest')} — {harvestDialog.cycleName}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div><Label>{t('crops.harvestDateField')}</Label><Input type="date" value={harvestForm.harvest_date} onChange={(e) => setHarvestForm({ ...harvestForm, harvest_date: e.target.value })} /></div>
                <div><Label>{t('crops.yieldKg')}</Label><Input type="number" min={0} placeholder={t('crops.yieldPlaceholder')} value={harvestForm.quantity} onChange={(e) => setHarvestForm({ ...harvestForm, quantity: parseInt(e.target.value) || 0 })} /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>{t('crops.yieldUnit')}</Label>
                  <Select value={harvestForm.unit} onValueChange={(v) => setHarvestForm({ ...harvestForm, unit: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {YIELD_UNITS.map((u) => (
                        <SelectItem key={u} value={u}>{yieldUnitLabel(u)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>{t('crops.revenueFcfa')}</Label><Input type="number" min={0} placeholder={t('crops.revenuePlaceholder')} value={harvestForm.revenue_fcfa} onChange={(e) => setHarvestForm({ ...harvestForm, revenue_fcfa: parseInt(e.target.value) || 0 })} /></div>
              </div>
              <div>
                <Label>{t('crops.harvestNotes')}</Label>
                <Input value={harvestForm.notes} onChange={(e) => setHarvestForm({ ...harvestForm, notes: e.target.value })} />
              </div>
              <p className="text-xs text-slate-500">{t('crops.yieldHint')}</p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setHarvestDialog({ ...harvestDialog, open: false })}>{t('common.cancel')}</Button>
              <Button onClick={handleSaveHarvest} className="bg-emerald-600 hover:bg-emerald-700">{t('common.save')}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}