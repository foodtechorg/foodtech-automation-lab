import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function NewPurchaseRequest() {
  const navigate = useNavigate();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/purchase/requests')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Нова заявка на закупівлю</h1>
          <p className="text-muted-foreground">Створення нової заявки на закупівлю ТМЦ</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Форма заявки</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Тут буде форма створення заявки на закупівлю. Модуль у розробці.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
