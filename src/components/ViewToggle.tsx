import { Button } from '@/components/ui/button';
import { useI18n } from '@/context/I18nProvider';
import { Grid, Table } from 'lucide-react';

export type ListViewMode = 'table' | 'grid';

interface ViewToggleProps {
  mode: ListViewMode;
  onChange: (mode: ListViewMode) => void;
}

/** Toggle between the classic table layout and the alternative card-grid layout. */
export function ViewToggle({ mode, onChange }: ViewToggleProps) {
  const { t } = useI18n();
  return (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        className={mode === 'table' ? 'border-emerald-600 text-emerald-700' : ''}
        onClick={() => onChange('table')}
      >
        <Table className="h-4 w-4 mr-1.5" />
        {t('common.tableView')}
      </Button>
      <Button
        variant="outline"
        size="sm"
        className={mode === 'grid' ? 'border-emerald-600 text-emerald-700' : ''}
        onClick={() => onChange('grid')}
      >
        <Grid className="h-4 w-4 mr-1.5" />
        {t('common.gridView')}
      </Button>
    </div>
  );
}
