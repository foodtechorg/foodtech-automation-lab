import { useLocation, useNavigate } from 'react-router-dom';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FileText, Receipt, ListChecks } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

export function PurchaseNavTabs() {
  const location = useLocation();
  const navigate = useNavigate();
  const { profile } = useAuth();

  const isProcurementManager = profile?.role === 'procurement_manager' || profile?.role === 'admin';

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

  return (
    <Tabs value={getCurrentTab()} onValueChange={handleTabChange} className="w-full">
      <TabsList className="grid w-full max-w-md grid-cols-3">
        <TabsTrigger value="requests" className="flex items-center gap-2">
          <FileText className="h-4 w-4" />
          <span className="hidden sm:inline">Заявки</span>
        </TabsTrigger>
        <TabsTrigger value="invoices" className="flex items-center gap-2">
          <Receipt className="h-4 w-4" />
          <span className="hidden sm:inline">Рахунки</span>
        </TabsTrigger>
        {isProcurementManager && (
          <TabsTrigger value="queue" className="flex items-center gap-2">
            <ListChecks className="h-4 w-4" />
            <span className="hidden sm:inline">Черга</span>
          </TabsTrigger>
        )}
      </TabsList>
    </Tabs>
  );
}
