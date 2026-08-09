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
import { InventoryItem } from '@/types/database';
import { formatFCFA } from '@/types/database';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Package, Plus, Pencil, Trash2, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const catLabels: Record<string, string> = {
  input: 'Intrants', pesticide: 'Phytosanitaire', tool: 'Outillage', equipment: 'Équipement', fuel: 'Carburant', packaging: 'Emballage',
};

export default function Inventory() {
  const { t } = useI18n();
  const { toast } = useToast();
  const [, setTick] = useState(0);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [farms, setFarms] = useState<ReturnType<typeof dbStore.getFarms>>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<InventoryItem | null>(null);
  const [form, setForm] = useState({ farm_id: '', name: '', category: 'input' as InventoryItem['category'], quantity: 0, unit: 'sacs', price_per_unit: 0 });
  const [deleteId, setDeleteId] = useState<string | null>(null);

  useEffect(() => {
    const unsub = dbStore.subscribe(() => setTick((p) => p + 1));
    setItems(dbStore.getInventory());
    setFarms(dbStore.getFarms());
    return unsub;
  }, []);

  useEffect(() => { setItems(dbStore.getInventory()); setFarms(dbStore.getFarms()); }, [dialogOpen, deleteId]);

  const openCreate = () => {
    setEditing(null);
    setForm({ farm_id: farms[0]?.id || '', name: '', category: 'input', quantity: 0, unit: 'sacs', price_per_unit: 0 });
    setDialogOpen(true);
  };

  const openEdit = (item: InventoryItem) => {
    setEditing(item);
    setForm({ farm_id: item.farm_id, name: item.name, category: item.category, quantity: item.quantity, unit: item.unit, price_per_unit: item.price_per_unit });
    setDialogOpen(true);
  };

  const handleSave = () => {
    if (!form.farm_id) return;
    dbStore.saveInventoryItem({ ...form, id: editing?.id });
    setDialogOpen(false);
    toast({ title: editing ? t('common.successUpdated') : t('common.successCreated') });
  };

  const handleDelete = () => {
    if (deleteId) { dbStore.deleteInventoryItem(deleteId); setDeleteId(null); toast({ title: t('common.successDeleted') }); }
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2"><Package className="h-6 w-6 text-emerald-600" />{t('inventory.title')}</h1>
            <p className="text-sm text-slate-500 mt-1">{t('inventory.subtitle')}</p>
          </div>
          <Button onClick={openCreate} className="bg-emerald-600 hover:bg-emerald-700"><Plus className="h-4 w-4 mr-2" />{t('inventory.addItem')}</Button>
        </div>

        {items.filter((i) => i.quantity <= 10).length > 0 && (
          <Card className="border-amber-300 bg-amber-50">
            <CardContent className="p-4 flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
              <span className="text-sm font-medium text-amber-800">{t('inventory.lowStock')}: {items.filter((i) => i.quantity <= 10).map((i) => i.name).join(', ')}</span>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('inventory.itemName')}</TableHead>
                  <TableHead>{t('inventory.category')}</TableHead>
                  <TableHead>{t('inventory.quantity')}</TableHead>
                  <TableHead>{t('inventory.pricePerUnit')}</TableHead>
                  <TableHead>{t('inventory.totalValue')}</TableHead>
                  <TableHead className="text-right">{t('common.actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-8 text-slate-500">{t('common.noData')}</TableCell></TableRow>
                ) : items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.name}</TableCell>
                    <TableCell><Badge variant="secondary">{catLabels[item.category] || item.category}</Badge></TableCell>
                    <TableCell>{item.quantity} {item.unit}</TableCell>
                    <TableCell>{formatFCFA(item.price_per_unit)}</TableCell>
                    <TableCell>{formatFCFA(item.quantity * item.price_per_unit)}</TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(item)}><Pencil className="h-4 w-4" /></Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" onClick={() => setDeleteId(item.id)}><Trash2 className="h-4 w-4 text-red-500" /></Button>
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
            <DialogHeader><DialogTitle>{editing ? t('inventory.editItem') : t('inventory.addItem')}</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div><Label>{t('inventory.itemName')}</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label>{t('inventory.category')}</Label>
                  <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v as InventoryItem['category'] })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{Object.entries(catLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>{t('plots.farm')}</Label>
                  <Select value={form.farm_id} onValueChange={(v) => setForm({ ...form, farm_id: v })}>
                    <SelectTrigger><SelectValue placeholder={t('plots.farm')} /></SelectTrigger>
                    <SelectContent>{farms.map((f) => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div><Label>{t('inventory.quantity')}</Label><Input type="number" min={0} value={form.quantity} onChange={(e) => setForm({ ...form, quantity: parseInt(e.target.value) || 0 })} /></div>
                <div><Label>{t('inventory.unit')}</Label><Input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} /></div>
                <div><Label>{t('inventory.pricePerUnit')}</Label><Input type="number" min={0} value={form.price_per_unit} onChange={(e) => setForm({ ...form, price_per_unit: parseInt(e.target.value) || 0 })} /></div>
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
