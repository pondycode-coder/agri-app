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
import { Contact } from '@/types/database';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { BookUser, Plus, Pencil, Trash2, Search } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const typeLabels: Record<string, string> = {
  customer: 'Client', supplier: 'Fournisseur', partner: 'Partenaire',
};

export default function Contacts() {
  const { t } = useI18n();
  const { toast } = useToast();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Contact | null>(null);
  const [form, setForm] = useState({ name: '', type: 'customer' as Contact['type'], phone: '', email: '', address: '', notes: '' });
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | Contact['type']>('all');

  useEffect(() => {
    const refresh = () => setContacts(dbStore.getContacts());
    const unsub = dbStore.subscribe(refresh);
    refresh();
    return unsub;
  }, []);

  const filteredContacts = contacts.filter((c) => {
    const q = search.trim().toLowerCase();
    const matchesSearch = !q || c.name.toLowerCase().includes(q) || c.email?.toLowerCase().includes(q) || c.phone.toLowerCase().includes(q);
    const matchesType = typeFilter === 'all' || c.type === typeFilter;
    return matchesSearch && matchesType;
  });

  const openCreate = () => {
    setEditing(null);
    setForm({ name: '', type: 'customer', phone: '', email: '', address: '', notes: '' });
    setDialogOpen(true);
  };

  const openEdit = (c: Contact) => {
    setEditing(c);
    setForm({ name: c.name, type: c.type, phone: c.phone, email: c.email || '', address: c.address || '', notes: c.notes || '' });
    setDialogOpen(true);
  };

  const handleSave = () => {
    dbStore.saveContact({ ...form, id: editing?.id });
    setDialogOpen(false);
    toast({ title: editing ? t('common.successUpdated') : t('common.successCreated') });
  };

  const handleDelete = () => {
    if (deleteId) { dbStore.deleteContact(deleteId); setDeleteId(null); toast({ title: t('common.successDeleted') }); }
  };

  const typeBadgeColor: Record<string, string> = {
    customer: 'bg-blue-100 text-blue-800', supplier: 'bg-amber-100 text-amber-800', partner: 'bg-emerald-100 text-emerald-800',
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2"><BookUser className="h-6 w-6 text-emerald-600" />{t('contacts.title')}</h1>
            <p className="text-sm text-slate-500 mt-1">{t('contacts.subtitle')}</p>
          </div>
          <Button onClick={openCreate} className="bg-emerald-600 hover:bg-emerald-700"><Plus className="h-4 w-4 mr-2" />{t('contacts.addContact')}</Button>
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
                <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('common.filterAll')}</SelectItem>
                  <SelectItem value="customer">{t('contacts.typeCustomer')}</SelectItem>
                  <SelectItem value="supplier">{t('contacts.typeSupplier')}</SelectItem>
                  <SelectItem value="partner">{t('contacts.typePartner')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('contacts.name')}</TableHead>
                  <TableHead>{t('contacts.type')}</TableHead>
                  <TableHead>{t('contacts.phone')}</TableHead>
                  <TableHead>{t('contacts.email')}</TableHead>
                  <TableHead>{t('contacts.address')}</TableHead>
                  <TableHead className="text-right">{t('common.actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredContacts.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-8 text-slate-500">{t('common.noData')}</TableCell></TableRow>
                ) : filteredContacts.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell><Badge className={typeBadgeColor[c.type] || ''}>{typeLabels[c.type] || c.type}</Badge></TableCell>
                    <TableCell>{c.phone}</TableCell>
                    <TableCell>{c.email || '—'}</TableCell>
                    <TableCell>{c.address || '—'}</TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(c)}><Pencil className="h-4 w-4" /></Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" onClick={() => setDeleteId(c.id)}><Trash2 className="h-4 w-4 text-red-500" /></Button>
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
            <DialogHeader><DialogTitle>{editing ? t('contacts.editContact') : t('contacts.addContact')}</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div><Label>{t('contacts.name')}</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label>{t('contacts.type')}</Label>
                  <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v as Contact['type'] })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="customer">{t('contacts.typeCustomer')}</SelectItem><SelectItem value="supplier">{t('contacts.typeSupplier')}</SelectItem><SelectItem value="partner">{t('contacts.typePartner')}</SelectItem></SelectContent>
                  </Select>
                </div>
                <div><Label>{t('contacts.phone')}</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+237 6XX XXX XXX" /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label>{t('contacts.email')}</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
                <div><Label>{t('contacts.address')}</Label><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
              </div>
              <div><Label>{t('contacts.notes')}</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
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
