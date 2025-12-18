import { useLocation } from 'react-router-dom';
import { FileText, ShoppingCart, UserCog, LogOut } from 'lucide-react';
import { NavLink } from '@/components/NavLink';
import { useAuth } from '@/hooks/useAuth';
import { t } from '@/lib/i18n';
import foodtechLogo from '@/assets/foodtech-logo.png';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';

type UserRole = 'sales_manager' | 'rd_dev' | 'rd_manager' | 'admin' | 'procurement_manager' | 'coo' | 'ceo' | 'treasurer' | 'accountant';

interface Module {
  id: string;
  label: string;
  icon: typeof FileText;
  roles: UserRole[] | 'all';
  getPath: (role: UserRole) => string;
}

const modules: Module[] = [
  {
    id: 'rd',
    label: 'Заявки R&D',
    icon: FileText,
    roles: ['sales_manager', 'rd_dev', 'rd_manager', 'admin'],
    getPath: (role) => role === 'sales_manager' ? '/requests/my' : '/rd/board',
  },
  {
    id: 'purchase',
    label: 'Закупівля ТМЦ',
    icon: ShoppingCart,
    roles: 'all',
    getPath: (role) => {
      const queueRoles: UserRole[] = ['procurement_manager', 'coo', 'ceo', 'treasurer', 'admin'];
      return queueRoles.includes(role) ? '/purchase/queue' : '/purchase/requests';
    },
  },
  {
    id: 'admin',
    label: 'Адміністрування',
    icon: UserCog,
    roles: ['admin'],
    getPath: () => '/admin',
  },
];

function isModuleActive(moduleId: string, pathname: string): boolean {
  switch (moduleId) {
    case 'rd':
      return pathname.startsWith('/rd') || pathname.startsWith('/requests') || pathname === '/analytics';
    case 'purchase':
      return pathname.startsWith('/purchase');
    case 'admin':
      return pathname === '/admin';
    default:
      return false;
  }
}

export function AppSidebar() {
  const { profile, signOut } = useAuth();
  const location = useLocation();
  const { state } = useSidebar();
  const isCollapsed = state === 'collapsed';

  if (!profile) return null;

  const userRole = profile.role as UserRole;

  const visibleModules = modules.filter((module) => {
    if (module.roles === 'all') return true;
    return module.roles.includes(userRole);
  });

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex items-center gap-3 px-2 py-2">
          <img src={foodtechLogo} alt="FoodTech Logo" className="h-8 w-8 flex-shrink-0" />
          {!isCollapsed && (
            <span className="font-semibold text-sidebar-foreground">FoodTech</span>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Модулі</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {visibleModules.map((module) => {
                const isActive = isModuleActive(module.id, location.pathname);
                const path = module.getPath(userRole);

                return (
                  <SidebarMenuItem key={module.id}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      tooltip={module.label}
                    >
                      <NavLink
                        to={path}
                        className="flex items-center gap-3"
                        activeClassName=""
                      >
                        <module.icon className="h-4 w-4 flex-shrink-0" />
                        <span>{module.label}</span>
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border">
        <div className="flex items-center gap-3 px-2 py-2">
          {!isCollapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-sidebar-foreground truncate">
                {profile.name}
              </p>
              <p className="text-xs text-sidebar-foreground/70 truncate">
                {t.role(profile.role)}
              </p>
            </div>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={signOut}
            title="Вийти"
            className="flex-shrink-0"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
