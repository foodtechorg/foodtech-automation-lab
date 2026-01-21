import { useLocation } from 'react-router-dom';
import { FileText, ShoppingCart, UserCog, BookOpen, FlaskConical } from 'lucide-react';
import { NavLink } from '@/components/NavLink';
import { useAuth } from '@/hooks/useAuth';
import foodtechLogo from '@/assets/foodtech-logo.png';
import { Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar } from '@/components/ui/sidebar';
type UserRole = 'sales_manager' | 'rd_dev' | 'rd_manager' | 'admin' | 'procurement_manager' | 'coo' | 'ceo' | 'treasurer' | 'accountant' | 'quality_manager' | 'admin_director' | 'chief_engineer' | 'production_deputy' | 'warehouse_manager' | 'chief_accountant' | 'lawyer' | 'office_manager' | 'foreign_trade_manager' | 'finance_deputy' | 'financial_analyst' | 'economist';
interface Module {
  id: string;
  label: string;
  icon: typeof FileText;
  roles: UserRole[] | 'all';
  getPath: (role: UserRole) => string;
}
const modules: Module[] = [{
  id: 'rd',
  label: 'Заявки R&D',
  icon: FileText,
  roles: ['sales_manager', 'rd_dev', 'rd_manager', 'admin', 'quality_manager', 'admin_director', 'ceo', 'coo'],
  getPath: role => role === 'sales_manager' ? '/requests/my' : '/rd/board'
}, {
  id: 'development',
  label: 'Розробка',
  icon: FlaskConical,
  roles: ['admin', 'coo'],
  getPath: () => '/development'
}, {
  id: 'purchase',
  label: 'Закупівля ТМЦ',
  icon: ShoppingCart,
  roles: 'all',
  getPath: role => {
    const queueRoles: UserRole[] = ['procurement_manager', 'coo', 'ceo', 'treasurer', 'chief_accountant', 'admin'];
    return queueRoles.includes(role) ? '/purchase/queue' : '/purchase/requests';
  }
}, {
  id: 'kb',
  label: 'Бібліотека знань',
  icon: BookOpen,
  roles: ['coo', 'admin'],
  getPath: () => '/kb'
}, {
  id: 'admin',
  label: 'Адміністрування',
  icon: UserCog,
  roles: ['admin'],
  getPath: () => '/admin'
}];
function isModuleActive(moduleId: string, pathname: string): boolean {
  switch (moduleId) {
    case 'rd':
      return pathname.startsWith('/rd') || pathname.startsWith('/requests') || pathname === '/analytics';
    case 'development':
      return pathname.startsWith('/development');
    case 'purchase':
      return pathname.startsWith('/purchase');
    case 'kb':
      return pathname.startsWith('/kb');
    case 'admin':
      return pathname === '/admin';
    default:
      return false;
  }
}
export function AppSidebar() {
  const { profile } = useAuth();
  const location = useLocation();
  const { state } = useSidebar();
  const isCollapsed = state === 'collapsed';
  
  if (!profile) return null;
  
  const userRole = profile.role as UserRole;
  const visibleModules = modules.filter(module => {
    if (module.roles === 'all') return true;
    return module.roles.includes(userRole);
  });
  return <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex items-center gap-3 px-2 py-2">
          <img src={foodtechLogo} alt="FoodTech Logo" className="max-h-8 w-auto flex-shrink-0 object-contain" />
          {!isCollapsed && <span className="font-semibold text-sidebar-foreground">FoodTech Automation</span>}
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Модулі</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {visibleModules.map(module => {
              const isActive = isModuleActive(module.id, location.pathname);
              const path = module.getPath(userRole);
              return <SidebarMenuItem key={module.id}>
                    <SidebarMenuButton asChild isActive={isActive} tooltip={module.label}>
                      <NavLink to={path} className="flex items-center gap-3" activeClassName="">
                        <module.icon className="h-4 w-4 flex-shrink-0" />
                        <span>{module.label}</span>
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>;
            })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>;
}