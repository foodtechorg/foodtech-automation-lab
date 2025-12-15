import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Receipt } from 'lucide-react';

export default function PurchaseInvoices() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Рахунки на закупівлю</h1>
        <p className="text-muted-foreground">Перегляд та управління рахунками постачальників</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5" />
            Список рахунків
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Тут буде таблиця рахунків на закупівлю. Модуль у розробці.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
