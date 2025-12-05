import { ReactNode, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { NavLink } from '@/components/NavLink';
import { LogOut, LayoutDashboard, FileText, BarChart3, Plus, Menu, UserCog } from 'lucide-react';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { t } from '@/lib/i18n';
import foodtechLogo from '@/assets/foodtech-logo.png';
interface LayoutProps {
  children: ReactNode;
}
export function Layout({
  children
}: LayoutProps) {
  const {
    profile,
    signOut
  } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const getNavigation = () => {
    if (!profile) return [];
    const common = [{
      to: '/',
      label: 'Панель управління',
      icon: LayoutDashboard
    }];
    switch (profile.role) {
      case 'admin':
        return [...common, {
          to: '/admin',
          label: 'Адміністрування',
          icon: UserCog
        }, {
          to: '/rd/board',
          label: 'Дошка R&D',
          icon: FileText
        }, {
          to: '/analytics',
          label: 'Аналітика',
          icon: BarChart3
        }];
      case 'sales_manager':
        return [...common, {
          to: '/requests/my',
          label: 'Мої заявки',
          icon: FileText
        }, {
          to: '/requests/new',
          label: 'Нова заявка',
          icon: Plus
        }];
      case 'rd_dev':
        return [...common, {
          to: '/rd/board',
          label: 'Дошка R&D',
          icon: FileText
        }];
      case 'rd_manager':
        return [...common, {
          to: '/rd/board',
          label: 'Дошка R&D',
          icon: FileText
        }, {
          to: '/analytics',
          label: 'Аналітика',
          icon: BarChart3
        }];
      default:
        return common;
    }
  };
  const navigation = getNavigation();
  return <div className="flex min-h-screen flex-col">
      <header className="border-b bg-card">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild className="md:hidden">
                <Button variant="ghost" size="icon">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-64">
                <nav className="flex flex-col gap-2 mt-8">
                  {navigation.map(item => <NavLink key={item.to} to={item.to} end={item.to === '/'} onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground" activeClassName="bg-accent text-accent-foreground">
                      <item.icon className="h-4 w-4" />
                      {item.label}
                    </NavLink>)}
                </nav>
              </SheetContent>
            </Sheet>
            <img src={foodtechLogo} alt="FoodTech Logo" className="h-8 w-auto" />
            <h1 className="text-xl font-bold text-primary hidden sm:block">Заявки R&D</h1>
            <nav className="hidden space-x-1 md:flex ml-8">
              {navigation.map(item => <NavLink key={item.to} to={item.to} end={item.to === '/'} className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground" activeClassName="bg-accent text-accent-foreground">
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </NavLink>)}
            </nav>
          </div>
          <div className="flex items-center gap-2">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-medium">{profile?.name}</p>
              <p className="text-xs text-muted-foreground">
                {profile?.role && t.role(profile.role)}
              </p>
            </div>
            <Button variant="ghost" size="icon" onClick={signOut} title="Вийти">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>
      <main className="flex-1 bg-muted/30">
        <div className="container mx-auto px-4 py-6">{children}</div>
      </main>
    </div>;
}