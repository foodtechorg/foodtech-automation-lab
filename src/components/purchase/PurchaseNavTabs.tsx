import { useLocation, useNavigate } from 'react-router-dom';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FileText, Receipt, ListChecks } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

export function PurchaseNavTabs() {
  const location = useLocation();
  const navigate = useNavigate();
  const { profile } = useAuth();

  const canSeeQueue = profile?.role === 'procurement_manager' 
    || profile?.role === 'coo' 
    || profile?.role === 'ceo' 
    || profile?.role === 'treasurer'
    || profile?.role === 'admin';

  // Treasurer only sees Queue and Invoices, not Requests
  const hideRequests = profile?.role === 'treasurer';

  const getCurrentTab = () => {
    if (location.pathname.startsWith('/purchase/invoices')) return 'invoices';
    if (location.pathname === '/purchase/queue') return 'queue';
    return 'requests';
  };

  const handleTabChange = (value: string) => {
    switch (value) {
      case 'requests':
        navigate('/purchase/requests');
        break;
      case 'invoices':
        navigate('/purchase/invoices');
        break;
      case 'queue':
        navigate('/purchase/queue');
        break;
    }
  };

  // Calculate grid columns based on visible tabs
  const visibleTabsCount = (canSeeQueue ? 1 : 0) + (hideRequests ? 0 : 1) + 1; // queue + requests + invoices
  const gridCols = visibleTabsCount === 3 ? 'grid-cols-3' : 'grid-cols-2';

  return (
    <Tabs value={getCurrentTab()} onValueChange={handleTabChange} className="w-full">
      <TabsList className={`grid w-full max-w-md ${gridCols}`}>
        {canSeeQueue && (
          <TabsTrigger value="queue" className="flex items-center gap-2">
            <ListChecks className="h-4 w-4" />
            <span className="hidden sm:inline">Черга</span>
          </TabsTrigger>
        )}
        {!hideRequests && (
          <TabsTrigger value="requests" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            <span className="hidden sm:inline">Заявки</span>
          </TabsTrigger>
        )}
        <TabsTrigger value="invoices" className="flex items-center gap-2">
          <Receipt className="h-4 w-4" />
          <span className="hidden sm:inline">Рахунки</span>
        </TabsTrigger>
      </TabsList>
    </Tabs>
  );
}
