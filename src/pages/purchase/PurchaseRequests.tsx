import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { FileText, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { getPurchaseRequests } from '@/services/purchaseApi';
import type { PurchaseRequest, PurchaseRequestStatus, PurchaseType } from '@/types/purchase';
import { format } from 'date-fns';
import { uk } from 'date-fns/locale';
import { PurchaseNavTabs } from '@/components/purchase/PurchaseNavTabs';
import { PurchasePageHeader } from '@/components/purchase/PurchasePageHeader';

const statusLabels: Record<PurchaseRequestStatus, string> = {
  DRAFT: 'Чернетка',
  PENDING_APPROVAL: 'На погодженні',
  IN_PROGRESS: 'В роботі',
  INVOICE_PENDING: 'Рахунок на погодженні',
  DELIVERING: 'Доставляється',
  COMPLETED: 'Виконана',
  REJECTED: 'Відхилено',
};

const statusVariants: Record<PurchaseRequestStatus, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  DRAFT: 'secondary',
  PENDING_APPROVAL: 'outline',
  IN_PROGRESS: 'default',
  INVOICE_PENDING: 'outline',
  DELIVERING: 'default',
  COMPLETED: 'default',
  REJECTED: 'destructive',
};

const typeLabels: Record<PurchaseType, string> = {
  TMC: 'ТМЦ',
  SERVICE: 'Послуга',
};

export default function PurchaseRequests() {
  const navigate = useNavigate();
  const [requests, setRequests] = useState<PurchaseRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadRequests() {
      try {
        setLoading(true);
        const data = await getPurchaseRequests();
        setRequests(data);
      } catch (err) {
        console.error(err);
        setError('Не вдалося завантажити заявки на закупівлю');
      } finally {
        setLoading(false);
      }
    }
    loadRequests();
  }, []);

  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return '—';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return '—';
    return format(date, 'dd.MM.yyyy', { locale: uk });
  };

  return (
    <div className="space-y-6">
      <PurchasePageHeader description="Перегляд та управління заявками на закупівлю" />

      <PurchaseNavTabs />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Список заявок
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <div className="text-center py-8 text-destructive">{error}</div>
          ) : requests.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Заявки на закупівлю відсутні. Створіть першу заявку.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Номер</TableHead>
                  <TableHead>Тип</TableHead>
                  <TableHead>Статус</TableHead>
                  <TableHead>Бажана дата</TableHead>
                  <TableHead>Створено</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {requests.map((request) => (
                  <TableRow
                    key={request.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => navigate(`/purchase/requests/${request.id}`)}
                  >
                    <TableCell className="font-medium">{request.number}</TableCell>
                    <TableCell>{typeLabels[request.purchase_type]}</TableCell>
                    <TableCell>
                      <Badge variant={statusVariants[request.status]}>
                        {statusLabels[request.status]}
                      </Badge>
                    </TableCell>
                    <TableCell>{formatDate(request.desired_date)}</TableCell>
                    <TableCell>{formatDate(request.created_at)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
