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
import { FileText, Loader2, Plus, Edit } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import type { PurchaseRequest, PurchaseType } from '@/types/purchase';
import { format } from 'date-fns';
import { uk } from 'date-fns/locale';
import { PurchaseNavTabs } from '@/components/purchase/PurchaseNavTabs';
import { createPurchaseInvoice, createPurchaseInvoiceItems, logPurchaseEvent } from '@/services/invoiceApi';
import { getPurchaseRequestItems } from '@/services/purchaseApi';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

const typeLabels: Record<PurchaseType, string> = {
  TMC: 'ТМЦ',
  SERVICE: 'Послуга',
};

interface RequestWithCreator extends PurchaseRequest {
  creator_name: string;
  creator_email: string;
  has_draft_invoice: boolean;
  has_remaining_items: boolean;
}

export default function ApprovedRequestsQueue() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [requests, setRequests] = useState<RequestWithCreator[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creatingInvoiceFor, setCreatingInvoiceFor] = useState<string | null>(null);

  useEffect(() => {
    async function loadApprovedRequests() {
      try {
        setLoading(true);
        
        // 1. Get all IN_PROGRESS requests
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

        const requestIds = requestsData.map(r => r.id);

        // 2. Get all request items
        const { data: allItems } = await supabase
          .from('purchase_request_items')
          .select('id, request_id, quantity')
          .in('request_id', requestIds);

        // 3. Get ALL invoices for these requests
        const { data: allInvoices } = await supabase
          .from('purchase_invoices')
          .select('id, request_id, status')
          .in('request_id', requestIds);

        // 4. Get invoice items from NON-DRAFT invoices to calculate closed quantities
        const nonDraftInvoiceIds = (allInvoices || [])
          .filter(inv => inv.status !== 'DRAFT')
          .map(inv => inv.id);

        const { data: invoiceItems } = nonDraftInvoiceIds.length > 0 
          ? await supabase
              .from('purchase_invoice_items')
              .select('request_item_id, quantity')
              .in('invoice_id', nonDraftInvoiceIds)
          : { data: [] };

        // 5. Calculate closed quantities per request_item_id
        const invoicedByItem = new Map<string, number>();
        for (const item of invoiceItems || []) {
          if (item.request_item_id) {
            invoicedByItem.set(
              item.request_item_id, 
              (invoicedByItem.get(item.request_item_id) || 0) + Number(item.quantity)
            );
          }
        }

        // 6. Identify requests with DRAFT invoices
        const draftInvoiceRequestIds = new Set(
          (allInvoices || [])
            .filter(inv => inv.status === 'DRAFT')
            .map(inv => inv.request_id)
        );

        // 7. Get creator profiles
        const creatorIds = [...new Set(requestsData.map(r => r.created_by))];
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, name, email')
          .in('id', creatorIds);

        const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);

        // 8. Filter and enrich requests
        const enrichedRequests: RequestWithCreator[] = [];
        
        for (const request of requestsData) {
          const hasDraftInvoice = draftInvoiceRequestIds.has(request.id);
          
          // Check if there are remaining items
          const requestItems = (allItems || []).filter(i => i.request_id === request.id);
          let hasRemainingItems = false;
          
          for (const item of requestItems) {
            const invoiced = invoicedByItem.get(item.id) || 0;
            if (Number(item.quantity) > invoiced) {
              hasRemainingItems = true;
              break;
            }
          }

          // Only show if has draft invoice OR has remaining items
          if (hasDraftInvoice || hasRemainingItems) {
            const profile = profileMap.get(request.created_by);
            enrichedRequests.push({
              ...request,
              creator_name: profile?.name || profile?.email || 'Невідомий',
              creator_email: profile?.email || '',
              has_draft_invoice: hasDraftInvoice,
              has_remaining_items: hasRemainingItems,
            });
          }
        }

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

  const handleCreateInvoice = async (request: RequestWithCreator) => {
    if (!user?.id) return;
    
    setCreatingInvoiceFor(request.id);
    try {
      // Get request items
      const items = await getPurchaseRequestItems(request.id);
      
      // Get already invoiced quantities (from non-draft invoices)
      const { data: nonDraftInvoices } = await supabase
        .from('purchase_invoices')
        .select('id')
        .eq('request_id', request.id)
        .neq('status', 'DRAFT');

      const nonDraftIds = (nonDraftInvoices || []).map(i => i.id);
      
      const invoicedQuantities = new Map<string, number>();
      if (nonDraftIds.length > 0) {
        const { data: invoiceItems } = await supabase
          .from('purchase_invoice_items')
          .select('request_item_id, quantity')
          .in('invoice_id', nonDraftIds);
        
        for (const item of invoiceItems || []) {
          if (item.request_item_id) {
            invoicedQuantities.set(
              item.request_item_id,
              (invoicedQuantities.get(item.request_item_id) || 0) + Number(item.quantity)
            );
          }
        }
      }
      
      // Create draft invoice
      const invoice = await createPurchaseInvoice({
        request_id: request.id,
        currency: request.currency,
        created_by: user.id,
      });

      // Create invoice items from remaining quantities
      const remainingItems = items
        .filter(item => {
          const invoiced = invoicedQuantities.get(item.id) || 0;
          return item.quantity > invoiced;
        })
        .map(item => {
          const invoiced = invoicedQuantities.get(item.id) || 0;
          const remaining = item.quantity - invoiced;
          return {
            invoice_id: invoice.id,
            request_item_id: item.id,
            name: item.name,
            unit: item.unit,
            quantity: remaining,
            price: 0,
          };
        });

      if (remainingItems.length > 0) {
        await createPurchaseInvoiceItems(remainingItems);
      }

      // Log the creation
      await logPurchaseEvent('INVOICE', invoice.id, 'CREATED');

      toast.success('Рахунок створено');
      navigate(`/purchase/invoices/${invoice.id}`);
    } catch (err) {
      console.error(err);
      toast.error('Помилка при створенні рахунку');
    } finally {
      setCreatingInvoiceFor(null);
    }
  };

  const getStatusBadge = (request: RequestWithCreator) => {
    if (request.has_draft_invoice && request.has_remaining_items) {
      return <Badge variant="secondary"><Edit className="h-3 w-3 mr-1" />В роботі</Badge>;
    }
    if (request.has_draft_invoice) {
      return <Badge variant="secondary"><Edit className="h-3 w-3 mr-1" />Чернетка</Badge>;
    }
    return <Badge variant="outline">Очікує</Badge>;
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
              Немає заявок для опрацювання
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
                  <TableHead>Статус</TableHead>
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
                    <TableCell>{getStatusBadge(request)}</TableCell>
                    <TableCell className="text-right">
                      {request.has_remaining_items && (
                        <Button
                          size="sm"
                          onClick={() => handleCreateInvoice(request)}
                          disabled={creatingInvoiceFor === request.id}
                        >
                          {creatingInvoiceFor === request.id ? (
                            <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                          ) : (
                            <Plus className="h-4 w-4 mr-1" />
                          )}
                          Створити рахунок
                        </Button>
                      )}
                      {!request.has_remaining_items && request.has_draft_invoice && (
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
