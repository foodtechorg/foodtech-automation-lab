import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, FileText } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function PurchaseRequests() {
  const navigate = useNavigate();

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold">Заявки на закупівлю</h1>
          <p className="text-muted-foreground">Перегляд та управління заявками на закупівлю ТМЦ</p>
        </div>
        <Button onClick={() => navigate('/purchase/requests/new')}>
          <Plus className="mr-2 h-4 w-4" />
          Нова заявка
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Список заявок
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Тут буде таблиця заявок на закупівлю. Модуль у розробці.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
