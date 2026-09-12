import { Button } from '@/components/ui/button';
import { useI18n } from '@/context/I18nProvider';

export const PAGE_SIZE = 8;

export const clampPage = (page: number, total: number) =>
  Math.min(Math.max(1, page), Math.max(1, Math.ceil(total / PAGE_SIZE)));

interface PaginationProps {
  total: number;
  page: number;
  onPageChange: (page: number) => void;
}

export function Pagination({ total, page, onPageChange }: PaginationProps) {
  const { t } = useI18n();
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  if (totalPages <= 1) return null;
  const current = Math.min(page, totalPages);
  const from = (current - 1) * PAGE_SIZE + 1;
  const to = Math.min(current * PAGE_SIZE, total);
  return (
    <div className="flex items-center justify-between px-4 py-3 border-t">
      <span className="text-sm text-slate-500">
        {from} – {to} / {total}
      </span>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" disabled={current <= 1} onClick={() => onPageChange(current - 1)}>
          {t('common.prev')}
        </Button>
        <span className="text-sm text-slate-600">
          {t('common.page')} {current} / {totalPages}
        </span>
        <Button variant="outline" size="sm" disabled={current >= totalPages} onClick={() => onPageChange(current + 1)}>
          {t('common.next')}
        </Button>
      </div>
    </div>
  );
}