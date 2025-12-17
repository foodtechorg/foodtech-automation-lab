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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Textarea } from '@/components/ui/textarea';
import { FileText, Loader2, Plus, Edit, Check, X, Receipt } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import type { PurchaseRequest, PurchaseType, PurchaseInvoice } from '@/types/purchase';
import { format } from 'date-fns';
import { uk } from 'date-fns/locale';
import { PurchaseNavTabs } from '@/components/purchase/PurchaseNavTabs';
import { createPurchaseInvoice, createPurchaseInvoiceItems, logPurchaseEvent, updatePurchaseInvoice } from '@/services/invoiceApi';
import { getPurchaseRequestItems, updatePurchaseRequestStatus } from '@/services/purchaseApi';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

const typeLabels: Record<PurchaseType, string> = {
  TMC: 'ТМЦ',
  SERVICE: 'Послуга',
};

const paymentTermsLabels: Record<string, string> = {
  PREPAYMENT: 'Передоплата',
  POSTPAYMENT: 'Післяоплата',
};

interface RequestWithCreator extends PurchaseRequest {
  creator_name: string;
  creator_email: string;
  has_draft_invoice?: boolean;
  has_remaining_items?: boolean;
}

interface InvoiceWithCreator extends PurchaseInvoice {
  creator_name: string;
  creator_email: string;
}

export default function ApprovedRequestsQueue() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  
  // Procurement manager queue state
  const [requests, setRequests] = useState<RequestWithCreator[]>([]);
  
  // COO/CEO queue state
  const [pendingApprovalRequests, setPendingApprovalRequests] = useState<RequestWithCreator[]>([]);
  const [pendingCOOInvoices, setPendingCOOInvoices] = useState<InvoiceWithCreator[]>([]);
  const [pendingCEOInvoices, setPendingCEOInvoices] = useState<InvoiceWithCreator[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creatingInvoiceFor, setCreatingInvoiceFor] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [rejectComment, setRejectComment] = useState('');

  const isCOO = profile?.role === 'coo' || profile?.role === 'admin';
  const isCEO = profile?.role === 'ceo' || profile?.role === 'admin';
  const isProcurementManager = profile?.role === 'procurement_manager' || profile?.role === 'admin';

  useEffect(() => {
    loadQueueData();
  }, [profile?.role]);

  async function loadQueueData() {
    try {
      setLoading(true);
      setError(null);

      // Load data based on role
      if (isCOO) {
        await loadCOOQueue();
      }
      if (isCEO) {
        await loadCEOQueue();
      }
      if (isProcurementManager) {
        await loadProcurementQueue();
      }
    } catch (err) {
      console.error(err);
      setError('Не вдалося завантажити дані');
    } finally {
      setLoading(false);
    }
  }

  async function loadCOOQueue() {
    // Load PENDING_APPROVAL requests
    const { data: requestsData, error: reqError } = await supabase
      .from('purchase_requests')
      .select('*')
      .eq('status', 'PENDING_APPROVAL')
      .order('created_at', { ascending: false });

    if (reqError) throw reqError;

    // Load PENDING_COO invoices
    const { data: invoicesData, error: invError } = await supabase
      .from('purchase_invoices')
      .select('*')
      .eq('status', 'PENDING_COO')
      .order('created_at', { ascending: false });

    if (invError) throw invError;

    // Get creator profiles for requests
    const reqCreatorIds = [...new Set((requestsData || []).map(r => r.created_by))];
    const invCreatorIds = [...new Set((invoicesData || []).map(i => i.created_by))];
    const allCreatorIds = [...new Set([...reqCreatorIds, ...invCreatorIds])];

    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, name, email')
      .in('id', allCreatorIds);

    const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);

    // Enrich requests
    const enrichedRequests: RequestWithCreator[] = (requestsData || []).map(req => {
      const profile = profileMap.get(req.created_by);
      return {
        ...req,
        creator_name: profile?.name || profile?.email || 'Невідомий',
        creator_email: profile?.email || '',
      };
    });

    // Enrich invoices
    const enrichedInvoices: InvoiceWithCreator[] = (invoicesData || []).map(inv => {
      const profile = profileMap.get(inv.created_by);
      return {
        ...inv,
        creator_name: profile?.name || profile?.email || 'Невідомий',
        creator_email: profile?.email || '',
      };
    });

    setPendingApprovalRequests(enrichedRequests);
    setPendingCOOInvoices(enrichedInvoices);
  }

  async function loadCEOQueue() {
    // Load PENDING_CEO invoices
    const { data: invoicesData, error: invError } = await supabase
      .from('purchase_invoices')
      .select('*')
      .eq('status', 'PENDING_CEO')
      .order('created_at', { ascending: false });

    if (invError) throw invError;

    // Get creator profiles
    const creatorIds = [...new Set((invoicesData || []).map(i => i.created_by))];

    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, name, email')
      .in('id', creatorIds);

    const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);

    // Enrich invoices
    const enrichedInvoices: InvoiceWithCreator[] = (invoicesData || []).map(inv => {
      const profile = profileMap.get(inv.created_by);
      return {
        ...inv,
        creator_name: profile?.name || profile?.email || 'Невідомий',
        creator_email: profile?.email || '',
      };
    });

    setPendingCEOInvoices(enrichedInvoices);
  }

  async function loadProcurementQueue() {
    // Get all IN_PROGRESS requests
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

    // Get all request items
    const { data: allItems } = await supabase
      .from('purchase_request_items')
      .select('id, request_id, quantity')
      .in('request_id', requestIds);

    // Get ALL invoices for these requests
    const { data: allInvoices } = await supabase
      .from('purchase_invoices')
      .select('id, request_id, status')
      .in('request_id', requestIds);

    // Get invoice items from NON-DRAFT invoices
    const nonDraftInvoiceIds = (allInvoices || [])
      .filter(inv => inv.status !== 'DRAFT')
      .map(inv => inv.id);

    const { data: invoiceItems } = nonDraftInvoiceIds.length > 0 
      ? await supabase
          .from('purchase_invoice_items')
          .select('request_item_id, quantity')
          .in('invoice_id', nonDraftInvoiceIds)
      : { data: [] };

    // Calculate closed quantities
    const invoicedByItem = new Map<string, number>();
    for (const item of invoiceItems || []) {
      if (item.request_item_id) {
        invoicedByItem.set(
          item.request_item_id, 
          (invoicedByItem.get(item.request_item_id) || 0) + Number(item.quantity)
        );
      }
    }

    // Identify requests with DRAFT invoices
    const draftInvoiceRequestIds = new Set(
      (allInvoices || [])
        .filter(inv => inv.status === 'DRAFT')
        .map(inv => inv.request_id)
    );

    // Get creator profiles
    const creatorIds = [...new Set(requestsData.map(r => r.created_by))];
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, name, email')
      .in('id', creatorIds);

    const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);

    // Filter and enrich requests
    const enrichedRequests: RequestWithCreator[] = [];
    
    for (const request of requestsData) {
      const hasDraftInvoice = draftInvoiceRequestIds.has(request.id);
      
      const requestItems = (allItems || []).filter(i => i.request_id === request.id);
      let hasRemainingItems = false;
      
      for (const item of requestItems) {
        const invoiced = invoicedByItem.get(item.id) || 0;
        if (Number(item.quantity) > invoiced) {
          hasRemainingItems = true;
          break;
        }
      }

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
  }

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '—';
    return format(new Date(dateStr), 'dd.MM.yyyy', { locale: uk });
  };

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('uk-UA', {
      style: 'decimal',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount) + ' ' + currency;
  };

  // Procurement manager - create invoice
  const handleCreateInvoice = async (request: RequestWithCreator) => {
    if (!user?.id) return;
    
    setCreatingInvoiceFor(request.id);
    try {
      const items = await getPurchaseRequestItems(request.id);
      
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
      
      const invoice = await createPurchaseInvoice({
        request_id: request.id,
        currency: request.currency,
        created_by: user.id,
      });

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

  // COO - approve request
  const handleApproveRequest = async (requestId: string) => {
    setProcessingId(requestId);
    try {
      const { error } = await supabase
        .from('purchase_requests')
        .update({
          status: 'IN_PROGRESS',
          coo_decision: 'APPROVED',
          coo_decided_by: user?.id,
          coo_decided_at: new Date().toISOString(),
        })
        .eq('id', requestId);

      if (error) throw error;

      await logPurchaseEvent('REQUEST', requestId, 'APPROVED_BY_COO');
      toast.success('Заявку погоджено');
      await loadQueueData();
    } catch (err) {
      console.error(err);
      toast.error('Помилка при погодженні заявки');
    } finally {
      setProcessingId(null);
    }
  };

  // COO - reject request
  const handleRejectRequest = async (requestId: string) => {
    setProcessingId(requestId);
    try {
      const { error } = await supabase
        .from('purchase_requests')
        .update({
          status: 'REJECTED',
          coo_decision: 'REJECTED',
          coo_decided_by: user?.id,
          coo_decided_at: new Date().toISOString(),
          coo_comment: rejectComment || null,
        })
        .eq('id', requestId);

      if (error) throw error;

      await logPurchaseEvent('REQUEST', requestId, 'REJECTED_BY_COO', rejectComment || undefined);
      toast.success('Заявку відхилено');
      setRejectComment('');
      await loadQueueData();
    } catch (err) {
      console.error(err);
      toast.error('Помилка при відхиленні заявки');
    } finally {
      setProcessingId(null);
    }
  };

  // COO - approve invoice
  const handleApproveInvoiceCOO = async (invoiceId: string) => {
    setProcessingId(invoiceId);
    try {
      const { error } = await supabase
        .from('purchase_invoices')
        .update({
          status: 'PENDING_CEO',
          coo_decision: 'APPROVED',
          coo_decided_by: user?.id,
          coo_decided_at: new Date().toISOString(),
        })
        .eq('id', invoiceId);

      if (error) throw error;

      await logPurchaseEvent('INVOICE', invoiceId, 'APPROVED_BY_COO');
      toast.success('Рахунок погоджено');
      await loadQueueData();
    } catch (err) {
      console.error(err);
      toast.error('Помилка при погодженні рахунку');
    } finally {
      setProcessingId(null);
    }
  };

  // COO - reject invoice
  const handleRejectInvoiceCOO = async (invoiceId: string) => {
    setProcessingId(invoiceId);
    try {
      const { error } = await supabase
        .from('purchase_invoices')
        .update({
          status: 'REJECTED',
          coo_decision: 'REJECTED',
          coo_decided_by: user?.id,
          coo_decided_at: new Date().toISOString(),
          coo_comment: rejectComment || null,
        })
        .eq('id', invoiceId);

      if (error) throw error;

      await logPurchaseEvent('INVOICE', invoiceId, 'REJECTED_BY_COO', rejectComment || undefined);
      toast.success('Рахунок відхилено');
      setRejectComment('');
      await loadQueueData();
    } catch (err) {
      console.error(err);
      toast.error('Помилка при відхиленні рахунку');
    } finally {
      setProcessingId(null);
    }
  };

  // CEO - approve invoice
  const handleApproveInvoiceCEO = async (invoiceId: string) => {
    setProcessingId(invoiceId);
    try {
      const { error } = await supabase
        .from('purchase_invoices')
        .update({
          status: 'TO_PAY',
          ceo_decision: 'APPROVED',
          ceo_decided_by: user?.id,
          ceo_decided_at: new Date().toISOString(),
        })
        .eq('id', invoiceId);

      if (error) throw error;

      await logPurchaseEvent('INVOICE', invoiceId, 'APPROVED_BY_CEO');
      toast.success('Рахунок погоджено');
      await loadQueueData();
    } catch (err) {
      console.error(err);
      toast.error('Помилка при погодженні рахунку');
    } finally {
      setProcessingId(null);
    }
  };

  // CEO - reject invoice
  const handleRejectInvoiceCEO = async (invoiceId: string) => {
    setProcessingId(invoiceId);
    try {
      const { error } = await supabase
        .from('purchase_invoices')
        .update({
          status: 'REJECTED',
          ceo_decision: 'REJECTED',
          ceo_decided_by: user?.id,
          ceo_decided_at: new Date().toISOString(),
          ceo_comment: rejectComment || null,
        })
        .eq('id', invoiceId);

      if (error) throw error;

      await logPurchaseEvent('INVOICE', invoiceId, 'REJECTED_BY_CEO', rejectComment || undefined);
      toast.success('Рахунок відхилено');
      setRejectComment('');
      await loadQueueData();
    } catch (err) {
      console.error(err);
      toast.error('Помилка при відхиленні рахунку');
    } finally {
      setProcessingId(null);
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

  const getPageTitle = () => {
    if (profile?.role === 'coo') return 'Заявки та рахунки на погодження';
    if (profile?.role === 'ceo') return 'Рахунки на погодження';
    return 'Заявки, готові до створення рахунку';
  };

  const renderRejectDialog = (
    id: string, 
    onReject: (id: string) => void, 
    title: string
  ) => (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button size="sm" variant="destructive" disabled={processingId === id}>
          <X className="h-4 w-4 mr-1" />
          Відхилити
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>
            Ви впевнені, що хочете відхилити? Вкажіть причину відхилення.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <Textarea
          placeholder="Причина відхилення (необов'язково)"
          value={rejectComment}
          onChange={(e) => setRejectComment(e.target.value)}
        />
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => setRejectComment('')}>Скасувати</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={() => onReject(id)}
          >
            Відхилити
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  // Calculate totals for display
  const totalPendingTasks = 
    (isCOO ? pendingApprovalRequests.length + pendingCOOInvoices.length : 0) +
    (isCEO && !isCOO ? pendingCEOInvoices.length : 0) +
    (isCEO && isCOO ? pendingCEOInvoices.length : 0) +
    (isProcurementManager ? requests.length : 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold">Закупівля ТМЦ</h1>
          <p className="text-muted-foreground">{getPageTitle()}</p>
        </div>
      </div>

      <PurchaseNavTabs />

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : error ? (
        <div className="text-center py-8 text-destructive">{error}</div>
      ) : (
        <div className="space-y-6">
          {/* COO: Pending Approval Requests */}
          {isCOO && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Заявки на погодження
                  {pendingApprovalRequests.length > 0 && (
                    <Badge variant="secondary" className="ml-2">{pendingApprovalRequests.length}</Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {pendingApprovalRequests.length === 0 ? (
                  <div className="text-center py-4 text-muted-foreground">
                    Немає заявок на погодження
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
                        <TableHead className="text-right">Дії</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pendingApprovalRequests.map((request) => (
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
                          <TableCell className="text-right space-x-2">
                            <Button 
                              size="sm" 
                              onClick={() => handleApproveRequest(request.id)}
                              disabled={processingId === request.id}
                            >
                              {processingId === request.id ? (
                                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                              ) : (
                                <Check className="h-4 w-4 mr-1" />
                              )}
                              Погодити
                            </Button>
                            {renderRejectDialog(request.id, handleRejectRequest, 'Відхилити заявку')}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          )}

          {/* COO: Pending COO Invoices */}
          {isCOO && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Receipt className="h-5 w-5" />
                  Рахунки на погодження (COO)
                  {pendingCOOInvoices.length > 0 && (
                    <Badge variant="secondary" className="ml-2">{pendingCOOInvoices.length}</Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {pendingCOOInvoices.length === 0 ? (
                  <div className="text-center py-4 text-muted-foreground">
                    Немає рахунків на погодження
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Номер</TableHead>
                        <TableHead>Постачальник</TableHead>
                        <TableHead>Сума</TableHead>
                        <TableHead>Умови оплати</TableHead>
                        <TableHead>Створив</TableHead>
                        <TableHead className="text-right">Дії</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pendingCOOInvoices.map((invoice) => (
                        <TableRow key={invoice.id}>
                          <TableCell 
                            className="font-medium cursor-pointer hover:underline"
                            onClick={() => navigate(`/purchase/invoices/${invoice.id}`)}
                          >
                            {invoice.number}
                          </TableCell>
                          <TableCell>{invoice.supplier_name}</TableCell>
                          <TableCell>{formatCurrency(invoice.amount, invoice.currency)}</TableCell>
                          <TableCell>{paymentTermsLabels[invoice.payment_terms]}</TableCell>
                          <TableCell>
                            <div>
                              <p className="font-medium">{invoice.creator_name}</p>
                            </div>
                          </TableCell>
                          <TableCell className="text-right space-x-2">
                            <Button 
                              size="sm" 
                              onClick={() => handleApproveInvoiceCOO(invoice.id)}
                              disabled={processingId === invoice.id}
                            >
                              {processingId === invoice.id ? (
                                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                              ) : (
                                <Check className="h-4 w-4 mr-1" />
                              )}
                              Погодити
                            </Button>
                            {renderRejectDialog(invoice.id, handleRejectInvoiceCOO, 'Відхилити рахунок')}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          )}

          {/* CEO: Pending CEO Invoices */}
          {isCEO && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Receipt className="h-5 w-5" />
                  Рахунки на погодження (CEO)
                  {pendingCEOInvoices.length > 0 && (
                    <Badge variant="secondary" className="ml-2">{pendingCEOInvoices.length}</Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {pendingCEOInvoices.length === 0 ? (
                  <div className="text-center py-4 text-muted-foreground">
                    Немає рахунків на погодження
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Номер</TableHead>
                        <TableHead>Постачальник</TableHead>
                        <TableHead>Сума</TableHead>
                        <TableHead>Умови оплати</TableHead>
                        <TableHead>COO рішення</TableHead>
                        <TableHead className="text-right">Дії</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pendingCEOInvoices.map((invoice) => (
                        <TableRow key={invoice.id}>
                          <TableCell 
                            className="font-medium cursor-pointer hover:underline"
                            onClick={() => navigate(`/purchase/invoices/${invoice.id}`)}
                          >
                            {invoice.number}
                          </TableCell>
                          <TableCell>{invoice.supplier_name}</TableCell>
                          <TableCell>{formatCurrency(invoice.amount, invoice.currency)}</TableCell>
                          <TableCell>{paymentTermsLabels[invoice.payment_terms]}</TableCell>
                          <TableCell>
                            <Badge variant="default" className="bg-green-600">
                              <Check className="h-3 w-3 mr-1" />
                              Погоджено COO
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right space-x-2">
                            <Button 
                              size="sm" 
                              onClick={() => handleApproveInvoiceCEO(invoice.id)}
                              disabled={processingId === invoice.id}
                            >
                              {processingId === invoice.id ? (
                                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                              ) : (
                                <Check className="h-4 w-4 mr-1" />
                              )}
                              Погодити
                            </Button>
                            {renderRejectDialog(invoice.id, handleRejectInvoiceCEO, 'Відхилити рахунок')}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          )}

          {/* Procurement Manager: Queue */}
          {isProcurementManager && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Черга на опрацювання
                  {requests.length > 0 && (
                    <Badge variant="secondary" className="ml-2">{requests.length}</Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {requests.length === 0 ? (
                  <div className="text-center py-4 text-muted-foreground">
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
          )}
        </div>
      )}
    </div>
  );
}
