import type { ReactNode } from 'react';
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
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useI18n } from '@/context/I18nProvider';
import { Pencil, Trash2 } from 'lucide-react';

/** Renders children (list rows) as cards on mobile; hidden on md+ where pages
 * show the classic table instead. */
export function MobileListContainer({ children }: { children: ReactNode }) {
  return <div className="md:hidden divide-y divide-slate-100 dark:divide-slate-800">{children}</div>;
}

export function MobileEmptyState({ message }: { message: string }) {
  return <div className="md:hidden p-8 text-center text-sm text-slate-500">{message}</div>;
}

interface MobileListItemProps {
  children: ReactNode;
  onEdit?: () => void;
  onDelete?: () => void;
}

/** Single mobile list row with optional edit/delete actions. */
export function MobileListItem({ children, onEdit, onDelete }: MobileListItemProps) {
  const { t } = useI18n();
  return (
    <div className="flex items-center justify-between gap-3 py-3.5 px-4">
      <div className="min-w-0 flex-1">{children}</div>
      <div className="flex items-center gap-1 shrink-0">
        {onEdit && (
          <Button variant="ghost" size="icon" onClick={onEdit} aria-label={t('common.edit')}>
            <Pencil className="h-4 w-4" />
          </Button>
        )}
        {onDelete && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="icon" aria-label={t('common.delete')}>
                <Trash2 className="h-4 w-4 text-red-500" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{t('common.confirm')}</AlertDialogTitle>
                <AlertDialogDescription>{t('common.areYouSure')}</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
                <AlertDialogAction onClick={onDelete}>{t('common.delete')}</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>
    </div>
  );
}