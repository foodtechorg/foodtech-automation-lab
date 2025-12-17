import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Receipt, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { getPurchaseInvoices } from '@/services/invoiceApi';
import type { PurchaseInvoice, PurchaseInvoiceStatus, PaymentTerms } from '@/types/purchase';
import { format } from 'date-fns';
import { uk } from 'date-fns/locale';
import { PurchaseNavTabs } from '@/components/purchase/PurchaseNavTabs';

const statusLabels: Record<PurchaseInvoiceStatus, string> = {
  DRAFT: 'Чернетка',
  PENDING_COO: 'На погодженні',
  PENDING_CEO: 'На погодженні',
  TO_PAY: 'До оплати',
  PAID: 'Оплачено',
  DELIVERED: 'Доставлено',
  REJECTED: 'Відхилено',
};

const statusVariants: Record<PurchaseInvoiceStatus, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  DRAFT: 'secondary',
  PENDING_COO: 'outline',
  PENDING_CEO: 'outline',
  TO_PAY: 'default',
  PAID: 'default',
  DELIVERED: 'default',
  REJECTED: 'destructive',
};

const paymentTermsLabels: Record<PaymentTerms, string> = {
  PREPAYMENT: 'Передоплата',
  POSTPAYMENT: 'Постоплата',
};

export default function PurchaseInvoices() {
  const navigate = useNavigate();
  const [invoices, setInvoices] = useState<PurchaseInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadInvoices() {
      try {
        setLoading(true);
        const data = await getPurchaseInvoices();
        setInvoices(data);
      } catch (err) {
        console.error(err);
        setError('Не вдалося завантажити рахунки');
      } finally {
        setLoading(false);
      }
    }
    loadInvoices();
  }, []);

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '—';
    return format(new Date(dateStr), 'dd.MM.yyyy', { locale: uk });
  };

  const formatAmount = (amount: number, currency: string) => {
    return `${amount.toFixed(2)} ${currency}`;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold">Закупівля ТМЦ</h1>
          <p className="text-muted-foreground">Перегляд та управління рахунками постачальників</p>
        </div>
      </div>

      <PurchaseNavTabs />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5" />
            Список рахунків
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <div className="text-center py-8 text-destructive">{error}</div>
          ) : invoices.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Рахунки відсутні. Створіть рахунок з погодженої заявки.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Номер</TableHead>
                  <TableHead>Постачальник</TableHead>
                  <TableHead>Умови</TableHead>
                  <TableHead className="text-right">Сума</TableHead>
                  <TableHead>Статус</TableHead>
                  <TableHead>Створено</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.map((invoice) => (
                  <TableRow
                    key={invoice.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => navigate(`/purchase/invoices/${invoice.id}`)}
                  >
                    <TableCell className="font-medium">{invoice.number}</TableCell>
                    <TableCell>{invoice.supplier_name}</TableCell>
                    <TableCell>{paymentTermsLabels[invoice.payment_terms]}</TableCell>
                    <TableCell className="text-right font-medium">
                      {formatAmount(invoice.amount, invoice.currency)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusVariants[invoice.status]}>
                        {statusLabels[invoice.status]}
                      </Badge>
                    </TableCell>
                    <TableCell>{formatDate(invoice.created_at)}</TableCell>
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
