import { useEffect, useState } from 'react';
import { useI18n } from '@/context/I18nProvider';
import { dbStore } from '@/services/store';
import { Button } from '@/components/ui/button';
import { WifiOff, AlertTriangle, RefreshCw, CheckCircle2 } from 'lucide-react';

/**
 * Global online-synchronization indicator: offline warning, sync-failure
 * banner with a retry button, an in-flight spinner and a subtle "synced"
 * confirmation. Hidden entirely when no Supabase backend is attached
 * (demo/local mode).
 */
export function SyncStatusBar() {
  const { t } = useI18n();
  const [, force] = useState(0);

  useEffect(() => dbStore.subscribe(() => force((x) => x + 1)), []);

  if (!dbStore.isRemoteActive()) return null;

  const online = dbStore.isOnline;
  const syncing = dbStore.isSyncing;
  const error = dbStore.lastSyncError;
  const synced = dbStore.lastSyncedAt;

  return (
    <div className="mb-4 space-y-2">
      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
          <AlertTriangle className="h-4 w-4 flex-shrink-0" />
          <span className="flex-1">{error}</span>
          <Button
            size="sm"
            variant="outline"
            className="h-7 px-2 text-xs border-amber-400/60"
            onClick={() => dbStore.syncNow()}
          >
            <RefreshCw className="h-3 w-3 mr-1" />
            {t('sync.retry')}
          </Button>
        </div>
      )}
      {!online && !error && (
        <div className="flex items-center gap-2 rounded-lg border border-blue-300 bg-blue-50 p-3 text-sm text-blue-800">
          <WifiOff className="h-4 w-4 flex-shrink-0" />
          <span>{t('sync.offline')}</span>
        </div>
      )}
      {online && !error && syncing && (
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <RefreshCw className="h-4 w-4 animate-spin" />
          {t('sync.syncing')}
        </div>
      )}
      {online && !error && !syncing && synced && (
        <div className="flex items-center gap-1.5 text-xs text-slate-400">
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
          {t('sync.synced')}
        </div>
      )}
    </div>
  );
}