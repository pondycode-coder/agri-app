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
import { Receipt, Plus, Pencil, Trash2, TrendingUp, TrendingDown, Landmark, Filter, Search } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Pagination, PAGE_SIZE, clampPage } from '@/components/Pagination';

const INCOME_CATEGORIES = ['Vente Récolte', 'Location Terrain', 'Subvention', 'Autre Revenu'];
const EXPENSE_CATEGORIES = ['Achat Intrants', 'Salaires Ouvriers', 'Avance Salaire', 'Carburant & Énergie', 'Équipement', 'Autre Dépense'];
const INVESTMENT_CATEGORIES = ['Apport Investisseur', 'Prêt Financement'];

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
  const [periodFilter, setPeriodFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    const refresh = () => {
      setRecords(dbStore.getFinancials());
      setFarms(dbStore.getFarms());
    };
    const unsub = dbStore.subscribe(refresh);
    refresh();
    return unsub;
  }, []);

  const uniqueCategories = (arr: string[]) => [...new Set(arr)].filter(Boolean);

  const dataCategories = uniqueCategories(records.map((r) => r.category));
  const allCategories = uniqueCategories([...INCOME_CATEGORIES, ...EXPENSE_CATEGORIES, ...INVESTMENT_CATEGORIES, ...dataCategories]);

  const categoryOptions = (type: FinancialRecord['type']) =>
    uniqueCategories([
      ...(type === 'income' ? INCOME_CATEGORIES : type === 'investment' ? INVESTMENT_CATEGORIES : EXPENSE_CATEGORIES),
      ...records.filter((r) => r.type === type).map((r) => r.category),
    ]);

  const inPeriod = (d: string) => {
    if (periodFilter === 'all') return true;
    const today = new Date();
    const date = new Date(d + 'T00:00:00');
    if (periodFilter === 'today') {
      const t = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      return date.getTime() === t.getTime();
    }
    if (periodFilter === 'week') {
      const start = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 7);
      return date >= start && date <= new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
    }
    if (periodFilter === 'month') {
      const start = new Date(today.getFullYear(), today.getMonth(), 1);
      return date >= start && date <= new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
    }
    if (periodFilter === 'quarter') {
      const q = Math.floor(today.getMonth() / 3);
      const start = new Date(today.getFullYear(), q * 3, 1);
      return date >= start && date <= new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
    }
    if (periodFilter === 'year') {
      const start = new Date(today.getFullYear(), 0, 1);
      return date >= start && date <= new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
    }
    return true;
  };

  const filteredRecords = records
    .filter((r) => {
      const q = search.trim().toLowerCase();
      const matchesSearch = !q || r.description.toLowerCase().includes(q) || r.category.toLowerCase().includes(q);
      const matchesType = typeFilter === 'all' || r.type === typeFilter;
      const matchesCategory = categoryFilter === 'all' || r.category === categoryFilter;
      const matchesPeriod = inPeriod(r.date);
      const matchesDateRange = (!dateFrom || r.date >= dateFrom) && (!dateTo || r.date <= dateTo);
      return matchesSearch && matchesType && matchesCategory && matchesPeriod && matchesDateRange;
    })
    .sort((a, b) => b.date.localeCompare(a.date));

  useEffect(() => {
    setPage(1);
  }, [search, typeFilter, categoryFilter, periodFilter, dateFrom, dateTo]);

  const cp = clampPage(page, filteredRecords.length);
  const paginatedRecords = filteredRecords.slice((cp - 1) * PAGE_SIZE, cp * PAGE_SIZE);

  const totalIncome = records.filter((r) => r.type === 'income').reduce((s, r) => s + r.amount, 0);
  const totalInvestment = records.filter((r) => r.type === 'investment').reduce((s, r) => s + r.amount, 0);
  const totalExpense = filteredRecords.filter((r) => r.type === 'expense').reduce((s, r) => s + r.amount, 0);
  const balance = totalIncome + totalInvestment - totalExpense;

  const filtersActive = !!search.trim() || typeFilter !== 'all' || categoryFilter !== 'all' || periodFilter !== 'all' || !!dateFrom || !!dateTo;

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

  const categories = categoryOptions(form.type);

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

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {filtersActive && (
            <div className="md:col-span-4 -mb-2">
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 border border-slate-300 px-2.5 py-0.5 text-[11px] font-medium text-slate-600">
                <Filter className="h-3 w-3" />
                {t('financials.filteredLabel')}
              </span>
            </div>
          )}
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
          <Card className="bg-indigo-50 border-indigo-200">
            <CardContent className="p-4 flex items-center justify-between">
              <div><p className="text-xs font-semibold text-indigo-800 uppercase">{t('financials.summaryInvestment')}</p><p className="text-xl font-bold text-indigo-700 mt-1">{formatFCFA(totalInvestment)}</p></div>
              <Landmark className="h-6 w-6 text-indigo-600" />
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
                  <SelectItem value="investment">{t('financials.investment')}</SelectItem>
                </SelectContent>
              </Select>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-52"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('common.filterAll')}</SelectItem>
                  {allCategories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={periodFilter} onValueChange={(v) => setPeriodFilter(v)}>
                <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('common.filterAll')}</SelectItem>
                  <SelectItem value="today">{t('financials.periodToday')}</SelectItem>
                  <SelectItem value="week">{t('financials.periodWeek')}</SelectItem>
                  <SelectItem value="month">{t('financials.periodMonth')}</SelectItem>
                  <SelectItem value="quarter">{t('financials.periodQuarter')}</SelectItem>
                  <SelectItem value="year">{t('financials.periodYear')}</SelectItem>
                </SelectContent>
              </Select>
              <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-40" title={t('financials.dateFrom')} />
              <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-40" title={t('financials.dateTo')} />
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
                {paginatedRecords.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-8 text-slate-500">{t('common.noData')}</TableCell></TableRow>
                ) : paginatedRecords.map((rec) => (
                  <TableRow key={rec.id}>
                    <TableCell>{rec.date}</TableCell>
                    <TableCell><Badge className={rec.type === 'income' ? 'bg-emerald-100 text-emerald-800' : rec.type === 'investment' ? 'bg-indigo-100 text-indigo-800' : 'bg-rose-100 text-rose-800'}>{rec.type === 'income' ? t('financials.income') : rec.type === 'investment' ? t('financials.investment') : t('financials.expense')}</Badge></TableCell>
                    <TableCell className="max-w-[200px] truncate">{rec.description}</TableCell>
                    <TableCell><Badge variant="secondary">{rec.category}</Badge></TableCell>
                    <TableCell className={rec.type === 'expense' ? 'text-rose-700 font-semibold' : rec.type === 'investment' ? 'text-indigo-700 font-semibold' : 'text-emerald-700 font-semibold'}>
                      {rec.type === 'expense' ? '−' : '+'} {formatFCFA(rec.amount)}
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
            <Pagination total={filteredRecords.length} page={cp} onPageChange={setPage} />
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
                    <SelectContent><SelectItem value="income">{t('financials.income')}</SelectItem><SelectItem value="expense">{t('financials.expense')}</SelectItem><SelectItem value="investment">{t('financials.investment')}</SelectItem></SelectContent>
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
