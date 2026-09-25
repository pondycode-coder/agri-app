import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

interface PageHeaderProps {
  icon: LucideIcon;
  title: string;
  subtitle?: string;
  /** Action area (button). Renders full-width on mobile for easy tapping. */
  children?: ReactNode;
}

/**
 * Responsive page header: icon + title/subtitle on the left, optional action
 * button on the right. On small screens the action stacks below the title and
 * stretches full width.
 */
export function PageHeader({ icon: Icon, title, subtitle, children }: PageHeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
      <div className="flex items-start gap-3 min-w-0">
        <Icon className="h-6 w-6 text-emerald-600 mt-0.5 shrink-0" />
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold leading-tight">{title}</h1>
          {subtitle && <p className="text-sm text-slate-500 mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {children && <div className="w-full sm:w-auto">{children}</div>}
    </div>
  );
}