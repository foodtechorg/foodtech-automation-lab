import { useLocation, useNavigate } from 'react-router-dom';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/hooks/useAuth';

const RD_BOARD_ROLES = ['rd_dev', 'rd_manager', 'admin', 'ceo', 'coo', 'quality_manager', 'admin_director'];
const MY_REQUESTS_ROLES = ['sales_manager', 'admin'];
const ANALYTICS_ROLES = ['rd_dev', 'rd_manager', 'admin', 'ceo', 'coo', 'quality_manager', 'admin_director', 'sales_manager'];

type TabConfig = {
  value: string;
  label: string;
  path: string;
  roles: string[];
};

const tabs: TabConfig[] = [
  { value: 'board', label: 'Дошка', path: '/rd/board', roles: RD_BOARD_ROLES },
  { value: 'my', label: 'Мої заявки', path: '/requests/my', roles: MY_REQUESTS_ROLES },
  { value: 'analytics', label: 'Аналітика', path: '/rd/analytics', roles: ANALYTICS_ROLES },
];

export function RDNavTabs() {
  const { profile } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const userRole = profile?.role;

  const visibleTabs = tabs.filter(tab => 
    userRole && tab.roles.includes(userRole)
  );

  const currentTab = tabs.find(tab => location.pathname === tab.path)?.value || 'board';

  if (visibleTabs.length <= 1) {
    return null;
  }

  return (
    <Tabs value={currentTab} onValueChange={(value) => {
      const tab = tabs.find(t => t.value === value);
      if (tab) navigate(tab.path);
    }}>
      <TabsList>
        {visibleTabs.map(tab => (
          <TabsTrigger key={tab.value} value={tab.value}>
            {tab.label}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
