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
import { FileText, Loader2, Receipt, Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import type { PurchaseRequest, PurchaseType } from '@/types/purchase';
import { format } from 'date-fns';
import { uk } from 'date-fns/locale';
import { PurchaseNavTabs } from '@/components/purchase/PurchaseNavTabs';

const typeLabels: Record<PurchaseType, string> = {
  TMC: 'ТМЦ',
  SERVICE: 'Послуга',
};

interface RequestWithCreator extends PurchaseRequest {
  creator_name: string;
  creator_email: string;
  has_invoice: boolean;
}

export default function ApprovedRequestsQueue() {
  const navigate = useNavigate();
  const [requests, setRequests] = useState<RequestWithCreator[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadApprovedRequests() {
      try {
        setLoading(true);
        
        // Get IN_PROGRESS requests (approved by COO)
        const { data: requestsData, error: requestsError } = await supabase
          .from('purchase_requests')
          .select('*')
          .eq('status', 'IN_PROGRESS')
          .order('created_at', { ascending: false });

        if (requestsError) throw requestsError;

        if (!requestsData || requestsData.length === 0) {
          setRequests([]);
          return;
        }

        // Get creator profiles
        const creatorIds = [...new Set(requestsData.map(r => r.created_by))];
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, name, email')
          .in('id', creatorIds);

        const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);

        // Check which requests already have invoices
        const requestIds = requestsData.map(r => r.id);
        const { data: invoices } = await supabase
          .from('purchase_invoices')
          .select('request_id')
          .in('request_id', requestIds);

        const requestsWithInvoices = new Set(invoices?.map(i => i.request_id) || []);

        // Combine data
        const enrichedRequests: RequestWithCreator[] = requestsData.map(req => {
          const profile = profileMap.get(req.created_by);
          return {
            ...req,
            creator_name: profile?.name || profile?.email || 'Невідомий',
            creator_email: profile?.email || '',
            has_invoice: requestsWithInvoices.has(req.id),
          };
        });

        setRequests(enrichedRequests);
      } catch (err) {
        console.error(err);
        setError('Не вдалося завантажити заявки');
      } finally {
        setLoading(false);
      }
    }

    loadApprovedRequests();
  }, []);

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '—';
    return format(new Date(dateStr), 'dd.MM.yyyy', { locale: uk });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold">Закупівля ТМЦ</h1>
          <p className="text-muted-foreground">
            Заявки, готові до створення рахунку
          </p>
        </div>
      </div>

      <PurchaseNavTabs />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Черга на опрацювання
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
              Немає погоджених заявок для опрацювання
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Номер</TableHead>
                  <TableHead>Замовник</TableHead>
                  <TableHead>Тип</TableHead>
                  <TableHead>Бажана дата</TableHead>
                  <TableHead>Створено</TableHead>
                  <TableHead>Рахунок</TableHead>
                  <TableHead className="text-right">Дії</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {requests.map((request) => (
                  <TableRow key={request.id}>
                    <TableCell 
                      className="font-medium cursor-pointer hover:underline"
                      onClick={() => navigate(`/purchase/requests/${request.id}`)}
                    >
                      {request.number}
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{request.creator_name}</p>
                        <p className="text-sm text-muted-foreground">{request.creator_email}</p>
                      </div>
                    </TableCell>
                    <TableCell>{typeLabels[request.purchase_type]}</TableCell>
                    <TableCell>{formatDate(request.desired_date)}</TableCell>
                    <TableCell>{formatDate(request.created_at)}</TableCell>
                    <TableCell>
                      {request.has_invoice ? (
                        <Badge variant="secondary">
                          <Receipt className="h-3 w-3 mr-1" />
                          Створено
                        </Badge>
                      ) : (
                        <Badge variant="outline">Очікує</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {!request.has_invoice && (
                        <Button
                          size="sm"
                          onClick={() => navigate(`/purchase/invoices/new?requestId=${request.id}`)}
                        >
                          <Plus className="h-4 w-4 mr-1" />
                          Створити рахунок
                        </Button>
                      )}
                      {request.has_invoice && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => navigate(`/purchase/requests/${request.id}`)}
                        >
                          Переглянути
                        </Button>
                      )}
                    </TableCell>
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
