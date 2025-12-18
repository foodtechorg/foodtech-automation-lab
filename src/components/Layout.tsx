import { ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { SidebarProvider, SidebarTrigger, SidebarInset } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/AppSidebar';

interface LayoutProps {
  children: ReactNode;
}

function getModuleTitle(pathname: string): string | null {
  if (pathname.startsWith('/rd') || pathname.startsWith('/requests') || pathname === '/analytics') {
    return 'Заявки R&D';
  }
  if (pathname.startsWith('/purchase')) {
    return 'Закупівля ТМЦ';
  }
  if (pathname === '/admin') {
    return 'Адміністрування';
  }
  return null;
}

export function Layout({ children }: LayoutProps) {
  const location = useLocation();
  const moduleTitle = getModuleTitle(location.pathname);

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className="flex flex-col min-h-screen w-full">
        <header className="flex h-14 items-center gap-4 border-b bg-background px-4">
          <SidebarTrigger />
          {moduleTitle && (
            <h1 className="text-lg font-semibold">{moduleTitle}</h1>
          )}
        </header>
        <main className="flex-1 bg-muted/30">
          <div className="container mx-auto px-4 py-6">{children}</div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
