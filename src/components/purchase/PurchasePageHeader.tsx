import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';

interface PurchasePageHeaderProps {
  description: string;
}

export function PurchasePageHeader({ description }: PurchasePageHeaderProps) {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
      <div>
        <h1 className="text-2xl font-bold">Закупівля ТМЦ</h1>
        <p className="text-muted-foreground">{description}</p>
      </div>
      <Button onClick={() => navigate('/purchase/requests/new')}>
        <Plus className="mr-2 h-4 w-4" />
        Нова заявка
      </Button>
    </div>
  );
}
