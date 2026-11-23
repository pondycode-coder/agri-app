import { useRef, useState, type ChangeEvent } from 'react';
import { DatabaseBackup, Download, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { useI18n } from '@/context/I18nProvider';
import { useAuth } from '@/context/AuthProvider';
import { useToast } from '@/hooks/use-toast';
import { dbStore } from '@/services/store';
import { BackupData, downloadBackup, isBackupData } from '@/lib/backup';

/**
 * Backup & Restore page — the app's data repository (farms, plots, crops,
 * harvests, inventory, workers, tasks, finances, investments, profiles) can
 * be exported as a JSON file and restored from a file chosen by the user.
 */
export default function BackupRestore() {
  const { t } = useI18n();
  const { user } = useAuth();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [restoreFile, setRestoreFile] = useState<BackupData | null>(null);
  const [restoreOpen, setRestoreOpen] = useState(false);

  const handleExport = () => {
    setBusy(true);
    try {
      downloadBackup(dbStore.exportBackup(), user?.name || 'data');
      toast({ title: t('backup.exportStarted') });
    } catch {
      toast({ title: t('backup.exportFailed'), variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  const readFile = (file: File) =>
    new Promise<BackupData>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const parsed: unknown = JSON.parse(String(reader.result));
          if (!isBackupData(parsed)) {
            reject(new Error('invalid'));
            return;
          }
          resolve(parsed);
        } catch {
          reject(new Error('invalid'));
        }
      };
      reader.onerror = () => reject(new Error('read'));
      reader.readAsText(file);
    });

  const handleFileSelected = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    void readFile(file)
      .then((data) => {
        setRestoreFile(data);
        setRestoreOpen(true);
      })
      .catch(() => toast({ title: t('backup.invalidFile'), variant: 'destructive' }));
  };

  const handleRestore = () => {
    if (!restoreFile) return;
    setBusy(true);
    try {
      dbStore.restoreFromBackup(restoreFile);
      toast({ title: t('backup.restoreStarted') });
      setRestoreOpen(false);
      setRestoreFile(null);
    } catch {
      toast({ title: t('backup.restoreFailed'), variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <DatabaseBackup className="h-6 w-6 text-emerald-600" />
          {t('backup.title')}
        </h1>
        <p className="text-sm text-slate-500 mt-1">{t('backup.subtitle')}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Export */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Download className="h-5 w-5 text-emerald-600" />
              {t('backup.exportButton')}
            </CardTitle>
            <CardDescription>{t('backup.exportDescription')}</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-500 mb-4">{t('backup.exportNote')}</p>
            <Button onClick={handleExport} disabled={busy} className="w-full justify-start">
              <Download className="h-4 w-4 mr-2" />
              {busy ? t('backup.exporting') : t('backup.exportButton')}
            </Button>
          </CardContent>
        </Card>

        {/* Restore */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5 text-emerald-600" />
              {t('backup.importButton')}
            </CardTitle>
            <CardDescription>{t('backup.importDescription')}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              variant="outline"
              className="w-full justify-start"
              disabled={busy}
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="h-4 w-4 mr-2" />
              {t('backup.chooseFile')}
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={handleFileSelected}
            />
          </CardContent>
        </Card>
      </div>

      <AlertDialog open={restoreOpen} onOpenChange={setRestoreOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('backup.restoreConfirmTitle')}</AlertDialogTitle>
            <AlertDialogDescription>{t('backup.restoreConfirmDesc')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('backup.cancel')}</AlertDialogCancel>
            <AlertDialogAction disabled={busy} onClick={handleRestore}>
              {busy ? t('backup.restoring') : t('backup.restoreConfirmButton')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
