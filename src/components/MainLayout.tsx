import { useI18n } from '@/context/I18nProvider';
import { UserCircle, LogOut, Menu, Sun, Moon } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export const MainLayout = ({ children }: { children: React.ReactNode }) => {
  const { t, locale, setLocale } = useI18n();

  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar */}
      <aside className="w-64 bg-sidebar text-sidebar-foreground border-r border-border">
        <div className="flex h-16 items-center justify-between px-4">
          <h1 className="text-xl font-bold text-primary">{t('layout.header.title')}</h1>
          <DropdownMenu>
            <DropdownMenuTrigger className="p-1 rounded-md hover:bg-accent/20">
              <Sun className="h-4 w-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-16">
              <DropdownMenuItem onClick={() => setLocale('en')}>EN</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setLocale('fr')}>FR</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <nav className="mt-6 space-y-2">
          <a href="/dashboard" className="flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors hover:bg-accent/20 hover:text-primary">
            <Menu className="mr-3 h-4 w-4" />
            <span>{t('layout.sidebar.dashboard')}</span>
          </a>
          <a href="/dashboard/farms" className="flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors hover:bg-accent/20 hover:text-primary">
            <Menu className="mr-3 h-4 w-4" /> {/* TODO: replace with farm icon */}
            <span>{t('layout.sidebar.farms')}</span>
          </a>
          <a href="/dashboard/production" className="flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors hover:bg-accent/20 hover:text-primary">
            <Menu className="mr-3 h-4 w-4" /> {/* TODO: replace with production icon */}
            <span>{t('layout.sidebar.production')}</span>
          </a>
          <a href="/dashboard/inventory" className="flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors hover:bg-accent/20 hover:text-primary">
            <Menu className="mr-3 h-4 w-4" /> {/* TODO: replace with inventory icon */}
            <span>{t('layout.sidebar.inventory')}</span>
          </a>
          <a href="/dashboard/workers" className="flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors hover:bg-accent/20 hover:text-primary">
            <Menu className="mr-3 h-4 w-4" /> {/* TODO: replace with workers icon */}
            <span>{t('layout.sidebar.workers')}</span>
          </a>
          <a href="/dashboard/financials" className="flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors hover:bg-accent/20 hover:text-primary">
            <Menu className="mr-3 h-4 w-4" /> {/* TODO: replace with financials icon */}
            <span>{t('layout.sidebar.financials')}</span>
          </a>
          <a href="/dashboard/contacts" className="flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors hover:bg-accent/20 hover:text-primary">
            <Menu className="mr-3 h-4 w-4" /> {/* TODO: replace with contacts icon */}
            <span>{t('layout.sidebar.contacts')}</span>
          </a>
          <a href="/dashboard/investments" className="flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors hover:bg-accent/20 hover:text-primary">
            <Menu className="mr-3 h-4 w-4" /> {/* TODO: replace with investments icon */}
            <span>{t('layout.sidebar.investments')}</span>
          </a>
          <a href="/dashboard/profile" className="flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors hover:bg-accent/20 hover:text-primary">
            <UserCircle className="mr-3 h-4 w-4" />
            <span>{t('layout.sidebar.profile')}</span>
          </a>
        </nav>
        <div className="mt-auto p-4">
          <Button variant="outline" onClick={() => {/* TODO: implement sign out */}}>
            <LogOut className="mr-2 h-4 w-4" />
            {t('layout.header.signOut')}
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-6">
        {children}
      </main>
    </div>
  );
};