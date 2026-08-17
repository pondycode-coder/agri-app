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
import { FinancialRecord } from '@/types/database';
import { formatFCFA } from '@/types/database';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Receipt, Plus, Pencil, Trash2, TrendingUp, TrendingDown, Search } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const INCOME_CATEGORIES = ['Vente Récolte', 'Location Terrain', 'Subvention', 'Autre Revenu'];
const EXPENSE_CATEGORIES = ['Achat Intrants', 'Salaires Ouvriers', 'Carburant & Énergie', 'Équipement', 'Autre Dépense'];

export default function Financials() {
  const { t } = useI18n();
  const { toast } = useToast();
  const [records, setRecords] = useState<FinancialRecord[]>([]);
  const [farms, setFarms] = useState<ReturnType<typeof dbStore.getFarms>>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<FinancialRecord | null>(null);
  const [form, setForm] = useState({
    farm_id: '', type: 'income' as FinancialRecord['type'], amount: 0, date: new Date().toISOString().split('T')[0],
    description: '', category: '', payment_method: 'cash' as FinancialRecord['payment_method'],
  });
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | FinancialRecord['type']>('all');
  const [categoryFilter, setCategoryFilter] = useState('all');

  useEffect(() => {
    const refresh = () => {
      setRecords(dbStore.getFinancials());
      setFarms(dbStore.getFarms());
    };
    const unsub = dbStore.subscribe(refresh);
    refresh();
    return unsub;
  }, []);

  const allCategories = [...INCOME_CATEGORIES, ...EXPENSE_CATEGORIES];

  const filteredRecords = records
    .filter((r) => {
      const q = search.trim().toLowerCase();
      const matchesSearch = !q || r.description.toLowerCase().includes(q) || r.category.toLowerCase().includes(q);
      const matchesType = typeFilter === 'all' || r.type === typeFilter;
      const matchesCategory = categoryFilter === 'all' || r.category === categoryFilter;
      return matchesSearch && matchesType && matchesCategory;
    })
    .sort((a, b) => b.date.localeCompare(a.date));

  const totalIncome = records.filter((r) => r.type === 'income').reduce((s, r) => s + r.amount, 0);
  const totalExpense = records.filter((r) => r.type === 'expense').reduce((s, r) => s + r.amount, 0);
  const balance = totalIncome - totalExpense;

  const openCreate = () => {
    setEditing(null);
    setForm({ farm_id: farms[0]?.id || '', type: 'income', amount: 0, date: new Date().toISOString().split('T')[0], description: '', category: '', payment_method: 'cash' });
    setDialogOpen(true);
  };

  const openEdit = (rec: FinancialRecord) => {
    setEditing(rec);
    setForm({ farm_id: rec.farm_id, type: rec.type, amount: rec.amount, date: rec.date, description: rec.description, category: rec.category, payment_method: rec.payment_method });
    setDialogOpen(true);
  };

  const handleSave = () => {
    if (!form.farm_id) return;
    dbStore.saveFinancialRecord({ ...form, id: editing?.id });
    setDialogOpen(false);
    toast({ title: editing ? t('common.successUpdated') : t('common.successCreated') });
  };

  const handleDelete = () => {
    if (deleteId) { dbStore.deleteFinancialRecord(deleteId); setDeleteId(null); toast({ title: t('common.successDeleted') }); }
  };

  const categories = form.type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;

  const methodLabels: Record<string, string> = {
    cash: t('financials.methodCash'),
    orange_money: 'Orange Money',
    mtn_momo: 'MTN MoMo',
    bank_transfer: t('financials.methodBank'),
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2"><Receipt className="h-6 w-6 text-emerald-600" />{t('financials.title')}</h1>
            <p className="text-sm text-slate-500 mt-1">{t('financials.subtitle')}</p>
          </div>
          <Button onClick={openCreate} className="bg-emerald-600 hover:bg-emerald-700"><Plus className="h-4 w-4 mr-2" />{t('financials.addRecord')}</Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="bg-emerald-50 border-emerald-200">
            <CardContent className="p-4 flex items-center justify-between">
              <div><p className="text-xs font-semibold text-emerald-800 uppercase">{t('financials.summaryIncome')}</p><p className="text-xl font-bold text-emerald-700 mt-1">{formatFCFA(totalIncome)}</p></div>
              <TrendingUp className="h-6 w-6 text-emerald-600" />
            </CardContent>
          </Card>
          <Card className="bg-rose-50 border-rose-200">
            <CardContent className="p-4 flex items-center justify-between">
              <div><p className="text-xs font-semibold text-rose-800 uppercase">{t('financials.summaryExpense')}</p><p className="text-xl font-bold text-rose-700 mt-1">{formatFCFA(totalExpense)}</p></div>
              <TrendingDown className="h-6 w-6 text-rose-600" />
            </CardContent>
          </Card>
          <Card className={balance >= 0 ? 'bg-blue-50 border-blue-200' : 'bg-amber-50 border-amber-200'}>
            <CardContent className="p-4 flex items-center justify-between">
              <div><p className="text-xs font-semibold uppercase">{t('financials.summaryBalance')}</p><p className={`text-xl font-bold mt-1 ${balance >= 0 ? 'text-blue-700' : 'text-amber-700'}`}>{formatFCFA(balance)}</p></div>
              <Receipt className={`h-6 w-6 ${balance >= 0 ? 'text-blue-600' : 'text-amber-600'}`} />
            </CardContent>
          </Card>
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
              <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as typeof typeFilter)}>
                <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('common.filterAll')}</SelectItem>
                  <SelectItem value="income">{t('financials.income')}</SelectItem>
                  <SelectItem value="expense">{t('financials.expense')}</SelectItem>
                </SelectContent>
              </Select>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-52"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('common.filterAll')}</SelectItem>
                  {allCategories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('financials.date')}</TableHead>
                  <TableHead>{t('financials.type')}</TableHead>
                  <TableHead>{t('financials.description')}</TableHead>
                  <TableHead>{t('financials.category')}</TableHead>
                  <TableHead>{t('financials.amount')}</TableHead>
                  <TableHead>{t('financials.paymentMethod')}</TableHead>
                  <TableHead className="text-right">{t('common.actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRecords.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-8 text-slate-500">{t('common.noData')}</TableCell></TableRow>
                ) : filteredRecords.map((rec) => (
                  <TableRow key={rec.id}>
                    <TableCell>{rec.date}</TableCell>
                    <TableCell><Badge className={rec.type === 'income' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}>{rec.type === 'income' ? t('financials.income') : t('financials.expense')}</Badge></TableCell>
                    <TableCell className="max-w-[200px] truncate">{rec.description}</TableCell>
                    <TableCell><Badge variant="secondary">{rec.category}</Badge></TableCell>
                    <TableCell className={rec.type === 'income' ? 'text-emerald-700 font-semibold' : 'text-rose-700 font-semibold'}>
                      {rec.type === 'income' ? '+' : '−'} {formatFCFA(rec.amount)}
                    </TableCell>
                    <TableCell>{methodLabels[rec.payment_method] || rec.payment_method}</TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(rec)}><Pencil className="h-4 w-4" /></Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" onClick={() => setDeleteId(rec.id)}><Trash2 className="h-4 w-4 text-red-500" /></Button>
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
            <DialogHeader><DialogTitle>{editing ? t('financials.editRecord') : t('financials.addRecord')}</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div><Label>{t('financials.type')}</Label>
                  <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v as FinancialRecord['type'], category: '' })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="income">{t('financials.income')}</SelectItem><SelectItem value="expense">{t('financials.expense')}</SelectItem></SelectContent>
                  </Select>
                </div>
                <div><Label>{t('financials.amount')}</Label><Input type="number" min={0} value={form.amount} onChange={(e) => setForm({ ...form, amount: parseInt(e.target.value) || 0 })} /></div>
              </div>
              <div><Label>{t('financials.description')}</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label>{t('financials.category')}</Label>
                  <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                    <SelectTrigger><SelectValue placeholder={t('financials.category')} /></SelectTrigger>
                    <SelectContent>{categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>{t('financials.paymentMethod')}</Label>
                  <Select value={form.payment_method} onValueChange={(v) => setForm({ ...form, payment_method: v as FinancialRecord['payment_method'] })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{Object.entries(methodLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label>{t('financials.date')}</Label><Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></div>
                <div><Label>{t('plots.farm')}</Label>
                  <Select value={form.farm_id} onValueChange={(v) => setForm({ ...form, farm_id: v })}>
                    <SelectTrigger><SelectValue placeholder={t('plots.farm')} /></SelectTrigger>
                    <SelectContent>{farms.map((f) => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}</SelectContent>
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
